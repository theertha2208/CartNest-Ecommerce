import re

from django.db import migrations, models


def build_sku(category_name, product_id):
    # Same format as store.models.build_sku, copied so this migration keeps
    # working even if that function changes later.
    name = category_name
    words = re.findall(r"[A-Za-z]+", name or "")

    if len(words) >= 2:
        # "Fresh Fruits" -> FFR, "Dairy & Eggs" -> DEG
        code = (words[0][0] + words[1][:2]).upper()
    else:
        # "Bakery" -> BAK
        code = (words[0][:3] if words else "GEN").upper()

    code = code.ljust(3, "X")
    return f"CN-{code}-{product_id:05d}"


def assign_skus(apps, schema_editor):
    Product = apps.get_model("store", "Product")

    for product in Product.objects.select_related("category").filter(sku__isnull=True):
        product.sku = build_sku(product.category.name, product.pk)
        product.save(update_fields=["sku"])


class Migration(migrations.Migration):

    dependencies = [
        ("store", "0011_delivery_and_approval"),
    ]

    operations = [
        # 1. Add the column, empty for now.
        migrations.AddField(
            model_name="product",
            name="sku",
            field=models.CharField(editable=False, max_length=32, null=True, verbose_name="SKU"),
        ),
        # 2. Give every existing product its SKU.
        migrations.RunPython(assign_skus, migrations.RunPython.noop),
        # 3. Make it required and unique.
        migrations.AlterField(
            model_name="product",
            name="sku",
            field=models.CharField(editable=False, max_length=32, unique=True, verbose_name="SKU"),
        ),
    ]
