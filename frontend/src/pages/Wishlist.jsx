
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Heart,
  ShoppingBag,
  Trash2,
  Loader2,
  PackageX,
  Check,
  X,
} from "lucide-react";
import CustomerHeader, { CustomerFooter } from "../components/CustomerHeader";
import { getProductImageUrl, isDemoImage } from "../lib/productImages";

const API_BASE = "http://127.0.0.1:8000";

async function authenticatedRequest(path, options = {}) {
  let token = sessionStorage.getItem("accessToken");

  const sendRequest = (accessToken) =>
    fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });

  let response = await sendRequest(token);

  if (response.status === 401) {
    const refreshToken = sessionStorage.getItem("refreshToken");

    if (!refreshToken) {
      throw new Error("Please log in to continue.");
    }

    const refreshResponse = await fetch(
      `${API_BASE}/api/auth/refresh/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh: refreshToken }),
      }
    );

    if (!refreshResponse.ok) {
      sessionStorage.removeItem("accessToken");
      sessionStorage.removeItem("refreshToken");
      throw new Error("Your session has expired. Please log in again.");
    }

    const refreshed = await refreshResponse.json();
    token = refreshed.access;
    sessionStorage.setItem("accessToken", token);

    if (refreshed.refresh) {
      sessionStorage.setItem("refreshToken", refreshed.refresh);
    }

    response = await sendRequest(token);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    throw new Error(
      errorData.detail ||
        "Something went wrong. Please try again."
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// Product id -> quantity in the cart, from a cart API response.
function cartQuantities(cart) {
  return Object.fromEntries(
    (cart?.items || []).map((item) => [item.product_id, Number(item.quantity || 0)])
  );
}

function Wishlist() {
  const [items, setItems] = useState([]);
  const [inCart, setInCart] = useState({});
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadWishlist() {
    try {
      setLoading(true);
      setError("");

      const data = await authenticatedRequest("/api/wishlist/");

      setItems(
        Array.isArray(data) ? data : data.results || []
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWishlist();

    // Which wishlist products are already in the cart.
    authenticatedRequest("/api/cart/")
      .then((cart) => setInCart(cartQuantities(cart)))
      .catch(() => {});

    return () => clearTimeout(toastTimer.current);
  }, []);

  function showToast(text) {
    clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => setToast(""), 4000);
  }

  async function removeItem(itemId) {
    try {
      setBusyId(itemId);
      setError("");
      setMessage("");

      await authenticatedRequest(
        `/api/wishlist/${itemId}/`,
        { method: "DELETE" }
      );

      setItems((previous) =>
        previous.filter((item) => item.id !== itemId)
      );

      setMessage("Product removed from your wishlist.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function addToCart(item) {
    try {
      setBusyId(item.id);
      setError("");
      setMessage("");

      const cart = await authenticatedRequest("/api/cart/add/", {
        method: "POST",
        body: JSON.stringify({
          product_id: item.product.id,
          quantity: 1,
        }),
      });

      // Stay on the wishlist: mark the product as in the cart and confirm.
      setInCart(cartQuantities(cart));
      showToast(`${item.product.name} added to your cart.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const formatPrice = (value) =>
    `₹${Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="min-h-screen">
      <CustomerHeader />

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">

        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold text-amber-600">
              Your Favourites
            </p>

            <h1 className="text-3xl font-semibold text-gray-900 sm:text-4xl">
              My Wishlist
            </h1>

            <p className="mt-2 text-sm text-gray-600">
              Your favourite products, all in one place.
            </p>
          </div>

          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-red-600">
            <Heart size={25} fill="currentColor" />
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-green-700">
            <Loader2 className="animate-spin" size={24} />
            Loading your wishlist...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 cn-glass px-6 py-16 text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full cn-glass-deep">
              <PackageX size={35} className="text-amber-600" />
            </div>

            <h2 className="text-2xl font-semibold text-gray-900">
              Your wishlist is empty
            </h2>

            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-gray-600">
              Discover something you love and save it to your
              wishlist. Your favourites will appear here.
            </p>

            <Link
  to="/"
  className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl cn-gradient-gold px-6 py-3 text-sm font-semibold !text-gray-900 transition hover:bg-yellow-500 hover:!text-gray-900"
>
  <ShoppingBag size={18} />
  Explore Products
</Link>
          </div>
        ) : (
          <>
            <p className="mb-5 text-sm text-gray-600">
              {items.length} saved{" "}
              {items.length === 1 ? "product" : "products"}
            </p>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => {
                const product = item.product;
                const busy = busyId === item.id;
                const quantityInCart = inCart[product.id] || 0;
                const atMax = quantityInCart >= Number(product.stock);
                const inStock =
                  product.in_stock &&
                  product.stock > 0;

                const imageUrl = getProductImageUrl(product.image, product.name);

                return (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-2xl border border-gray-200 cn-glass shadow-sm transition hover:shadow-md"
                  >
                    <div className="relative flex h-52 items-center justify-center overflow-hidden bg-white">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={product.name}
                          className={`h-full w-full object-contain ${
                            isDemoImage(imageUrl) ? "scale-[1.9]" : "p-5"
                          }`}
                        />
                      ) : (
                        <ShoppingBag
                          size={48}
                          className="text-amber-600"
                        />
                      )}

                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        disabled={busy}
                        title="Remove from wishlist"
                        className="absolute right-3 top-3 rounded-full cn-glass p-2.5 text-red-600 shadow-sm transition hover:bg-red-50 disabled:opacity-50"
                      >
                        {busy ? (
                          <Loader2
                            size={19}
                            className="animate-spin"
                          />
                        ) : (
                          <Trash2 size={19} />
                        )}
                      </button>
                    </div>

                    <div className="p-5">
                      <p className="mb-2 text-xs font-medium text-amber-600">
                        {product.category_name}
                      </p>

                      <h3 className="text-lg font-semibold text-gray-900">
                        {product.name}
                      </h3>

                      <p className="mt-1 text-sm text-gray-600">
                        Per {product.unit}
                      </p>

                      <div className="mt-4 flex items-center gap-3">
                        <span className="text-xl font-bold text-gray-900">
                          {formatPrice(product.price)}
                        </span>

                        {product.original_price &&
                          Number(product.original_price) >
                            Number(product.price) && (
                            <span className="text-sm text-gray-500 line-through">
                              {formatPrice(product.original_price)}
                            </span>
                          )}
                      </div>

                      <p
                        className={`mt-3 text-xs font-medium ${
                          inStock
                            ? "text-emerald-700"
                            : "text-red-600"
                        }`}
                      >
                        {inStock ? "In Stock" : "Out of Stock"}
                      </p>

                      {quantityInCart > 0 ? (
                        <button
                          type="button"
                          onClick={() => addToCart(item)}
                          disabled={busy || atMax}
                          title={atMax ? "No more stock available" : "Add one more"}
                          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-green-600 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-800 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                          In cart ({quantityInCart})
                          {!atMax && <span className="font-normal text-green-700">· Add 1 more</span>}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addToCart(item)}
                          disabled={busy || !inStock}
                          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl cn-gradient-gold px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                          {busy ? (
                            <Loader2
                              size={18}
                              className="animate-spin"
                            />
                          ) : (
                            <ShoppingBag size={18} />
                          )}

                          {inStock ? "Add to Cart" : "Unavailable"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <CustomerFooter />

      {/* "Added to cart" confirmation, visible wherever the page is scrolled */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 flex w-[min(92vw,440px)] -translate-x-1/2 items-center gap-3 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-2xl"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500">
            <Check size={16} />
          </span>
          <span className="flex-1">{toast}</span>
          <Link
            to="/"
            state={{ openCart: true }}
            className="shrink-0 rounded-lg bg-yellow-400 px-3 py-1.5 text-xs font-bold text-gray-900 hover:bg-yellow-300"
          >
            View cart
          </Link>
          <button
            type="button"
            onClick={() => setToast("")}
            aria-label="Dismiss"
            className="shrink-0 rounded p-1 text-gray-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export default Wishlist;
