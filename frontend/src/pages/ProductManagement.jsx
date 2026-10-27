
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Package,
  ImagePlus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  PackagePlus,
  PackageX,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { canManageStock, getCurrentRole } from "../lib/staffRoles";
import ProductDetailsDialog, { ProductThumb } from "../components/ProductDetailsDialog";

const API_BASE = "http://127.0.0.1:8000";

const emptyStockForm = {
  direction: "add",
  quantity: "",
  note: "",
};

const emptyForm = {
  category: "",
  name: "",
  slug: "",
  description: "",
  price: "",
  original_price: "",
  stock: "0",
  unit: "piece",
  is_available: true,
  is_featured: false,
};

function getImageUrl(image) {
  if (!image) return null;

  if (image.startsWith("http")) {
    return image;
  }

  return `${API_BASE}${image.startsWith("/") ? "" : "/"}${image}`;
}

function getErrorMessage(error) {
  const data = error.response?.data;

  if (typeof data === "string") {
    return data;
  }

  if (data && typeof data === "object") {
    return Object.entries(data)
      .flatMap(([field, value]) => {
        const messages = Array.isArray(value) ? value : [value];

        return messages.map((message) => `${field}: ${message}`);
      })
      .join(" ");
  }

  return error.message || "Something went wrong.";
}

function ProductManagement() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [existingImage, setExistingImage] = useState(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Employees can view products and stock; managers and admins can change them.
  const canEdit = canManageStock(getCurrentRole());

  const [stockProduct, setStockProduct] = useState(null);
  const [detailsProduct, setDetailsProduct] = useState(null);
  const [stockForm, setStockForm] = useState(emptyStockForm);
  const [stockSaving, setStockSaving] = useState(false);
  const [stockError, setStockError] = useState("");

  // Out-of-stock and low-stock lists come from the backend, so they cover
  // every product, not just the first page loaded above.
  const [stockAlerts, setStockAlerts] = useState(null);
  const [stockView, setStockView] = useState("all");

  const accessToken = sessionStorage.getItem("accessToken");

  const getHeaders = useCallback(() => {
    return {
      Authorization: `Bearer ${sessionStorage.getItem("accessToken")}`,
    };
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [productsResponse, categoriesResponse, alertsResponse] = await Promise.all([
        axios.get(`${API_BASE}/api/products/`, {
          headers: getHeaders(),
          params: { page_size: 500 },
        }),
        axios.get(`${API_BASE}/api/categories/`, {
          headers: getHeaders(),
          params: { page_size: 500 },
        }),
        axios.get(`${API_BASE}/api/admin/stock-alerts/`, {
          headers: getHeaders(),
        }),
      ]);

      setStockAlerts(alertsResponse.data);

      setProducts(
        Array.isArray(productsResponse.data)
          ? productsResponse.data
          : productsResponse.data.results || []
      );

      setCategories(
        Array.isArray(categoriesResponse.data)
          ? categoriesResponse.data
          : categoriesResponse.data.results || []
      );
    } catch (err) {
      if (err.response?.status === 401) {
        setError("Your session has expired. Please sign in again.");
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    if (!accessToken) {
      navigate("/login", { replace: true });
      return;
    }

    fetchData();
  }, [accessToken, fetchData, navigate]);

  function openCreateModal() {
    setEditingId(null);
    setForm(emptyForm);
    setImageFile(null);
    setExistingImage(null);
    setError("");
    setNotice("");
    setModalOpen(true);
  }

  function openEditModal(product) {
    setEditingId(product.id);

    setForm({
      category: String(product.category || ""),
      name: product.name || "",
      slug: product.slug || "",
      description: product.description || "",
      price: String(product.price ?? ""),
      original_price: String(product.original_price ?? ""),
      stock: String(product.stock ?? 0),
      unit: product.unit || "piece",
      is_available: Boolean(product.is_available),
      is_featured: Boolean(product.is_featured),
    });

    setImageFile(null);
    setExistingImage(product.image || null);
    setError("");
    setNotice("");
    setModalOpen(true);
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function generateSlug(value) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const formData = new FormData();

      Object.entries(form).forEach(([key, value]) => {
        if (key === "original_price" && value === "") {
          return;
        }

        formData.append(key, String(value));
      });

      if (imageFile) {
        formData.append("image", imageFile);
      }

      const config = {
        headers: getHeaders(),
      };

      if (editingId) {
        await axios.patch(
          `${API_BASE}/api/products/${editingId}/`,
          formData,
          config
        );

        setNotice("Product updated successfully.");
      } else {
        await axios.post(
          `${API_BASE}/api/products/`,
          formData,
          config
        );

        setNotice("Product created successfully.");
      }

      setModalOpen(false);
      await fetchData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(product) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${product.name}"?`
    );

    if (!confirmed) return;

    setDeletingId(product.id);
    setError("");
    setNotice("");

    try {
      await axios.delete(
        `${API_BASE}/api/products/${product.id}/`,
        {
          headers: getHeaders(),
        }
      );

      setNotice("Product deleted successfully.");
      await fetchData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  function openStockModal(product, direction) {
    setStockProduct(product);
    setStockForm({ ...emptyStockForm, direction });
    setStockError("");
    setError("");
    setNotice("");
  }

  async function handleStockSubmit(event) {
    event.preventDefault();

    const quantity = Number(stockForm.quantity);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      setStockError("Enter a whole number greater than zero.");
      return;
    }

    setStockSaving(true);
    setStockError("");

    try {
      const change = stockForm.direction === "add" ? quantity : -quantity;

      const response = await axios.post(
        `${API_BASE}/api/products/${stockProduct.id}/adjust-stock/`,
        { change, note: stockForm.note.trim() },
        { headers: getHeaders() }
      );

      setProducts((previous) =>
        previous.map((product) =>
          product.id === response.data.id ? response.data : product
        )
      );

      const alertsResponse = await axios.get(
        `${API_BASE}/api/admin/stock-alerts/`,
        { headers: getHeaders() }
      );
      setStockAlerts(alertsResponse.data);

      setNotice(
        `${stockForm.direction === "add" ? "Added" : "Removed"} ${quantity} ` +
          `${quantity === 1 ? "unit" : "units"} ` +
          `${stockForm.direction === "add" ? "to" : "from"} ${stockProduct.name}. ` +
          `New stock: ${response.data.stock}.`
      );
      setStockProduct(null);
    } catch (err) {
      setStockError(err.response?.data?.detail || getErrorMessage(err));
    } finally {
      setStockSaving(false);
    }
  }

  const lowStockThreshold = stockAlerts?.low_stock_threshold ?? 5;

  const stockViews = [
    {
      key: "out",
      label: "Out of stock",
      description: "0 units left",
      count: stockAlerts?.out_of_stock_count,
      items: stockAlerts?.out_of_stock,
      icon: PackageX,
      activeClass: "border-red-300 bg-red-50",
      countClass: "text-red-600",
    },
    {
      key: "low",
      label: "Low stock",
      description: `Less than ${lowStockThreshold + 1} units left`,
      count: stockAlerts?.low_stock_count,
      items: stockAlerts?.low_stock,
      icon: AlertTriangle,
      activeClass: "border-amber-400 bg-amber-50",
      countClass: "text-green-700",
    },
  ];

  const selectedStockView = stockViews.find((view) => view.key === stockView);
  const visibleProducts = selectedStockView ? selectedStockView.items || [] : products;

  const filteredProducts = visibleProducts.filter((product) =>
    `${product.sku || ""} ${product.name} ${product.category_name || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const inputClass =
    "w-full rounded-lg border border-gray-200 cn-glass px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-yellow-500";

  const labelClass =
    "mb-2 block text-xs font-semibold text-gray-600";

  return (
    <div className="min-h-screen bg-transparent text-gray-900">
      {/* HEADER */}

      <header className="cn-band shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5">
          <div>
            <Link
              to="/admin/dashboard"
              className="inline-flex items-center gap-2 text-xs font-semibold text-yellow-300 hover:underline"
            >
              <ArrowLeft size={15} />
              Back to Dashboard
            </Link>

            <h1 className="mt-3 font-serif text-3xl sm:text-4xl">
              {canEdit ? "Product Management" : "Products & Stock"}
            </h1>

            <p className="mt-2 text-sm text-green-50/90">
              {canEdit
                ? "Curate and manage your CartNest product collection."
                : "Browse the CartNest product collection and current stock levels."}
            </p>
          </div>

          <Link
            to="/"
            className="hidden text-2xl font-semibold tracking-[-0.04em] sm:block"
          >
            cart<span className="text-yellow-300">nest</span>.
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-9">
        {/* ACTION BAR */}

        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green-700">
              Inventory
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              {selectedStockView ? `${selectedStockView.label} Products` : "All Products"}
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              {visibleProducts.length} products {selectedStockView ? "need restocking" : "loaded"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={fetchData}
              className="inline-flex items-center gap-2 border border-gray-200 cn-glass px-4 py-3 text-xs font-semibold hover:bg-green-100"
            >
              <RefreshCw size={16} />
              Refresh
            </button>

            {canEdit && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 cn-gradient-gold px-5 py-3 text-xs font-semibold text-gray-900 hover:bg-amber-500"
              >
                <Plus size={17} />
                Add Product
              </button>
            )}
          </div>
        </div>

        {!canEdit && (
          <div className="mb-6 flex items-center gap-3 border border-gray-200 bg-yellow-50 p-4 text-sm text-green-700">
            <Eye size={19} className="shrink-0" />
            View only. Ask a manager to add products or change stock.
          </div>
        )}

        {/* MESSAGES */}

        {notice && (
          <div
            role="status"
            className="mb-6 flex items-center gap-3 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
          >
            <CheckCircle2 size={19} />
            {notice}
          </div>
        )}

        {error && !modalOpen && (
          <div
            role="alert"
            className="mb-6 flex items-center gap-3 border border-red-200 bg-red-50 p-4 text-sm text-red-600"
          >
            <AlertCircle size={19} />
            {error}
          </div>
        )}

        {/* STOCK ALERTS */}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {stockViews.map((view) => {
            const Icon = view.icon;
            const active = stockView === view.key;

            return (
              <button
                key={view.key}
                type="button"
                onClick={() => setStockView(active ? "all" : view.key)}
                aria-pressed={active}
                className={`flex items-center justify-between gap-4 border p-5 text-left transition hover:border-gray-400 ${
                  active ? view.activeClass : "border-gray-200 cn-glass"
                }`}
              >
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Icon size={17} className={view.countClass} />
                    {view.label}
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    {view.description}
                    {" · "}
                    {active ? "Click to show all products" : "Click to view"}
                  </p>
                </div>

                <span className={`font-serif text-4xl ${view.count ? view.countClass : "text-gray-500"}`}>
                  {view.count ?? "—"}
                </span>
              </button>
            );
          })}
        </div>

        {/* SEARCH */}

        <div className="mb-6 border border-gray-200 cn-glass p-5">
          <div className="relative max-w-md">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
            />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by SKU, product or category..."
              className="w-full border border-gray-200 cn-glass-deep py-3 pl-11 pr-4 text-sm outline-none focus:border-yellow-500"
            />
          </div>
        </div>

        {/* PRODUCT TABLE */}

        <div className="overflow-x-auto border border-gray-200 cn-glass">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-gray-600">
              <Loader2 size={21} className="animate-spin" />
              Loading products...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
              <Package
                size={40}
                strokeWidth={1.3}
                className="text-gray-500"
              />

              <h3 className="mt-5 font-serif text-2xl">
                {selectedStockView && !search
                  ? `No ${selectedStockView.label.toLowerCase()} products`
                  : "No products found"}
              </h3>

              <p className="mt-2 text-sm text-gray-600">
                {selectedStockView && !search
                  ? "Every product is well stocked."
                  : "Add your first product or change the search."}
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[850px] text-left">
              <thead className="border-b border-gray-200 cn-glass-deep">
                <tr className="text-[11px] uppercase tracking-[0.12em] text-gray-600">
                  <th className="px-6 py-4 font-semibold">Product</th>
                  <th className="px-6 py-4 font-semibold">Category</th>
                  <th className="px-6 py-4 font-semibold">Price</th>
                  <th className="px-6 py-4 font-semibold">Stock</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="border-b border-gray-200 last:border-b-0"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <ProductThumb product={product} size="h-14 w-14" />

                        <div>
                          <p className="text-sm font-semibold">
                            {product.name}
                          </p>

                          <p className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700">
                              {product.sku}
                            </span>
                            {product.unit}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-600">
                      {product.category_name}
                    </td>

                    <td className="px-6 py-4 text-sm font-semibold">
                      ₹{product.price}
                    </td>

                    <td className="px-6 py-4 text-sm">
                      <span className={Number(product.stock) === 0 ? "text-red-600" : ""}>
                        {product.stock}
                      </span>

                      {Number(product.stock) === 0 && (
                        <span className="ml-2 text-[11px] text-red-600">
                          Out of stock
                        </span>
                      )}

                      {Number(product.stock) > 0 &&
                        Number(product.stock) <= lowStockThreshold && (
                          <span className="ml-2 text-[11px] text-green-700">
                            Low stock
                          </span>
                        )}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                          product.is_available
                            ? "bg-green-50 text-green-700"
                            : "bg-amber-50 text-red-600"
                        }`}
                      >
                        {product.is_available
                          ? "Available"
                          : "Unavailable"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailsProduct(product)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-semibold hover:bg-green-100"
                          aria-label={`View details of ${product.name}`}
                        >
                          <Eye size={16} />
                          Details
                        </button>

                        {canEdit && (
                        <>
                        <button
                          type="button"
                          onClick={() => openStockModal(product, "add")}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-semibold hover:bg-green-100"
                          aria-label={`Add or remove stock for ${product.name}`}
                        >
                          <PackagePlus size={16} />
                          Stock
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(product)}
                          className="rounded-lg border border-gray-200 p-2.5 hover:bg-green-100"
                          aria-label={`Edit ${product.name}`}
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(product)}
                          disabled={deletingId === product.id}
                          className="rounded-lg border border-red-200 p-2.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                          aria-label={`Delete ${product.name}`}
                        >
                          {deletingId === product.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                        </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* PRODUCT DETAILS */}

      {detailsProduct && (
        <ProductDetailsDialog
          product={detailsProduct}
          lowStockThreshold={lowStockThreshold}
          onClose={() => setDetailsProduct(null)}
        />
      )}

      {/* ADD / REMOVE STOCK MODAL */}

      {stockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <form
            role="dialog"
            aria-modal="true"
            aria-label={`Adjust stock for ${stockProduct.name}`}
            onSubmit={handleStockSubmit}
            className="w-full max-w-md cn-glass-deep shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-green-700">
                  Stock
                </p>

                <h2 className="mt-2 font-serif text-2xl">
                  {stockProduct.name}
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Currently in stock: {stockProduct.stock}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setStockProduct(null)}
                className="p-2"
                aria-label="Close stock form"
              >
                <X size={22} />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              {stockError && (
                <div
                  role="alert"
                  className="border border-red-200 bg-red-50 p-4 text-sm text-red-600"
                >
                  {stockError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {[
                  ["add", "Add stock"],
                  ["remove", "Remove stock"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setStockForm((previous) => ({ ...previous, direction: value }))
                    }
                    aria-pressed={stockForm.direction === value}
                    className={`border px-4 py-3 text-xs font-semibold transition ${
                      stockForm.direction === value
                        ? "border-yellow-400 cn-gradient-gold text-gray-900"
                        : "border-gray-200 text-gray-600 hover:bg-green-100"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div>
                <label htmlFor="stock-quantity" className={labelClass}>
                  Quantity *
                </label>

                <input
                  id="stock-quantity"
                  type="number"
                  min="1"
                  step="1"
                  max={stockForm.direction === "remove" ? stockProduct.stock : undefined}
                  value={stockForm.quantity}
                  onChange={(event) =>
                    setStockForm((previous) => ({ ...previous, quantity: event.target.value }))
                  }
                  required
                  autoFocus
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="stock-note" className={labelClass}>
                  Note
                </label>

                <input
                  id="stock-note"
                  maxLength={255}
                  value={stockForm.note}
                  onChange={(event) =>
                    setStockForm((previous) => ({ ...previous, note: event.target.value }))
                  }
                  placeholder={
                    stockForm.direction === "add"
                      ? "e.g. Supplier delivery"
                      : "e.g. Damaged or expired"
                  }
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 cn-glass px-6 py-5">
              <button
                type="button"
                onClick={() => setStockProduct(null)}
                className="border border-gray-200 px-5 py-3 text-xs font-semibold"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={stockSaving}
                className="flex items-center gap-2 cn-gradient-gold px-6 py-3 text-xs font-semibold text-gray-900 hover:bg-amber-500 disabled:opacity-60"
              >
                {stockSaving && <Loader2 size={16} className="animate-spin" />}
                {stockSaving
                  ? "Saving..."
                  : stockForm.direction === "add"
                  ? "Add stock"
                  : "Remove stock"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADD / EDIT MODAL */}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editingId ? "Edit product" : "Add product"}
            className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden cn-glass-deep shadow-2xl"
          >
            {/* MODAL HEADER */}

            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-green-700">
                  Product Collection
                </p>

                <h2 className="mt-2 font-serif text-3xl">
                  {editingId ? "Edit Product" : "Add New Product"}
                </h2>

                <p className="mt-1.5 text-xs text-gray-500">
                  {editingId ? (
                    <>
                      SKU{" "}
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-700">
                        {products.find((product) => product.id === editingId)?.sku}
                      </span>{" "}
                      · set automatically and can't be changed
                    </>
                  ) : (
                    "The SKU is generated automatically when you save."
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2"
                aria-label="Close form"
              >
                <X size={22} />
              </button>
            </div>

            {/* MODAL FORM */}

            <form
              id="product-form"
              onSubmit={handleSubmit}
              className="space-y-5 overflow-y-auto px-6 py-6"
            >
              {error && (
                <div
                  role="alert"
                  className="border border-red-200 bg-red-50 p-4 text-sm text-red-600"
                >
                  {error}
                </div>
              )}

              {/* NAME */}

              <div>
                <label htmlFor="product-name" className={labelClass}>
                  Product Name *
                </label>

                <input
                  id="product-name"
                  name="name"
                  value={form.name}
                  onChange={(event) => {
                    handleChange(event);

                    if (!editingId) {
                      setForm((previous) => ({
                        ...previous,
                        name: event.target.value,
                        slug: generateSlug(event.target.value),
                      }));
                    }
                  }}
                  required
                  placeholder="e.g. Organic Red Apples"
                  className={inputClass}
                />
              </div>

              {/* SLUG */}

              <div>
                <label htmlFor="product-slug" className={labelClass}>
                  Product Slug *
                </label>

                <input
                  id="product-slug"
                  name="slug"
                  value={form.slug}
                  onChange={handleChange}
                  required
                  placeholder="organic-red-apples"
                  className={inputClass}
                />
              </div>

              {/* CATEGORY */}

              <div>
                <label htmlFor="product-category" className={labelClass}>
                  Category *
                </label>

                <select
                  id="product-category"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  required
                  className={inputClass}
                >
                  <option value="">Select a category</option>

                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>

                {categories.length === 0 && (
                  <p className="mt-2 text-xs text-red-600">
                    Create a category in Django Admin before adding products.
                  </p>
                )}
              </div>

              {/* DESCRIPTION */}

              <div>
                <label htmlFor="product-description" className={labelClass}>
                  Description
                </label>

                <textarea
                  id="product-description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Describe the product..."
                  className={inputClass}
                />
              </div>

              {/* PRICE */}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="product-price" className={labelClass}>
                    Selling Price (₹) *
                  </label>

                  <input
                    id="product-price"
                    type="number"
                    name="price"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={handleChange}
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="product-original-price" className={labelClass}>
                    Original Price (₹)
                  </label>

                  <input
                    id="product-original-price"
                    type="number"
                    name="original_price"
                    min="0"
                    step="0.01"
                    value={form.original_price}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* STOCK AND UNIT */}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="product-stock" className={labelClass}>
                    Stock Quantity *
                  </label>

                  <input
                    id="product-stock"
                    type="number"
                    name="stock"
                    min="0"
                    step="1"
                    value={form.stock}
                    onChange={handleChange}
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="product-unit" className={labelClass}>
                    Unit *
                  </label>

                  <input
                    id="product-unit"
                    name="unit"
                    value={form.unit}
                    onChange={handleChange}
                    placeholder="e.g. 1 kg, 500 g, piece"
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              {/* IMAGE UPLOAD */}

              <div>
                <label htmlFor="product-image" className={labelClass}>
                  Product Image
                </label>

                <div className="border border-dashed border-gray-300 cn-glass p-5">
                  <div className="flex items-center gap-3">
                    <ImagePlus size={25} className="text-green-700" />

                    <input
                      id="product-image"
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        setImageFile(event.target.files?.[0] || null)
                      }
                      className="min-w-0 text-xs"
                    />
                  </div>

                  {existingImage && !imageFile && (
                    <img
                      src={getImageUrl(existingImage)}
                      alt="Current product"
                      className="mt-4 h-24 w-24 object-cover"
                    />
                  )}

                  {imageFile && (
                    <p className="mt-3 text-xs text-gray-600">
                      Selected: {imageFile.name}
                    </p>
                  )}
                </div>
              </div>

              {/* CHECKBOXES */}

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="is_available"
                    checked={form.is_available}
                    onChange={handleChange}
                    className="accent-yellow-500"
                  />
                  Available for sale
                </label>

                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="is_featured"
                    checked={form.is_featured}
                    onChange={handleChange}
                    className="accent-yellow-500"
                  />
                  Featured product
                </label>
              </div>
            </form>

            {/* MODAL FOOTER */}

            <div className="flex justify-end gap-3 border-t border-gray-200 cn-glass px-6 py-5">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="border border-gray-200 px-5 py-3 text-xs font-semibold"
              >
                Cancel
              </button>

              <button
                type="submit"
                form="product-form"
                disabled={saving}
                className="flex items-center gap-2 cn-gradient-gold px-6 py-3 text-xs font-semibold text-gray-900 hover:bg-amber-500 disabled:opacity-60"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}

                {saving
                  ? "Saving..."
                  : editingId
                  ? "Update Product"
                  : "Create Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductManagement;
