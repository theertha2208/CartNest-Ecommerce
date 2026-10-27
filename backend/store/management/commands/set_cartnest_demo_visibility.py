"""Show 24 selected CartNest demo products; hide other demo products safely.

Install at store/management/commands/set_cartnest_demo_visibility.py
Preview: python manage.py set_cartnest_demo_visibility --dry-run
Apply:   python manage.py set_cartnest_demo_visibility
Restore: python manage.py set_cartnest_demo_visibility --show-all

Only products whose slugs match the demo seed catalog are touched.
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify
from store.models import Product
from store.management.commands.seed_cartnest_demo import PRODUCTS

VISIBLE_NAMES = {
    "Royal Gala Apples 1 kg", "Pomegranate 500 g", "Papaya 1 piece",
    "Tomatoes 1 kg", "Carrots 500 g", "Cucumber 500 g",
    "Fresh Toned Milk 1 L", "Farm Fresh Eggs 6 pcs", "Paneer 200 g",
    "Whole Wheat Bread 400 g", "Burger Buns 4 pcs", "Chocolate Muffins 2 pcs",
    "Basmati Rice 1 kg", "Moong Dal 500 g", "Rolled Oats 500 g",
    "Salted Potato Chips 90 g", "Roasted Cashews 100 g", "Banana Chips 200 g",
    "Orange Juice 1 L", "Mango Drink 1 L", "Mineral Water 1 L",
    "Dishwash Liquid 500 ml", "Kitchen Tissue Roll 2 pcs", "Handwash Refill 750 ml",
}

class Command(BaseCommand):
    help = "Show 24 selected demo products and hide the other 26, without deleting records."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Preview changes only")
        parser.add_argument("--show-all", action="store_true", help="Make all 50 demo products available again")

    def handle(self, *args, **options):
        all_names = {name for _, name, *_ in PRODUCTS}
        if len(VISIBLE_NAMES) != 24 or not VISIBLE_NAMES <= all_names:
            raise RuntimeError("The 24-product selection does not match the demo seed catalog")

        updates = []
        missing = []
        for name in sorted(all_names):
            slug = "demo-" + slugify(name)
            product = Product.objects.filter(slug=slug).first()
            if product is None:
                missing.append(name)
                continue
            target = True if options["show_all"] else name in VISIBLE_NAMES
            if product.is_available != target:
                updates.append((product, target))

        for product, target in updates:
            self.stdout.write(f"{'SHOW' if target else 'HIDE'}: {product.name}")
        if missing:
            self.stdout.write(self.style.WARNING(f"Demo products missing from database: {len(missing)}"))
        if options["dry_run"]:
            self.stdout.write(self.style.WARNING(f"Preview only: {len(updates)} changes; no records modified."))
            return
        with transaction.atomic():
            for product, target in updates:
                product.is_available = target
                product.save(update_fields=["is_available"])
        self.stdout.write(self.style.SUCCESS(f"Done: {len(updates)} product visibility updates. No products deleted."))
        self.stdout.write("Note: storefront must filter is_available=True for hidden products to disappear.")
