from django.db import migrations, models

# store.sku is plain functions (no models), so it is safe to use here.
from store.sku import build_sku


def regenerate_skus(apps, schema_editor):
    """Switch existing products to the readable SKU format.

    Two passes, so no two products ever share a SKU in between.
    """

    Product = apps.get_model("store", "Product")
    products = list(Product.objects.select_related("category"))

    for product in products:
        Product.objects.filter(pk=product.pk).update(sku=f"TMP-{product.pk}")

    for product in products:
        Product.objects.filter(pk=product.pk).update(
            sku=build_sku(product.category.name, product.name, product.pk)
        )


class Migration(migrations.Migration):

    dependencies = [
        ("store", "0012_product_sku"),
    ]

    operations = [
        migrations.AlterField(
            model_name="product",
            name="sku",
            field=models.CharField(editable=False, max_length=48, unique=True, verbose_name="SKU"),
        ),
        migrations.RunPython(regenerate_skus, migrations.RunPython.noop),
    ]
