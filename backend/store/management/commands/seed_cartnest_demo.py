"""Add fictional CartNest demo records without changing existing records.

Run: python manage.py seed_cartnest_demo
Optional: python manage.py seed_cartnest_demo --dry-run
"""

from datetime import timedelta
from decimal import Decimal
import random

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from store.models import (
    Category, Product, CustomerProfile, DeliveryAddress,
    Order, OrderItem, ProductReview,
)

CATEGORIES = [
    ("Fresh Fruits", "Fresh, seasonal fruits for everyday shopping."),
    ("Fresh Vegetables", "Everyday vegetables and leafy greens."),
    ("Dairy & Eggs", "Milk, cheese, curd and eggs."),
    ("Bakery", "Fresh bread and baked essentials."),
    ("Rice & Grains", "Rice, pulses and everyday grains."),
    ("Snacks", "Biscuits, chips and savoury snacks."),
    ("Beverages", "Juices, tea, coffee and refreshments."),
    ("Home Essentials", "Cleaning and household necessities."),
]

# (category, name, selling price, original price, unit)
PRODUCTS = [
    ("Fresh Fruits", "Fresh Bananas 1 kg", 65, 80, "pack"),
    ("Fresh Fruits", "Royal Gala Apples 1 kg", 189, 220, "pack"),
    ("Fresh Fruits", "Sweet Oranges 1 kg", 110, 130, "pack"),
    ("Fresh Fruits", "Pomegranate 500 g", 145, 170, "pack"),
    ("Fresh Fruits", "Papaya 1 piece", 69, 85, "piece"),
    ("Fresh Fruits", "Seedless Grapes 500 g", 99, 120, "pack"),
    ("Fresh Fruits", "Pineapple 1 piece", 79, 95, "piece"),
    ("Fresh Vegetables", "Tomatoes 1 kg", 49, 60, "pack"),
    ("Fresh Vegetables", "Onions 1 kg", 54, 65, "pack"),
    ("Fresh Vegetables", "Potatoes 1 kg", 46, 55, "pack"),
    ("Fresh Vegetables", "Carrots 500 g", 42, 50, "pack"),
    ("Fresh Vegetables", "Cucumber 500 g", 39, 48, "pack"),
    ("Fresh Vegetables", "Green Chillies 100 g", 18, 24, "pack"),
    ("Fresh Vegetables", "Spinach 1 bunch", 30, 38, "bunch"),
    ("Dairy & Eggs", "Fresh Toned Milk 1 L", 62, 68, "carton"),
    ("Dairy & Eggs", "Farm Fresh Eggs 6 pcs", 55, 65, "pack"),
    ("Dairy & Eggs", "Natural Curd 500 g", 48, 55, "tub"),
    ("Dairy & Eggs", "Salted Butter 100 g", 64, 72, "pack"),
    ("Dairy & Eggs", "Paneer 200 g", 92, 105, "pack"),
    ("Dairy & Eggs", "Cheese Slices 200 g", 125, 145, "pack"),
    ("Bakery", "Whole Wheat Bread 400 g", 49, 58, "loaf"),
    ("Bakery", "White Sandwich Bread 400 g", 42, 50, "loaf"),
    ("Bakery", "Burger Buns 4 pcs", 52, 60, "pack"),
    ("Bakery", "Multigrain Bread 400 g", 69, 80, "loaf"),
    ("Bakery", "Plain Rusk 200 g", 48, 55, "pack"),
    ("Bakery", "Chocolate Muffins 2 pcs", 75, 90, "pack"),
    ("Rice & Grains", "Matta Rice 5 kg", 335, 375, "bag"),
    ("Rice & Grains", "Basmati Rice 1 kg", 159, 185, "bag"),
    ("Rice & Grains", "Toor Dal 1 kg", 175, 195, "bag"),
    ("Rice & Grains", "Moong Dal 500 g", 79, 92, "bag"),
    ("Rice & Grains", "Wheat Atta 5 kg", 249, 275, "bag"),
    ("Rice & Grains", "Rolled Oats 500 g", 109, 130, "pack"),
    ("Snacks", "Salted Potato Chips 90 g", 35, 40, "pack"),
    ("Snacks", "Masala Peanuts 200 g", 69, 80, "pack"),
    ("Snacks", "Butter Cookies 200 g", 75, 90, "pack"),
    ("Snacks", "Cream Biscuits 150 g", 38, 45, "pack"),
    ("Snacks", "Roasted Cashews 100 g", 129, 150, "pack"),
    ("Snacks", "Banana Chips 200 g", 95, 110, "pack"),
    ("Beverages", "Orange Juice 1 L", 119, 140, "bottle"),
    ("Beverages", "Mango Drink 1 L", 85, 100, "bottle"),
    ("Beverages", "Instant Coffee 100 g", 185, 210, "jar"),
    ("Beverages", "Premium Tea 250 g", 149, 170, "pack"),
    ("Beverages", "Coconut Water 200 ml", 45, 55, "carton"),
    ("Beverages", "Mineral Water 1 L", 20, 25, "bottle"),
    ("Home Essentials", "Dishwash Liquid 500 ml", 99, 115, "bottle"),
    ("Home Essentials", "Laundry Detergent 1 kg", 155, 180, "pack"),
    ("Home Essentials", "Floor Cleaner 1 L", 135, 155, "bottle"),
    ("Home Essentials", "Kitchen Tissue Roll 2 pcs", 89, 105, "pack"),
    ("Home Essentials", "Handwash Refill 750 ml", 109, 130, "pack"),
    ("Home Essentials", "Garbage Bags 30 pcs", 85, 99, "roll"),
]

CUSTOMER_NAMES = [
    ("Ananya", "Menon"), ("Rahul", "Nair"), ("Diya", "Krishnan"),
    ("Arjun", "Pillai"), ("Meera", "Das"), ("Adithya", "Rajan"),
    ("Nisha", "Varma"), ("Vivek", "Kumar"), ("Sneha", "Mohan"),
    ("Kiran", "Suresh"), ("Aparna", "Prasad"), ("Rohit", "Babu"),
    ("Lakshmi", "Nambiar"), ("Akhil", "Raj"), ("Neha", "Shankar"),
]

REVIEW_COMMENTS = [
    "Fresh and neatly packed. Very happy with the quality.",
    "Good value for money and arrived in great condition.",
    "Exactly as described. Would order again.",
    "Convenient delivery and good quality overall.",
    "Nice product and reasonable price.",
    "Packaging was secure and the item was fresh.",
]


class Command(BaseCommand):
    help = "Safely add fictional CartNest demo products, customers, orders and reviews."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run", action="store_true",
            help="Preview the planned records without writing to the database.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        rng = random.Random(20261023)
        if options["dry_run"]:
            self.stdout.write("Dry run: no database changes will be made.")

        categories = {}
        for name, description in CATEGORIES:
            slug = slugify(name)
            obj, _ = Category.objects.get_or_create(
                slug=slug,
                defaults={"name": name, "description": description, "is_active": True},
            )
            categories[name] = obj

        products = []
        for idx, (category, name, price, original_price, unit) in enumerate(PRODUCTS):
            # Prefix makes demo products distinct from existing store products.
            slug = f"demo-{slugify(name)}"
            obj, _ = Product.objects.get_or_create(
                slug=slug,
                defaults={
                    "category": categories[category],
                    "name": name,
                    "description": f"Quality {name.lower()} for everyday grocery needs. Demo listing.",
                    "price": Decimal(str(price)),
                    "original_price": Decimal(str(original_price)),
                    "unit": unit,
                    "stock": rng.randint(45, 180),
                    "is_available": True,
                    "is_featured": idx % 6 == 0,
                },
            )
            products.append(obj)

        User = get_user_model()
        customers = []
        for idx, (first, last) in enumerate(CUSTOMER_NAMES, start=1):
            username = f"cartnest_demo_{idx:02d}"
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "first_name": first,
                    "last_name": last,
                    "email": f"cartnest-demo-{idx:02d}@example.com",
                    "is_active": True,
                    "is_staff": False,
                    "is_superuser": False,
                },
            )
            if created:
                # Demo users cannot log in; avoids distributing a shared password.
                user.set_unusable_password()
                user.save(update_fields=["password"])
            customers.append(user)
            CustomerProfile.objects.get_or_create(user=user)
            DeliveryAddress.objects.get_or_create(
                user=user,
                label="home",
                defaults={
                    "full_name": f"{first} {last}",
                    "phone": f"9{(800000000 + idx):09d}",
                    "address": f"Demo House {idx}, Market Road, Near Central Junction",
                    "city": "Kochi" if idx % 2 else "Kannur",
                    "state": "Kerala",
                    "postal_code": "682001" if idx % 2 else "670001",
                    "is_default": True,
                },
            )

        # Create 50 orders across 15 users. Never touch existing orders.
        # If a user already has demo orders, don't generate duplicates on re-run.
        new_orders = 0
        created_order_items = []
        now = timezone.now()
        for idx in range(50):
            user = customers[idx % len(customers)]
            slot = idx // len(customers)
            # Existing demo orders are identifiable through a deterministic
            # non-sensitive address suffix, not by modifying schema.
            demo_address = f"Demo House {idx % len(customers) + 1}, Market Road, Demo Order {slot + 1}"
            if Order.objects.filter(user=user, address=demo_address).exists():
                continue

            chosen = rng.sample(products, rng.randint(1, 4))
            quantities = [rng.randint(1, 3) for _ in chosen]
            total = sum((p.price * q for p, q in zip(chosen, quantities)), Decimal("0.00"))
            # Only delivered orders are paid. Other demo orders remain COD pending.
            status_value = ["delivered", "delivered", "delivered", "shipped", "packed", "confirmed", "cancelled"][idx % 7]
            is_paid = status_value == "delivered"
            first, last = CUSTOMER_NAMES[idx % len(customers)]
            order = Order.objects.create(
                user=user, full_name=f"{first} {last}",
                phone=f"9{(800000000 + idx % len(customers) + 1):09d}",
                address=demo_address,
                city="Kochi" if idx % 2 else "Kannur", state="Kerala",
                postal_code="682001" if idx % 2 else "670001",
                total_amount=total,
                status=status_value,
                payment_method="cod",
                payment_status="paid" if is_paid else "pending",
                cancellation_reason="Customer requested cancellation (demo)." if status_value == "cancelled" else "",
                cancelled_at=now - timedelta(days=idx % 28) if status_value == "cancelled" else None,
            )
            days_ago = idx % 42
            order_time = now - timedelta(days=days_ago, hours=idx % 12)
            Order.objects.filter(pk=order.pk).update(created_at=order_time, updated_at=order_time)
            for p, qty in zip(chosen, quantities):
                item = OrderItem.objects.create(
                    order=order, product=p, product_name=p.name,
                    quantity=qty, price=p.price,
                )
                if is_paid:
                    created_order_items.append(item)
            new_orders += 1

        # Review only products the demo customer actually received.
        # Existing reviews are never changed.
        reviews_created = 0
        eligible = list(
            OrderItem.objects.filter(
                order__user__in=customers,
                order__status="delivered",
                product__in=products,
            ).select_related("order", "product").order_by("pk")
        )
        rng.shuffle(eligible)
        for item in eligible:
            if reviews_created >= 30:
                break
            _, created = ProductReview.objects.get_or_create(
                user=item.order.user, product=item.product,
                defaults={
                    "rating": rng.choice([4, 4, 5, 5, 5, 3]),
                    "comment": rng.choice(REVIEW_COMMENTS),
                },
            )
            if created:
                reviews_created += 1

        if options["dry_run"]:
            transaction.set_rollback(True)
            self.stdout.write(self.style.WARNING("Preview complete: transaction rolled back."))
        else:
            self.stdout.write(self.style.SUCCESS("CartNest demo seed completed successfully."))
        self.stdout.write(
            f"Demo catalog: {len(CATEGORIES)} categories, {len(PRODUCTS)} products; "
            f"demo customers: {len(customers)}; new orders: {new_orders}; "
            f"new reviews: {reviews_created}."
        )
        self.stdout.write("Safe to run again: existing records are preserved and demo orders are not duplicated.")
        self.stdout.write("Note: product images are not included; upload them separately through admin.")
