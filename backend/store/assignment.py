"""Automatic order assignment.

Orders move through two lanes, each worked by punched-in staff who hold
one order at a time:

* Packing:  employees take Placed orders (pending/confirmed) and pack them.
* Delivery: delivery staff take Packed orders, mark them Shipped on
  pickup and Delivered on arrival.

Within a lane, waiting orders are handed out oldest first. When several
people are free, whoever has gone longest without an order goes next
(rotation). As soon as someone finishes, they receive the next waiting order.

`assign_waiting_orders()` is safe to call at any time. An order is claimed
only if it is still unassigned, and the database constraints
`one_open_order_per_employee` and `one_active_delivery_per_person` make it
impossible for anyone to hold two active orders.
"""

from dataclasses import dataclass

from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone

from .models import Order, ShiftRecord, StaffProfile


@dataclass(frozen=True)
class Lane:
    role: str           # StaffProfile role that works this lane
    statuses: tuple     # order statuses that are active in this lane
    person_field: str   # Order field holding the assigned person
    time_field: str     # Order field holding when they were assigned
    queue_order: tuple  # oldest-first ordering of waiting orders


PACKING = Lane(
    role="employee",
    statuses=Order.OPEN_STATUSES,
    person_field="assigned_to",
    time_field="assigned_at",
    queue_order=("created_at", "pk"),
)

DELIVERY = Lane(
    role="delivery",
    statuses=Order.DELIVERY_STATUSES,
    person_field="delivery_person",
    time_field="delivery_assigned_at",
    queue_order=("packed_at", "created_at", "pk"),
)

LANES = {"packing": PACKING, "delivery": DELIVERY}


def lane_for_role(role):
    return {"employee": PACKING, "delivery": DELIVERY}.get(role)


def active_order_for(user, lane):
    """The order this person is currently working on in the lane, if any."""

    return Order.objects.filter(
        **{lane.person_field: user},
        status__in=lane.statuses,
    ).first()


def waiting_orders(lane):
    """Orders in the lane with nobody assigned, oldest first."""

    # Normally only packed orders wait for a delivery staff member. Shipped
    # orders with nobody assigned (from before delivery staff existed)
    # wait too, so someone can still mark them delivered.
    return Order.objects.filter(
        **{f"{lane.person_field}__isnull": True},
        status__in=lane.statuses,
    ).order_by(*lane.queue_order)


def available_profiles(lane):
    """Punched-in, active, approved people for the lane, in rotation order."""

    return StaffProfile.objects.filter(
        role=lane.role,
        is_punched_in=True,
        approval_status="approved",
        user__is_active=True,
    ).order_by(
        F("last_assigned_at").asc(nulls_first=True),
        "punched_in_at",
        "pk",
    )


def assign_waiting_orders():
    """Hand waiting orders to every free person in both lanes. Returns assigned order ids."""

    assigned = []

    for lane in (PACKING, DELIVERY):
        try:
            with transaction.atomic():
                assigned += _assign_lane(lane)
        except IntegrityError:
            # Another request assigned the same person at the same moment;
            # nothing was saved here and that assignment stands.
            pass

    return assigned


def _assign_lane(lane):

    profiles = list(available_profiles(lane).select_for_update())

    if not profiles:
        return []

    busy = set(
        Order.objects.filter(
            **{f"{lane.person_field}_id__in": [profile.user_id for profile in profiles]},
            status__in=lane.statuses,
        ).values_list(f"{lane.person_field}_id", flat=True)
    )

    assigned = []

    for profile in profiles:

        if profile.user_id in busy:
            continue

        order_id = claim_next_order(lane, profile.user_id)

        if order_id is None:
            break  # The queue is empty.

        profile.last_assigned_at = timezone.now()
        profile.save(update_fields=["last_assigned_at", "updated_at"])

        assigned.append(order_id)

    return assigned


def claim_next_order(lane, user_id):
    """Assign the oldest waiting order in the lane to this user; returns its id or None."""

    while True:
        order_id = waiting_orders(lane).values_list("pk", flat=True).first()

        if order_id is None:
            return None

        # Only succeeds if nobody claimed the order in the meantime.
        claimed = waiting_orders(lane).filter(pk=order_id).update(
            **{
                f"{lane.person_field}_id": user_id,
                lane.time_field: timezone.now(),
            }
        )

        if claimed:
            return order_id


def release_active_order(user, lane):
    """Put the person's order back in the lane's queue. Returns it, or None.

    A delivery that is already Shipped stays with its delivery staff member:
    they have the parcel and must still mark it Delivered.
    """

    order = active_order_for(user, lane)

    if order is None or (lane is DELIVERY and order.status == "shipped"):
        return None

    setattr(order, lane.person_field, None)
    setattr(order, lane.time_field, None)
    order.save(update_fields=[lane.person_field, lane.time_field, "updated_at"])

    return order


def punch_in(profile):

    with transaction.atomic():
        now = timezone.now()

        profile.is_punched_in = True
        profile.punched_in_at = now
        profile.save(update_fields=["is_punched_in", "punched_in_at", "updated_at"])

        # Attendance: start a shift (closing any shift left open by mistake).
        ShiftRecord.objects.filter(
            user=profile.user, punched_out_at__isnull=True
        ).update(punched_out_at=now)
        ShiftRecord.objects.create(user=profile.user, role=profile.role, punched_in_at=now)

    assign_waiting_orders()


def punch_out(profile):
    """End the shift. An order not yet started goes back to the queue for someone else."""

    with transaction.atomic():
        profile.is_punched_in = False
        profile.punched_out_at = timezone.now()
        profile.save(update_fields=["is_punched_in", "punched_out_at", "updated_at"])

        # Attendance: end the open shift.
        ShiftRecord.objects.filter(
            user=profile.user, punched_out_at__isnull=True
        ).update(punched_out_at=profile.punched_out_at)

        # Both lanes, in case the person's role was just changed.
        released = [
            order
            for order in (
                release_active_order(profile.user, PACKING),
                release_active_order(profile.user, DELIVERY),
            )
            if order is not None
        ]

    assign_waiting_orders()

    return released
