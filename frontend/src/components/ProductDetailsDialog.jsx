import { useState } from "react";
import { X, Package, Copy, Check, Star } from "lucide-react";
import { getProductImageUrl, isDemoImage } from "../lib/productImages";

function money(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
  });
}

function dateLabel(value) {
  return value
    ? new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";
}

// Product photo for staff pages: uploaded image, else the bundled demo photo.
export function ProductThumb({ product, size = "h-14 w-14" }) {
  const url = getProductImageUrl(product.image, product.name);

  return (
    <div className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white`}>
      {url ? (
        <img
          src={url}
          alt={product.name}
          className={`h-full w-full object-contain ${isDemoImage(url) ? "scale-[1.9]" : "p-1"}`}
        />
      ) : (
        <Package size={22} className="text-gray-400" />
      )}
    </div>
  );
}

// Everything about one product, for admins and managers (and staff, read-only).
export default function ProductDetailsDialog({ product, lowStockThreshold = 5, onClose }) {
  const [copied, setCopied] = useState(false);
  const stock = Number(product.stock);

  const stockLabel =
    stock === 0
      ? { text: "Out of stock", style: "bg-red-50 text-red-700" }
      : stock <= lowStockThreshold
      ? { text: "Low stock", style: "bg-amber-50 text-amber-700" }
      : { text: "In stock", style: "bg-green-50 text-green-700" };

  async function copySku() {
    try {
      await navigator.clipboard.writeText(product.sku);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the SKU is still visible to copy by hand.
    }
  }

  const rows = [
    ["Category", product.category_name],
    ["Unit", product.unit || "—"],
    ["Selling price", money(product.price)],
    [
      "Original price (MRP)",
      product.original_price ? money(product.original_price) : "—",
    ],
    ["Discount", product.discount_percentage ? `${product.discount_percentage}% off` : "—"],
    ["Stock quantity", `${stock} ${stock === 1 ? "unit" : "units"}`],
    ["Listed in the shop", product.is_available ? "Yes" : "No (unavailable)"],
    ["Featured", product.is_featured ? "Yes" : "No"],
    ["Added", dateLabel(product.created_at)],
    ["Last updated", dateLabel(product.updated_at)],
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${product.name} details`}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* HEADER */}

        <div className="flex items-start gap-4 border-b border-gray-200 p-6">
          <ProductThumb product={product} size="h-20 w-20" />

          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={copySku}
              title="Copy SKU"
              className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-2 py-1 font-mono text-xs font-semibold text-yellow-300 hover:bg-gray-800"
            >
              {product.sku}
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>

            <h2 className="mt-2 text-xl font-bold text-gray-900">{product.name}</h2>

            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
              <span className={`rounded-full px-2.5 py-1 ${product.is_available ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                {product.is_available ? "Available" : "Unavailable"}
              </span>
              <span className={`rounded-full px-2.5 py-1 ${stockLabel.style}`}>{stockLabel.text}</span>
              {product.is_featured && (
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-1 text-yellow-800">
                  <Star size={12} />
                  Featured
                </span>
              )}
            </div>
          </div>

          <button type="button" onClick={onClose} aria-label="Close details" className="rounded-full p-2 text-gray-500 hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        {/* DETAILS */}

        <div className="overflow-y-auto p-6">
          <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-gray-100 py-3 text-sm">
                <dt className="text-gray-500">{label}</dt>
                <dd className="text-right font-medium text-gray-900">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5">
            <p className="text-sm font-semibold text-gray-900">Description</p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-gray-600">
              {product.description || "No description."}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
