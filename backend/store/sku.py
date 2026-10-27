"""Readable, unique SKUs for products.

    CN-<category>-<product>-<size>-<id>
    "Mango Drink 1 L" in Beverages        -> CN-BEV-MANGO-DRINK-1L-00040
    "Royal Gala Apples 1 kg" in Fresh Fruits -> CN-FFR-ROYAL-APPLES-1KG-00003
    "Grapes" in Fruits                     -> CN-FRU-GRAPES-00001

The id at the end makes every SKU unique, so two similar products can never
clash. A SKU is set once when the product is created and is not changed if
the product is later renamed or moved.
"""

import re

# Units in product names, and how they are written in a SKU.
UNITS = {
    "kg": "KG",
    "g": "G",
    "gm": "G",
    "l": "L",
    "ltr": "L",
    "ml": "ML",
    "pcs": "PC",
    "pc": "PC",
    "piece": "PC",
    "pieces": "PC",
    "bunch": "BN",
    "pack": "PK",
}

SIZE = re.compile(
    r"(\d+(?:\.\d+)?)\s*(" + "|".join(sorted(UNITS, key=len, reverse=True)) + r")\b",
    re.IGNORECASE,
)

WORD_LENGTH = 6


def category_code(category_name):
    """"Beverages" -> BEV, "Fresh Fruits" -> FFR, "Dairy & Eggs" -> DEG."""

    words = re.findall(r"[A-Za-z]+", category_name or "")

    if len(words) >= 2:
        code = words[0][0] + words[1][:2]
    else:
        code = words[0][:3] if words else "GEN"

    return code.upper().ljust(3, "X")


def product_code(product_name):
    """"Mango Drink 1 L" -> MANGO-DRINK-1L, "Royal Gala Apples 1 kg" -> ROYAL-APPLES-1KG.

    The first and last words of the name usually carry the variety and the
    product type, so those two are kept (each up to six letters).
    """

    name = product_name or ""
    size = SIZE.search(name)

    words = re.findall(r"[A-Za-z]+", SIZE.sub(" ", name))
    picked = words if len(words) <= 2 else [words[0], words[-1]]
    parts = [word[:WORD_LENGTH].upper() for word in picked] or ["ITEM"]

    if size:
        amount = size.group(1).rstrip("0").rstrip(".") if "." in size.group(1) else size.group(1)
        parts.append(amount + UNITS[size.group(2).lower()])

    return "-".join(parts)


def build_sku(category_name, product_name, product_id):
    return f"CN-{category_code(category_name)}-{product_code(product_name)}-{product_id:05d}"
