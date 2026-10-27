const API_BASE = "http://127.0.0.1:8000";

// Make a Django media path ("/media/products/x.jpg") into a full URL.
export function getImageUrl(image) {
  if (!image) return null;

  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }

  return `${API_BASE}${image.startsWith("/") ? "" : "/"}${image}`;
}

// Local portfolio images for the 24 selected demo products.
// Django-uploaded images still take priority when available.
const DEMO_IMAGE_SLUGS = new Set([
  "banana-chips-200-g",
  "basmati-rice-1-kg",
  "burger-buns-4-pcs",
  "carrots-500-g",
  "chocolate-muffins-2-pcs",
  "cucumber-500-g",
  "dishwash-liquid-500-ml",
  "farm-fresh-eggs-6-pcs",
  "fresh-toned-milk-1-l",
  "handwash-refill-750-ml",
  "kitchen-tissue-roll-2-pcs",
  "mango-drink-1-l",
  "mineral-water-1-l",
  "moong-dal-500-g",
  "orange-juice-1-l",
  "paneer-200-g",
  "papaya-1-piece",
  "pomegranate-500-g",
  "roasted-cashews-100-g",
  "rolled-oats-500-g",
  "royal-gala-apples-1-kg",
  "salted-potato-chips-90-g",
  "tomatoes-1-kg",
  "whole-wheat-bread-400-g",
]);

const DEMO_IMAGE_FOLDER = "/cartnest-products/";

// The uploaded image if there is one, otherwise the bundled demo photo
// matching the product name, otherwise null.
export function getProductImageUrl(image, name) {
  const djangoImage = getImageUrl(image);
  if (djangoImage) return djangoImage;

  const slug = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return DEMO_IMAGE_SLUGS.has(slug) ? `${DEMO_IMAGE_FOLDER}${slug}.jpg` : null;
}

// The bundled demo photos have wide white margins around the product,
// so pages zoom them in to fill their frame.
export function isDemoImage(url) {
  return Boolean(url && url.startsWith(DEMO_IMAGE_FOLDER));
}
