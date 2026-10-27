
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
  Tags,
  ImagePlus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { getCurrentRole } from "../lib/staffRoles";

const API_BASE = "http://127.0.0.1:8000";

const emptyForm = {
  name: "",
  slug: "",
  description: "",
  is_active: true,
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

  if (typeof data === "string") return data;

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

function generateSlug(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function CategoryManagement() {
  const navigate = useNavigate();

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

  const accessToken = sessionStorage.getItem("accessToken");

  const getHeaders = useCallback(() => {
    return {
      Authorization: `Bearer ${sessionStorage.getItem("accessToken")}`,
    };
  }, []);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await axios.get(
        `${API_BASE}/api/categories/`,
        { headers: getHeaders() }
      );

      const data = response.data;

      setCategories(
        Array.isArray(data) ? data : data.results || []
      );
    } catch (err) {
      if (err.response?.status === 401) {
        setError("Your session has expired. Please log in again.");
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

    fetchCategories();
  }, [accessToken, fetchCategories, navigate]);

  function openCreateModal() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setImageFile(null);
    setExistingImage(null);
    setError("");
    setNotice("");
    setModalOpen(true);
  }

  function openEditModal(category) {
    setEditingId(category.id);

    setForm({
      name: category.name || "",
      slug: category.slug || "",
      description: category.description || "",
      is_active: Boolean(category.is_active),
    });

    setImageFile(null);
    setExistingImage(category.image || null);
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

  function handleNameChange(event) {
    const name = event.target.value;

    setForm((previous) => ({
      ...previous,
      name,
      slug: editingId ? previous.slug : generateSlug(name),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const formData = new FormData();

      Object.entries(form).forEach(([key, value]) => {
        formData.append(key, String(value));
      });

      if (imageFile) {
        formData.append("image", imageFile);
      }

      const config = { headers: getHeaders() };

      if (editingId) {
        await axios.patch(
          `${API_BASE}/api/categories/${editingId}/`,
          formData,
          config
        );

        setNotice("Category updated successfully.");
      } else {
        await axios.post(
          `${API_BASE}/api/categories/`,
          formData,
          config
        );

        setNotice("Category created successfully.");
      }

      setModalOpen(false);
      await fetchCategories();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(category) {
    const confirmed = window.confirm(
      `Delete "${category.name}"? Products linked to this category may also be affected.`
    );

    if (!confirmed) return;

    setDeletingId(category.id);
    setError("");
    setNotice("");

    try {
      await axios.delete(
        `${API_BASE}/api/categories/${category.id}/`,
        { headers: getHeaders() }
      );

      setNotice("Category deleted successfully.");
      await fetchCategories();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  const filteredCategories = categories.filter((category) =>
    `${category.name} ${category.description || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const inputClass =
    "w-full rounded-lg border border-gray-200 cn-glass px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-yellow-500";

  const labelClass =
    "mb-2 block text-xs font-semibold text-gray-600";

  // Only admins can change categories; managers and employees can view them.
  const canEdit = getCurrentRole() === "admin";

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
              {canEdit ? "Category Management" : "Categories"}
            </h1>

            <p className="mt-2 text-sm text-green-50/90">
              Organize the collections in your CartNest store.
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
              Collections
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              All Categories
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              {categories.length} categories loaded
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={fetchCategories}
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
                Add Category
              </button>
            )}
          </div>
        </div>

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
              placeholder="Search categories..."
              className="w-full border border-gray-200 cn-glass-deep py-3 pl-11 pr-4 text-sm outline-none focus:border-yellow-500"
            />
          </div>
        </div>

        {/* CATEGORY TABLE */}

        <div className="overflow-x-auto border border-gray-200 cn-glass">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-gray-600">
              <Loader2 size={21} className="animate-spin" />
              Loading categories...
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
              <Tags
                size={40}
                strokeWidth={1.3}
                className="text-gray-500"
              />

              <h3 className="mt-5 font-serif text-2xl">
                No categories found
              </h3>

              <p className="mt-2 text-sm text-gray-600">
                Add your first category or change the search.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[700px] text-left">
              <thead className="border-b border-gray-200 cn-glass-deep">
                <tr className="text-[11px] uppercase tracking-[0.12em] text-gray-600">
                  <th className="px-6 py-4 font-semibold">Category</th>
                  <th className="px-6 py-4 font-semibold">Slug</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  {canEdit && (
                    <th className="px-6 py-4 text-right font-semibold">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {filteredCategories.map((category) => (
                  <tr
                    key={category.id}
                    className="border-b border-gray-200 last:border-b-0"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        {category.image ? (
                          <img
                            src={getImageUrl(category.image)}
                            alt={category.name}
                            className="h-14 w-14 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-green-50">
                            <Tags
                              size={23}
                              className="text-gray-600"
                            />
                          </div>
                        )}

                        <div>
                          <p className="text-sm font-semibold">
                            {category.name}
                          </p>

                          <p className="mt-1 max-w-xs truncate text-xs text-gray-500">
                            {category.description || "No description"}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-600">
                      {category.slug}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                          category.is_active
                            ? "bg-green-50 text-green-700"
                            : "bg-amber-50 text-red-600"
                        }`}
                      >
                        {category.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {canEdit && (
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(category)}
                          className="rounded-lg border border-gray-200 p-2.5 hover:bg-green-100"
                          aria-label={`Edit ${category.name}`}
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(category)}
                          disabled={deletingId === category.id}
                          className="rounded-lg border border-red-200 p-2.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                          aria-label={`Delete ${category.name}`}
                        >
                          {deletingId === category.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* ADD / EDIT MODAL */}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editingId ? "Edit category" : "Add category"}
            className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden cn-glass-deep shadow-2xl"
          >
            {/* MODAL HEADER */}

            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-green-700">
                  Store Collections
                </p>

                <h2 className="mt-2 font-serif text-3xl">
                  {editingId ? "Edit Category" : "Add New Category"}
                </h2>
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
              id="category-form"
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

              {/* CATEGORY NAME */}

              <div>
                <label htmlFor="category-name" className={labelClass}>
                  Category Name *
                </label>

                <input
                  id="category-name"
                  name="name"
                  value={form.name}
                  onChange={handleNameChange}
                  required
                  placeholder="e.g. Fresh Produce"
                  className={inputClass}
                />
              </div>

              {/* SLUG */}

              <div>
                <label htmlFor="category-slug" className={labelClass}>
                  Category Slug *
                </label>

                <input
                  id="category-slug"
                  name="slug"
                  value={form.slug}
                  onChange={handleChange}
                  required
                  placeholder="fresh-produce"
                  className={inputClass}
                />
              </div>

              {/* DESCRIPTION */}

              <div>
                <label htmlFor="category-description" className={labelClass}>
                  Description
                </label>

                <textarea
                  id="category-description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Describe this category..."
                  className={inputClass}
                />
              </div>

              {/* IMAGE UPLOAD */}

              <div>
                <label htmlFor="category-image" className={labelClass}>
                  Category Image
                </label>

                <div className="border border-dashed border-gray-300 cn-glass p-5">
                  <div className="flex items-center gap-3">
                    <ImagePlus size={25} className="text-green-700" />

                    <input
                      id="category-image"
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
                      alt="Current category"
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

              {/* ACTIVE STATUS */}

              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={form.is_active}
                  onChange={handleChange}
                  className="accent-yellow-500"
                />
                Category is active
              </label>
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
                form="category-form"
                disabled={saving}
                className="flex items-center gap-2 cn-gradient-gold px-6 py-3 text-xs font-semibold text-gray-900 hover:bg-amber-500 disabled:opacity-60"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}

                {saving
                  ? "Saving..."
                  : editingId
                  ? "Update Category"
                  : "Create Category"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CategoryManagement;
