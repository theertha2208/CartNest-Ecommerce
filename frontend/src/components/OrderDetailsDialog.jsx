import { useState } from "react";
import { X, Loader2, MapPin, Phone, UserRound, CreditCard, ArrowRight } from "lucide-react";
import { adminRequest, money } from "../pages/adminApi";
import {
  NEXT_STATUSES,
  STATUS_BADGES,
  dateTimeLabel,
  formatOrderId,
  statusLabel,
} from "../lib/orderUtils";
import OrderTracker from "./OrderTracker";

const PLACED = ["pending", "confirmed"];

function packingLine(order) {
  if (order.assigned_to_name) {
    return `${PLACED.includes(order.status) ? "Being packed" : "Packed"} by ${order.assigned_to_name}`;
  }
  return PLACED.includes(order.status) ? "Waiting for staff to pack" : "Packed by: not recorded";
}

function deliveryLine(order) {
  if (PLACED.includes(order.status) || (order.status === "cancelled" && !order.delivery_person_name)) {
    return "";
  }
  if (!order.delivery_person_name) {
    return order.status === "packed" ? "Waiting for a delivery staff member" : "Delivered by: not recorded";
  }
  const verb = { packed: "To be picked up by", shipped: "Out for delivery with", delivered: "Delivered by" }[order.status];
  return `${verb || "Delivery staff:"} ${order.delivery_person_name}`;
}

const ACTION_LABELS = {
  confirmed: "Confirm order",
  packed: "Mark as packed",
  shipped: "Mark as shipped",
  delivered: "Mark as delivered",
  cancelled: "Cancel order",
};

// Full order details for admins and managers. Staff and delivery staff
// move orders forward from their own dashboards; managers may only cancel,
// and admins only view.
export default function OrderDetailsDialog({ order, onClose, onUpdated, canCancel = false }) {
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  const items = order.items || [];
  const itemCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const nextStatuses = canCancel
    ? (NEXT_STATUSES[order.status] || []).filter((next) => next === "cancelled")
    : [];

  async function updateStatus(newStatus) {
    setSaving(newStatus);
    setError("");

    try {
      const body = { status: newStatus };
      if (newStatus === "cancelled") body.cancellation_reason = reason.trim();

      const updated = await adminRequest(`/admin/orders/${order.id}/status/`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      setCancelling(false);
      setReason("");
      onUpdated?.(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Order ${formatOrderId(order.id)} details`}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 cn-glass-deep shadow-2xl"
      >
        {/* HEADER */}

        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-green-700">Order details</p>
            <h2 className="mt-1 font-serif text-3xl">{formatOrderId(order.id)}</h2>
            <p className="mt-1 text-xs text-gray-500">Placed {dateTimeLabel(order.created_at)}</p>
          </div>

          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${STATUS_BADGES[order.status] || ""}`}>
              {statusLabel(order.status)}
            </span>
            <button type="button" onClick={onClose} aria-label="Close order details" className="p-1.5">
              <X size={22} />
            </button>
          </div>
        </div>

        <div className="space-y-6 overflow-y-auto px-6 py-6">
          <OrderTracker order={order} />

          {/* ITEMS */}

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">
              Items ({itemCount})
            </p>

            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-green-50 text-[11px] uppercase tracking-[0.1em] text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Product</th>
                    <th className="px-4 py-2.5 text-center font-semibold">Qty</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Price</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">{item.product_name}</td>
                      <td className="px-4 py-3 text-center">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{money(item.price)}</td>
                      <td className="px-4 py-3 text-right">
                        {money(Number(item.price) * Number(item.quantity))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200">
                    <td colSpan={3} className="px-4 py-3 text-right font-semibold">Total</td>
                    <td className="px-4 py-3 text-right font-serif text-xl">{money(order.total_amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* CUSTOMER */}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-gray-200 p-4 text-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">Customer</p>
              <p className="flex items-center gap-2 font-semibold">
                <UserRound size={15} className="shrink-0" />
                {order.full_name}
                <span className="font-normal text-gray-500">@{order.customer_username}</span>
              </p>
              <p className="flex items-center gap-2 text-gray-600">
                <Phone size={15} className="shrink-0" />
                {order.phone}
              </p>
              <p className="flex gap-2 text-gray-600">
                <MapPin size={15} className="mt-0.5 shrink-0" />
                <span>
                  {order.address}, {order.city}, {order.state} {order.postal_code}
                </span>
              </p>
            </div>

            <div className="space-y-2 rounded-xl border border-gray-200 p-4 text-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">Payment & handling</p>
              <p className="flex items-center gap-2 text-gray-600">
                <CreditCard size={15} className="shrink-0" />
                {order.payment_method === "cod" ? "Cash on Delivery" : order.payment_method} ·{" "}
                <span className="capitalize">{order.payment_status}</span>
              </p>
              <p className="text-gray-600">{packingLine(order)}</p>
              <p className="text-gray-600">{deliveryLine(order)}</p>
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </p>
          )}

          {cancelling && (
            <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <label htmlFor="cancel-reason" className="block text-sm font-semibold">
                Reason for cancelling
              </label>
              <textarea
                id="cancel-reason"
                rows={2}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-transparent p-3 text-sm outline-none focus:border-yellow-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCancelling(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold"
                >
                  Keep order
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus("cancelled")}
                  disabled={!reason.trim() || saving !== null}
                  className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {saving === "cancelled" ? "Cancelling..." : "Cancel order"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ACTIONS */}

        {nextStatuses.length > 0 && !cancelling && (
          <div className="flex flex-wrap justify-end gap-3 border-t border-gray-200 px-6 py-4">
            {nextStatuses.map((nextStatus) =>
              nextStatus === "cancelled" ? (
                <button
                  key={nextStatus}
                  type="button"
                  onClick={() => setCancelling(true)}
                  disabled={saving !== null}
                  className="rounded-xl border border-red-300 px-5 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {ACTION_LABELS.cancelled}
                </button>
              ) : (
                <button
                  key={nextStatus}
                  type="button"
                  onClick={() => updateStatus(nextStatus)}
                  disabled={saving !== null}
                  className="inline-flex items-center gap-2 rounded-xl cn-gradient-gold px-5 py-2.5 text-xs font-semibold text-gray-900 disabled:opacity-60"
                >
                  {saving === nextStatus ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                  {ACTION_LABELS[nextStatus]}
                </button>
              )
            )}
          </div>
        )}
      </section>
    </div>
  );
}
