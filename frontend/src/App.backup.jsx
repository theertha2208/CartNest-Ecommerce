
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ShoppingBag,
  Package,
  Search,
  UserRound,
  Menu,
  ArrowRight,
  Truck,
  ShieldCheck,
  Headphones,
  Heart,
  Plus,
  Minus,
  LogOut,
  LayoutDashboard,
  X,
  ChevronRight,
  Sparkles,
  Leaf,
  RefreshCw,
  ImageOff,
  Trash2,
  Star,
} from "lucide-react";

// ==========================================
// API CONFIGURATION
// ==========================================

const API_BASE = "http://127.0.0.1:8000";

function getImageUrl(image) {
  if (!image) return null;

  if (
    image.startsWith("http://") ||
    image.startsWith("https://")
  ) {
    return image;
  }

  return `${API_BASE}${image.startsWith("/") ? "" : "/"}${image}`;
}

function getResults(data) {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.results) ? data.results : [];
}

function formatPrice(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getStoredUser() {
  try {
    const token = sessionStorage.getItem("accessToken");
    const storedUser = sessionStorage.getItem("user");

    if (!token || !storedUser) return null;

    return JSON.parse(storedUser);
  } catch {
    return null;
  }
}

function getErrorMessage(data, fallback) {
  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (typeof data?.non_field_errors?.[0] === "string") {
    return data.non_field_errors[0];
  }

  const firstError = Object.values(data || {})[0];

  if (Array.isArray(firstError) && firstError.length) {
    return String(firstError[0]);
  }

  return fallback;
}

// ==========================================
// HOMEPAGE
// ==========================================

function App() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState([]);
  const [wishlistItems, setWishlistItems] = useState({});
  const [wishlistBusyId, setWishlistBusyId] = useState(null);
  const [wishlistError, setWishlistError] = useState("");
  const [wishlistMessage, setWishlistMessage] = useState("");
  const wishlistBusyRef = useRef(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [reviewSummaries, setReviewSummaries] = useState({});
  const [selectedReviewProduct, setSelectedReviewProduct] = useState(null);
  const [reviewDetails, setReviewDetails] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [user, setUser] = useState(getStoredUser);

  // Cart data is now loaded from Django.
  const [cart, setCart] = useState([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartBusy, setCartBusy] = useState(false);
  const [cartError, setCartError] = useState("");
  const [cartMessage, setCartMessage] = useState("");

  const cartBusyRef = useRef(false);

  const isAdmin = user?.role === "admin";

  // ==========================================
  // FETCH PRODUCTS AND CATEGORIES
  // ==========================================

  async function fetchStoreData(signal) {
    setLoading(true);
    setError("");

    try {
      const [categoryResponse, productResponse] =
        await Promise.all([
          fetch(`${API_BASE}/api/categories/`, { signal }),
          fetch(`${API_BASE}/api/products/`, { signal }),
        ]);

      if (!categoryResponse.ok || !productResponse.ok) {
        throw new Error(
          "Unable to load products. Please check your Django server."
        );
      }

      const [categoryData, productData] =
        await Promise.all([
          categoryResponse.json(),
          productResponse.json(),
        ]);

      if (signal?.aborted) return;

      setCategories(
        getResults(categoryData).filter(
          (category) => category.is_active
        )
      );

      setProducts(
        getResults(productData)
          .filter(
            (product) =>
              product.is_available &&
              Number(product.stock) > 0
          )
          .map((product) => ({
            id: product.id,
            name: product.name,
            category: product.category_name || "Other",
            categoryId: product.category,
            unit: product.unit || "",
            price: Number(product.price),
            originalPrice:
              product.original_price == null ||
              product.original_price === ""
                ? null
                : Number(product.original_price),
            image: getImageUrl(product.image),
            stock: Number(product.stock),
            featured: Boolean(product.is_featured),
            discount: Number(
              product.discount_percentage || 0
            ),
            tag: product.is_featured
              ? "FEATURED"
              : "FRESH PICK",
          }))
      );
    } catch (err) {
      if (err.name === "AbortError") return;

      console.error("Store loading error:", err);

      setError(
        err.message || "Unable to load products."
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    fetchStoreData(controller.signal);

    return () => controller.abort();
  }, []);

  // ==========================================
  // PUBLIC PRODUCT REVIEWS
  // ==========================================

  useEffect(() => {
    if (!products.length) return;
    let cancelled = false;

    async function loadReviewSummaries() {
      const results = await Promise.all(
        products.map(async (product) => {
          try {
            const response = await fetch(
              `${API_BASE}/api/products/${product.id}/reviews/`
            );
            if (!response.ok) return null;
            const data = await response.json();
            return [product.id, {
              average_rating: Number(data.average_rating || 0),
              review_count: Number(data.review_count || 0),
            }];
          } catch {
            return null;
          }
        })
      );
      if (!cancelled) {
        setReviewSummaries(Object.fromEntries(results.filter(Boolean)));
      }
    }

    loadReviewSummaries();
    return () => { cancelled = true; };
  }, [products]);

  async function openProductReviews(product) {
    setSelectedReviewProduct(product);
    setReviewDetails(null);
    setReviewError("");
    setReviewLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/products/${product.id}/reviews/`
      );
      if (!response.ok) throw new Error("Could not load product reviews.");
      setReviewDetails(await response.json());
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setReviewLoading(false);
    }
  }

  // ==========================================
  // AUTHENTICATED API REQUESTS
  // ==========================================

  async function authenticatedRequest(
    endpoint,
    options = {}
  ) {
    let accessToken =
      sessionStorage.getItem("accessToken");

    if (!accessToken) {
      throw new Error("Please sign in to continue.");
    }

    async function sendRequest(token) {
      return fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      });
    }

    let response = await sendRequest(accessToken);

    // Try refreshing an expired access token.
    if (response.status === 401) {
      const refreshToken =
        sessionStorage.getItem("refreshToken");

      if (refreshToken) {
        const refreshResponse = await fetch(
          `${API_BASE}/api/auth/refresh/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              refresh: refreshToken,
            }),
          }
        );

        if (refreshResponse.ok) {
          const refreshData =
            await refreshResponse.json();

          accessToken = refreshData.access;

          sessionStorage.setItem(
            "accessToken",
            accessToken
          );

          if (refreshData.refresh) {
            sessionStorage.setItem(
              "refreshToken",
              refreshData.refresh
            );
          }

          response = await sendRequest(accessToken);
        }
      }
    }

    const data = await response.json().catch(
      () => ({})
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      throw new Error(
        getErrorMessage(
          data,
          "Something went wrong. Please try again."
        )
      );
    }

    return data;
  }

  // ==========================================
  // CONVERT DJANGO CART ITEMS
  // ==========================================

  function normalizeCart(data) {
    return (data.items || []).map((item) => ({
      cartItemId: item.id,
      id: item.product_id,
      name: item.product_name,
      image: getImageUrl(item.product_image),
      price: Number(item.product_price || 0),
      stock: Number(item.product_stock || 0),
      unit: item.product_unit || "",
      quantity: Number(item.quantity || 0),
      subtotal: Number(item.subtotal || 0),
    }));
  }

  // ==========================================
  // LOAD SAVED CART
  // ==========================================

  async function loadCart() {
    if (!user) {
      setCart([]);
      return;
    }

    setCartLoading(true);
    setCartError("");

    try {
      const data = await authenticatedRequest(
        "/api/cart/"
      );

      setCart(normalizeCart(data));
    } catch (err) {
      console.error("Cart loading error:", err);
      setCartError(err.message);
    } finally {
      setCartLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      loadCart();
    } else {
      setCart([]);
    }
  }, [user?.id, user?.username]);

  // ==========================================
  // CART MUTATION HELPER
  // ==========================================

  async function updateCart(endpoint, options) {
    if (cartBusyRef.current) return false;

    cartBusyRef.current = true;
    setCartBusy(true);
    setCartError("");
    setCartMessage("");

    try {
      const data = await authenticatedRequest(
        endpoint,
        options
      );

      setCart(normalizeCart(data));

      return true;
    } catch (err) {
      console.error("Cart update error:", err);
      setCartError(err.message);
      setCartOpen(true);

      return false;
    } finally {
      cartBusyRef.current = false;
      setCartBusy(false);
    }
  }

  // ==========================================
  // ADD PRODUCT TO CART
  // ==========================================

  async function addToCart(product) {
    if (!user) {
      navigate("/login");
      return;
    }

    const success = await updateCart(
      "/api/cart/add/",
      {
        method: "POST",
        body: JSON.stringify({
          product_id: product.id,
          quantity: 1,
        }),
      }
    );

    if (success) {
      setCartMessage("Product added to your bag.");
      setCartOpen(true);
    }
  }

  // ==========================================
  // CHANGE CART ITEM QUANTITY
  // ==========================================

  async function changeQuantity(item, newQuantity) {
    if (newQuantity <= 0) {
      await removeFromCart(item);
      return;
    }

    await updateCart(
      `/api/cart/items/${item.cartItemId}/`,
      {
        method: "PATCH",
        body: JSON.stringify({
          quantity: newQuantity,
        }),
      }
    );
  }

  // ==========================================
  // REMOVE CART ITEM
  // ==========================================

  async function removeFromCart(item) {
    await updateCart(
      `/api/cart/items/${item.cartItemId}/remove/`,
      {
        method: "DELETE",
      }
    );
  }

  // ==========================================
  // CLEAR CART
  // ==========================================

  async function clearCart() {
    const success = await updateCart(
      "/api/cart/clear/",
      {
        method: "DELETE",
      }
    );

    if (success) {
      setCartMessage("Your shopping bag is empty.");
    }
  }

  // ==========================================
  // CART TOTALS
  // ==========================================

  const cartCount = cart.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const cartTotal = cart.reduce(
    (total, item) =>
      total + item.price * item.quantity,
    0
  );

  async function handleCartClick() {
    if (!user) {
      navigate("/login");
      return;
    }

    setCartOpen(true);
    await loadCart();
  }

  // ==========================================
  // PRODUCT FILTERING
  // ==========================================

  const filteredProducts = products.filter(
    (product) => {
      const matchesSearch =
        `${product.name} ${product.category}`
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesCategory =
        selectedCategory === "All" ||
        product.category === selectedCategory;

      return matchesSearch && matchesCategory;
    }
  );

  // ==========================================
  // WISHLIST - LOAD SAVED PRODUCTS FROM DJANGO
  // ==========================================

  useEffect(() => {
    if (!user || isAdmin) {
      setFavorites([]);
      setWishlistItems({});
      setWishlistError("");
      return;
    }

    let cancelled = false;

    async function loadWishlist() {
      try {
        const data = await authenticatedRequest("/api/wishlist/");
        if (cancelled) return;

        const saved = getResults(data);
        const lookup = {};

        for (const item of saved) {
          const productId = Number(
            item.product?.id ?? item.product_id
          );
          if (Number.isFinite(productId)) {
            lookup[productId] = item.id;
          }
        }

        setWishlistItems(lookup);
        setFavorites(Object.keys(lookup).map(Number));
        setWishlistError("");
      } catch (err) {
        if (!cancelled) {
          setWishlistError(err.message);
        }
      }
    }

    loadWishlist();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.username, isAdmin]);

  // ==========================================
  // WISHLIST - ADD OR REMOVE A PRODUCT
  // ==========================================

  async function toggleFavorite(productId) {
    if (!user) {
      navigate("/login");
      return;
    }

    if (isAdmin || wishlistBusyRef.current) return;

    wishlistBusyRef.current = true;
    setWishlistBusyId(productId);
    setWishlistError("");
    setWishlistMessage("");

    try {
      const savedItemId = wishlistItems[productId];

      if (savedItemId != null) {
        await authenticatedRequest(
          `/api/wishlist/${savedItemId}/`,
          { method: "DELETE" }
        );

        setWishlistItems((previous) => {
          const next = { ...previous };
          delete next[productId];
          return next;
        });
        setFavorites((previous) =>
          previous.filter((id) => id !== productId)
        );
        setWishlistMessage("Product removed from your wishlist.");
      } else {
        const data = await authenticatedRequest("/api/wishlist/", {
          method: "POST",
          body: JSON.stringify({ product_id: productId }),
        });

        const itemId = data.item?.id;
        if (itemId == null) {
          throw new Error("Wishlist saved, but its item ID was not returned. Refresh the page.");
        }

        setWishlistItems((previous) => ({
          ...previous,
          [productId]: itemId,
        }));
        setFavorites((previous) =>
          previous.includes(productId)
            ? previous
            : [...previous, productId]
        );
        setWishlistMessage("Product added to your wishlist.");
      }
    } catch (err) {
      setWishlistError(err.message);
    } finally {
      wishlistBusyRef.current = false;
      setWishlistBusyId(null);
    }
  }

  // ==========================================
  // LOGOUT
  // ==========================================

  async function handleLogout() {
    const refreshToken =
      sessionStorage.getItem("refreshToken");

    const accessToken =
      sessionStorage.getItem("accessToken");

    if (refreshToken) {
      try {
        await fetch(
          `${API_BASE}/api/auth/logout/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(accessToken
                ? {
                    Authorization:
                      `Bearer ${accessToken}`,
                  }
                : {}),
            },
            body: JSON.stringify({
              refresh: refreshToken,
            }),
          }
        );
      } catch (err) {
        console.error("Logout error:", err);
      }
    }

    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("refreshToken");
    sessionStorage.removeItem("user");

    setUser(null);
    setCart([]);
    setFavorites([]);
    setWishlistItems({});
    setWishlistError("");
    setWishlistMessage("");
    setCartOpen(false);
    setMobileMenuOpen(false);
    setCartError("");
    setCartMessage("");

    navigate("/");
  }

  // ==========================================
  // NAVIGATION
  // ==========================================

  function scrollToProducts(category = "All") {
    setSelectedCategory(category);

    document
      .getElementById("products")
      ?.scrollIntoView({
        behavior: "smooth",
      });
  }

  function handleAdminClick() {
    setMobileMenuOpen(false);
    navigate("/admin/dashboard");
  }

  // ==========================================
  // RENDER HOMEPAGE
  // ==========================================

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#292D29]">
      {/* ANNOUNCEMENT BAR */}

      <div className="bg-[#173E31] px-4 py-2.5 text-center text-[11px] font-medium tracking-[0.12em] text-white sm:text-xs">
        FRESH GROCERIES, MADE EASY
        <span className="mx-3 text-[#C8AC78]">
          ✦
        </span>
        FREE DELIVERY ABOVE ₹499
      </div>

      {/* HEADER */}

      <header className="sticky top-0 z-40 border-b border-[#E8E4DB] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-5 lg:px-8">
          <Link
            to="/"
            className="shrink-0 text-[27px] font-semibold tracking-[-0.07em] text-[#173E31]"
          >
            cart
            <span className="text-[#F07836]">
              nest
            </span>
            <span className="text-[#F07836]">
              .
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-[13px] font-medium text-[#555B53] lg:flex">
            <button
              type="button"
              onClick={() => scrollToProducts()}
              className="transition hover:text-[#F07836]"
            >
              Shop
            </button>

            {categories
              .slice(0, 2)
              .map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() =>
                    scrollToProducts(category.name)
                  }
                  className="transition hover:text-[#F07836]"
                >
                  {category.name}
                </button>
              ))}

            <a
              href="#our-story"
              className="transition hover:text-[#F07836]"
            >
              Our Story
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-4">
            {user ? (
              <>
                <div className="hidden items-center gap-2 text-sm md:flex">
                  <UserRound
                    size={19}
                    strokeWidth={1.6}
                  />

                  <span className="font-medium">
                    {user.first_name ||
                      user.username}
                  </span>
                </div>

                {!isAdmin && (
                  <div className="hidden items-center gap-4 lg:flex">
                    <Link
                      to="/wishlist"
                      className="flex items-center gap-2 text-sm transition hover:text-[#F07836]"
                    >
                      <Heart size={18} strokeWidth={1.6} />
                      My Wishlist
                    </Link>
                    <Link
                      to="/orders"
                      className="flex items-center gap-2 text-sm transition hover:text-[#F07836]"
                    >
                      <Package size={18} strokeWidth={1.6} />
                      My Orders
                    </Link>
                    <Link
                      to="/profile"
                      className="flex items-center gap-2 text-sm transition hover:text-[#F07836]"
                    >
                      <UserRound size={18} strokeWidth={1.6} />
                      My Profile
                    </Link>
                  </div>
                )}

                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleAdminClick}
                    className="hidden items-center gap-2 rounded-full border border-[#D8D0C0] px-4 py-2.5 text-xs font-semibold transition hover:bg-[#EDE7DA] md:flex"
                  >
                    <LayoutDashboard size={16} />
                    Dashboard
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="hidden items-center gap-2 text-sm transition hover:text-[#F07836] sm:flex"
                >
                  <LogOut
                    size={18}
                    strokeWidth={1.6}
                  />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="flex items-center gap-2 text-sm font-medium transition hover:text-[#F07836]"
                >
                  <UserRound
                    size={20}
                    strokeWidth={1.6}
                  />

                  <span className="hidden sm:inline">
                    Sign in
                  </span>
                </Link>

                <Link
                  to="/register"
                  className="hidden rounded-full bg-[#173E31] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#F07836] md:inline-flex"
                >
                  Join us
                </Link>
              </>
            )}

            {/* SHOPPING BAG */}

            <button
              type="button"
              onClick={handleCartClick}
              className="relative rounded-full p-2 transition hover:bg-[#EDE7DA]"
              aria-label="Open cart"
            >
              <ShoppingBag
                size={22}
                strokeWidth={1.6}
              />

              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F07836] px-1 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                setMobileMenuOpen(
                  !mobileMenuOpen
                )
              }
              className="rounded-full p-2 lg:hidden"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X size={22} />
              ) : (
                <Menu size={22} />
              )}
            </button>
          </div>
        </div>

        {/* MOBILE MENU */}

        {mobileMenuOpen && (
          <div className="border-t border-[#E8E4DB] bg-[#FFFFFF] px-6 py-5 lg:hidden">
            <div className="flex flex-col gap-5 text-sm font-medium">
              <button
                type="button"
                onClick={() => {
                  scrollToProducts();
                  setMobileMenuOpen(false);
                }}
                className="text-left"
              >
                Shop All
              </button>

              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => {
                    scrollToProducts(
                      category.name
                    );
                    setMobileMenuOpen(false);
                  }}
                  className="text-left"
                >
                  {category.name}
                </button>
              ))}

              <a
                href="#our-story"
                onClick={() =>
                  setMobileMenuOpen(false)
                }
              >
                Our Story
              </a>

              {user ? (
                <>
                  <span>
                    Hello,{" "}
                    {user.first_name ||
                      user.username}
                  </span>

                  {!isAdmin && (
                    <>
                      <Link
                        to="/wishlist"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2"
                      >
                        <Heart size={18} />
                        My Wishlist
                      </Link>
                      <Link
                        to="/orders"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2"
                      >
                        <Package size={18} />
                        My Orders
                      </Link>
                      <Link
                        to="/profile"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2"
                      >
                        <UserRound size={18} />
                        My Profile
                      </Link>
                    </>
                  )}

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={handleAdminClick}
                      className="flex items-center gap-2 text-left"
                    >
                      <LayoutDashboard
                        size={18}
                      />
                      Admin Dashboard
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-left"
                  >
                    <LogOut size={18} />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() =>
                      setMobileMenuOpen(false)
                    }
                  >
                    Sign in
                  </Link>

                  <Link
                    to="/register"
                    onClick={() =>
                      setMobileMenuOpen(false)
                    }
                  >
                    Create an account
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main>
        {/* PRODUCTS */}

        <section
          id="products"
          className="scroll-mt-36 bg-white pb-12 pt-5 sm:pt-7"
        >
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="mb-5 flex flex-col gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#E56E32]">
                  FRESH PICKS • EVERY DAY
                </p>

                <h2 className="mt-4 font-serif text-4xl text-[#173E31] sm:text-5xl">
                  Shop groceries
                </h2>

                <p className="mt-4 text-sm text-[#81837A]">
                  Fresh groceries, happier days. Everything you need, just a few clicks away.
                </p>
              </div>

              <div className="relative w-full">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[#92948B]"
                />

                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search fruits, vegetables, groceries..."
                  className="w-full border border-[#DCD8CE] bg-[#FFFFFF] py-3.5 pl-12 pr-4 text-sm outline-none transition focus:border-[#F07836]"
                />
              </div>
            </div>

            {/* CATEGORY FILTERS */}

            <div className="mb-6 flex flex-wrap gap-2">
              {[
                "All",
                ...categories.map(
                  (item) => item.name
                ),
              ].map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() =>
                    setSelectedCategory(
                      category
                    )
                  }
                  className={`border px-5 py-2.5 text-xs font-medium transition ${
                    selectedCategory === category
                      ? "border-[#173E31] bg-[#173E31] text-white"
                      : "border-[#DCD8CE] bg-transparent text-[#666B62] hover:border-[#173E31]"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {wishlistError && (
              <p role="alert" className="mb-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Wishlist: {wishlistError}
              </p>
            )}
            {wishlistMessage && !wishlistError && (
              <p role="status" className="mb-5 border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                {wishlistMessage} <Link to="/wishlist" className="font-semibold underline">View wishlist</Link>
              </p>
            )}

            {loading ? (
              <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-[#81837A]">
                <RefreshCw
                  size={20}
                  className="animate-spin"
                />
                Loading products...
              </div>
            ) : error ? (
              <div className="border border-[#E4E0D6] bg-[#FFFFFF] px-6 py-16 text-center">
                <p className="font-serif text-2xl">
                  We couldn't load the collection
                </p>

                <p className="mt-3 text-sm text-[#81837A]">
                  {error}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    fetchStoreData()
                  }
                  className="mt-6 inline-flex items-center gap-2 border-b border-[#173E31] pb-2 text-sm font-semibold"
                >
                  <RefreshCw size={16} />
                  Try again
                </button>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="border border-[#E4E0D6] bg-[#FFFFFF] px-6 py-16 text-center">
                <Search
                  size={28}
                  className="mx-auto text-[#E56E32]"
                />

                <p className="mt-4 font-serif text-2xl">
                  No products found
                </p>

                <p className="mt-2 text-sm text-[#81837A]">
                  {products.length === 0
                    ? "Products will appear here when they are available."
                    : "Try another search or category."}
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSelectedCategory("All");
                  }}
                  className="mt-6 text-sm font-semibold underline underline-offset-4"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">
                {filteredProducts.map(
                  (product) => {
                    const quantityInCart =
                      cart.find(
                        (item) =>
                          item.id ===
                          product.id
                      )?.quantity || 0;

                    return (
                      <article
                        key={product.id}
                        className="group bg-[#FFFFFF]"
                      >
                        <div className="relative aspect-[4/4.5] overflow-hidden bg-[#E8E4DB]">
                          {product.image ? (
                            <img
                              src={
                                product.image
                              }
                              alt={
                                product.name
                              }
                              loading="lazy"
                              className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-3 text-[#A6A89F]">
                              <ImageOff
                                size={35}
                                strokeWidth={
                                  1.3
                                }
                              />
                              <span className="text-xs">
                                Image coming
                                soon
                              </span>
                            </div>
                          )}

                          {product.featured && (
                            <span className="absolute left-4 top-4 bg-[#FFFFFF] px-3 py-2 text-[9px] font-semibold tracking-[0.12em] text-[#173E31]">
                              {product.tag}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              toggleFavorite(
                                product.id
                              )
                            }
                            aria-label={`${favorites.includes(product.id) ? "Remove" : "Add"} ${product.name} ${favorites.includes(product.id) ? "from" : "to"} wishlist`}
                            aria-pressed={favorites.includes(product.id)}
                            disabled={wishlistBusyId !== null || isAdmin}
                            title={isAdmin ? "Wishlist is for customers" : "Save to wishlist"}
                            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#FFFFFF] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Heart
                              size={17}
                              strokeWidth={
                                1.6
                              }
                              color="#173E31"
                              fill={
                                favorites.includes(
                                  product.id
                                )
                                  ? "#F07836"
                                  : "none"
                              }
                            />
                          </button>
                        </div>

                        <div className="px-5 pb-5 pt-6">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-[#E56E32]">
                            {
                              product.category
                            }
                          </p>

                          <h3 className="mt-3 font-serif text-[22px] leading-tight text-[#173E31]">
                            {product.name}
                          </h3>

                          <p className="mt-2 text-xs text-[#8A8B82]">
                            {product.unit}
                          </p>

                          <button
                            type="button"
                            onClick={() => openProductReviews(product)}
                            className="mt-3 flex items-center gap-2 text-xs text-[#776B52] hover:text-[#173E31]"
                            aria-label={`Read reviews for ${product.name}`}
                          >
                            <Star size={15} fill={reviewSummaries[product.id]?.review_count ? "#F07836" : "none"} color="#F07836" />
                            <span>
                              {reviewSummaries[product.id]?.review_count
                                ? `${reviewSummaries[product.id].average_rating.toFixed(1)} (${reviewSummaries[product.id].review_count} reviews)`
                                : "No reviews yet"}
                            </span>
                            <span className="underline underline-offset-2">View reviews</span>
                          </button>

                          <div className="mt-5 flex items-center gap-3">
                            <span className="text-lg font-semibold">
                              ₹
                              {formatPrice(
                                product.price
                              )}
                            </span>

                            {product.originalPrice !==
                              null &&
                              product.originalPrice >
                                product.price && (
                                <span className="text-sm text-[#AAA99F] line-through">
                                  ₹
                                  {formatPrice(
                                    product.originalPrice
                                  )}
                                </span>
                              )}
                          </div>

                          {product.discount >
                            0 && (
                            <p className="mt-2 text-xs font-semibold text-[#64845E]">
                              {
                                product.discount
                              }
                              % off
                            </p>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              addToCart(
                                product
                              )
                            }
                            disabled={
                              cartBusy ||
                              quantityInCart >=
                                product.stock
                            }
                            className="mt-6 flex w-full items-center justify-center gap-3 border border-[#173E31] bg-[#173E31] px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:border-[#F07836] hover:bg-[#F07836] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {cartBusy ? (
                              <RefreshCw
                                size={16}
                                className="animate-spin"
                              />
                            ) : (
                              <Plus
                                size={16}
                              />
                            )}

                            {quantityInCart >=
                            product.stock
                              ? "Maximum quantity"
                              : "Add to bag"}
                          </button>
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </div>
        </section>

        {/* OUR STORY */}

        <section
          id="our-story"
          className="mx-auto grid max-w-7xl gap-12 px-5 py-24 lg:grid-cols-2 lg:items-center lg:gap-20 lg:px-8"
        >
          <div className="aspect-[5/4] overflow-hidden bg-[#E8E4DB]">
            <img
              src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=85"
              alt="Fresh market produce"
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>

          <div>
            <div className="mb-6 flex items-center gap-3">
              <span className="h-px w-8 bg-[#F07836]" />

              <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#E56E32]">
                The CartNest philosophy
              </span>
            </div>

            <h2 className="font-serif text-4xl leading-[1.2] tracking-[-0.03em] text-[#173E31] sm:text-5xl">
              Good living begins
              <br />
              with{" "}
              <span className="italic">
                good choices.
              </span>
            </h2>

            <p className="mt-7 max-w-lg text-[15px] leading-8 text-[#77796F]">
              We believe the things you bring into
              your home should feel as good as they
              look. From fresh ingredients to
              thoughtful everyday essentials,
              CartNest makes discovering quality a
              pleasure.
            </p>

            <div className="mt-9 flex items-center gap-3 text-sm font-medium text-[#173E31]">
              <Sparkles
                size={18}
                className="text-[#F07836]"
              />
              Curated for the everyday
            </div>

            <button
              type="button"
              onClick={() =>
                scrollToProducts()
              }
              className="mt-10 inline-flex items-center gap-3 border-b border-[#173E31] pb-2 text-xs font-semibold uppercase tracking-[0.15em] transition hover:text-[#F07836]"
            >
              Discover our products
              <ArrowRight size={17} />
            </button>
          </div>
        </section>

        {/* BENEFITS */}

        <section className="border-b border-[#E8E4DB]">
          <div className="mx-auto grid max-w-7xl gap-8 px-6 py-9 md:grid-cols-3 lg:px-8">
            {[
              {
                icon: Truck,
                title: "Thoughtful delivery",
                description:
                  "Carefully packed, right to your door",
              },
              {
                icon: ShieldCheck,
                title: "Quality comes first",
                description:
                  "Only products we'd choose ourselves",
              },
              {
                icon: Headphones,
                title: "Here to help",
                description:
                  "Personal support when you need it",
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="flex items-center justify-center gap-4 md:justify-start"
                >
                  <Icon
                    size={27}
                    strokeWidth={1.3}
                    className="text-[#E56E32]"
                  />

                  <div>
                    <p className="text-[13px] font-semibold">
                      {item.title}
                    </p>

                    <p className="mt-1 text-xs text-[#8A8B82]">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* CATEGORY SECTION */}

        <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="mb-11 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#E56E32]">
                Explore our world
              </p>

              <h2 className="mt-4 font-serif text-4xl tracking-[-0.025em] text-[#173E31] sm:text-5xl">
                Shop by category
              </h2>
            </div>

            <button
              type="button"
              onClick={() =>
                scrollToProducts()
              }
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#173E31] hover:text-[#F07836]"
            >
              View all products
              <ArrowRight size={16} />
            </button>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-[#81837A]">
              Loading categories...
            </div>
          ) : categories.length === 0 ? (
            <div className="border border-[#E4E0D6] bg-white px-6 py-12 text-center">
              <Leaf
                size={36}
                className="mx-auto text-[#E56E32]"
              />

              <p className="mt-4 font-serif text-2xl">
                Categories coming soon
              </p>

              <p className="mt-2 text-sm text-[#81837A]">
                Our collections will appear here
                once added.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:gap-6">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() =>
                    scrollToProducts(
                      category.name
                    )
                  }
                  className="group text-left"
                >
                  <div className="aspect-[4/4.7] overflow-hidden bg-[#EAE7DF]">
                    {category.image ? (
                      <img
                        src={getImageUrl(
                          category.image
                        )}
                        alt={category.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Leaf
                          size={40}
                          strokeWidth={1.2}
                          className="text-[#9AAB94]"
                        />
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-serif text-xl text-[#173E31]">
                        {category.name}
                      </h3>

                      <p className="mt-1 text-xs text-[#92948B]">
                        {category.description ||
                          "Thoughtfully selected"}
                      </p>
                    </div>

                    <ChevronRight
                      size={19}
                      className="shrink-0 text-[#F07836] transition group-hover:translate-x-1"
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* PROMOTIONAL SECTION */}

        <section className="bg-[#173E31] px-5 py-20 text-center text-white">
          <div className="mx-auto max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#C8AC78]">
              A little something special
            </p>

            <h2 className="mt-6 font-serif text-4xl leading-tight sm:text-5xl">
              Beautiful things,
              <br />
              delivered daily.
            </h2>

            <p className="mx-auto mt-6 max-w-md text-sm leading-7 text-[#C9D0C7]">
              Discover fresh favorites and
              considered essentials for the moments
              that matter.
            </p>

            <button
              type="button"
              onClick={() =>
                scrollToProducts()
              }
              className="mt-9 inline-flex items-center gap-4 bg-[#FFFFFF] px-8 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#173E31] transition hover:bg-[#C8AC78]"
            >
              Shop the collection
              <ArrowRight size={17} />
            </button>
          </div>
        </section>
      </main>

      {/* FOOTER */}

      <footer className="bg-[#F0EEE7] px-5 py-14">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-3 lg:px-3">
          <div>
            <Link
              to="/"
              className="text-3xl font-semibold tracking-[-0.07em] text-[#173E31]"
            >
              cart
              <span className="text-[#F07836]">
                nest
              </span>
              .
            </Link>

            <p className="mt-5 max-w-xs text-sm leading-7 text-[#77796F]">
              Thoughtful essentials for beautiful
              everyday living.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.17em]">
              Explore
            </h3>

            <div className="mt-5 flex flex-col gap-3 text-sm text-[#77796F]">
              <button
                type="button"
                onClick={() =>
                  scrollToProducts()
                }
                className="text-left hover:text-[#F07836]"
              >
                Shop all
              </button>

              {categories
                .slice(0, 2)
                .map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() =>
                      scrollToProducts(
                        category.name
                      )
                    }
                    className="text-left hover:text-[#F07836]"
                  >
                    {category.name}
                  </button>
                ))}

              <a
                href="#our-story"
                className="hover:text-[#F07836]"
              >
                Our Story
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.17em]">
              {user && !isAdmin ? "Your Account" : "Connect"}
            </h3>

            {user && !isAdmin ? (
              <div className="mt-5 flex flex-col gap-3 text-sm text-[#77796F]">
                <Link to="/wishlist" className="hover:text-[#F07836]">
                  My Wishlist
                </Link>
                <Link to="/orders" className="hover:text-[#F07836]">
                  My Orders & Tracking
                </Link>
                <Link to="/profile" className="hover:text-[#F07836]">
                  My Profile & Addresses
                </Link>
              </div>
            ) : (
              <p className="mt-5 text-sm leading-7 text-[#77796F]">
                Stay close to the good things.
              </p>
            )}
          </div>
        </div>

        <div className="mx-auto mt-14 flex max-w-7xl flex-col justify-between gap-3 border-t border-[#DCD8CE] pt-7 text-xs text-[#92948B] sm:flex-row">
          <p>
            © {new Date().getFullYear()} CartNest.
            All rights reserved.
          </p>

          <p>
            Considered shopping. Everyday joy.
          </p>
        </div>
      </footer>

      {/* PRODUCT REVIEWS DIALOG */}
      {selectedReviewProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close reviews"
            onClick={() => setSelectedReviewProduct(null)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`Reviews for ${selectedReviewProduct.name}`}
            className="relative max-h-[85vh] w-full max-w-xl overflow-y-auto bg-[#FFFFFF] p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#F07836]">
                  Customer experiences
                </p>
                <h2 className="mt-2 font-serif text-3xl text-[#173E31]">
                  {selectedReviewProduct.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReviewProduct(null)}
                aria-label="Close reviews"
                className="p-2 text-[#173E31]"
              >
                <X size={22} />
              </button>
            </div>
            {reviewLoading ? (
              <p className="mt-8 text-sm text-[#77796F]">Loading reviews...</p>
            ) : reviewError ? (
              <p role="alert" className="mt-8 text-sm text-red-700">{reviewError}</p>
            ) : reviewDetails ? (
              <>
                <div className="mt-7 flex items-center gap-3 border-b border-[#E8E4DB] pb-6">
                  <Star size={23} color="#F07836" fill="#F07836" />
                  <span className="text-2xl font-semibold text-[#173E31]">
                    {Number(reviewDetails.average_rating || 0).toFixed(1)}
                  </span>
                  <span className="text-sm text-[#77796F]">
                    ({reviewDetails.review_count || 0} reviews)
                  </span>
                </div>
                {Array.isArray(reviewDetails.reviews) && reviewDetails.reviews.length ? (
                  <div className="divide-y divide-[#E8E4DB]">
                    {reviewDetails.reviews.map((item) => (
                      <div key={item.id} className="py-5">
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }, (_, index) => (
                            <Star
                              key={index}
                              size={15}
                              color="#F07836"
                              fill={index < Number(item.rating) ? "#F07836" : "none"}
                            />
                          ))}
                        </div>
                        <p className="mt-2 text-sm font-semibold text-[#173E31]">
                          {item.customer_name || item.username || "Customer"}
                        </p>
                        {item.is_verified_purchase && (
                          <p className="mt-1 text-xs text-[#54744D]">Verified purchase</p>
                        )}
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#555B53]">
                          {item.review || item.comment || ""}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-10 text-center text-sm text-[#77796F]">
                    No reviews yet. Be the first to share your experience after delivery.
                  </p>
                )}
              </>
            ) : null}
          </section>
        </div>
      )}

      {/* =======================================
          SHOPPING CART DRAWER
      ======================================= */}

      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            onClick={() =>
              setCartOpen(false)
            }
            className="absolute inset-0 bg-black/45"
            aria-label="Close shopping bag"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Shopping bag"
            className="relative flex h-full w-full max-w-md flex-col bg-[#FFFFFF] shadow-2xl"
          >
            {/* DRAWER HEADER */}

            <div className="flex items-center justify-between border-b border-[#E8E4DB] px-7 py-6">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#E56E32]">
                  Your selection
                </p>

                <h2 className="mt-2 font-serif text-3xl">
                  Shopping bag ({cartCount})
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setCartOpen(false)
                }
                aria-label="Close cart"
                className="p-2"
              >
                <X size={23} />
              </button>
            </div>

            {/* ERROR AND SUCCESS MESSAGES */}

            {cartError && (
              <div
                role="alert"
                className="mx-7 mt-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {cartError}
              </div>
            )}

            {cartMessage && !cartError && (
              <div
                role="status"
                className="mx-7 mt-5 border border-[#D7E2D1] bg-[#EDF4E9] px-4 py-3 text-sm text-[#41603D]"
              >
                {cartMessage}
              </div>
            )}

            {/* CART ITEMS */}

            <div className="flex-1 overflow-y-auto px-7 py-6">
              {cartLoading ? (
                <div className="flex h-full items-center justify-center gap-3 text-sm text-[#8A8B82]">
                  <RefreshCw
                    size={20}
                    className="animate-spin"
                  />
                  Loading your bag...
                </div>
              ) : cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <ShoppingBag
                    size={45}
                    strokeWidth={1.2}
                    className="text-[#F07836]"
                  />

                  <p className="mt-5 font-serif text-2xl">
                    Your bag is empty
                  </p>

                  <p className="mt-3 text-sm text-[#8A8B82]">
                    Beautiful things are waiting to
                    be discovered.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setCartOpen(false)
                    }
                    className="mt-7 border-b border-[#173E31] pb-2 text-sm font-medium"
                  >
                    Continue shopping
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {cart.map((item) => (
                    <div
                      key={item.cartItemId}
                      className="flex gap-4 border-b border-[#E8E4DB] pb-6"
                    >
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-24 w-24 shrink-0 object-cover"
                        />
                      ) : (
                        <div className="flex h-24 w-24 shrink-0 items-center justify-center bg-[#E8E4DB]">
                          <ImageOff
                            size={24}
                            className="text-[#A6A89F]"
                          />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-serif text-lg">
                            {item.name}
                          </h3>

                          <button
                            type="button"
                            onClick={() =>
                              removeFromCart(
                                item
                              )
                            }
                            disabled={cartBusy}
                            aria-label={`Remove ${item.name}`}
                            className="p-1 text-[#9B9D94] transition hover:text-red-600 disabled:opacity-40"
                          >
                            <Trash2
                              size={17}
                            />
                          </button>
                        </div>

                        <p className="mt-1 text-xs text-[#8A8B82]">
                          {item.unit}
                        </p>

                        <p className="mt-2 text-sm font-semibold">
                          ₹
                          {formatPrice(
                            item.price *
                              item.quantity
                          )}
                        </p>

                        <div className="mt-3 inline-flex items-center border border-[#DCD8CE]">
                          <button
                            type="button"
                            onClick={() =>
                              changeQuantity(
                                item,
                                item.quantity -
                                  1
                              )
                            }
                            disabled={cartBusy}
                            className="px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Decrease ${item.name} quantity`}
                          >
                            <Minus
                              size={14}
                            />
                          </button>

                          <span className="px-3 text-xs font-semibold">
                            {item.quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              changeQuantity(
                                item,
                                item.quantity +
                                  1
                              )
                            }
                            disabled={
                              cartBusy ||
                              item.quantity >=
                                item.stock
                            }
                            className="px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Increase ${item.name} quantity`}
                          >
                            <Plus
                              size={14}
                            />
                          </button>
                        </div>

                        {item.quantity >=
                          item.stock && (
                          <p className="mt-2 text-[11px] text-[#E56E32]">
                            Maximum available
                            quantity
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={clearCart}
                    disabled={cartBusy}
                    className="flex items-center gap-2 text-xs font-medium text-[#9A6B5A] transition hover:text-red-700 disabled:opacity-40"
                  >
                    <Trash2 size={15} />
                    Clear shopping bag
                  </button>
                </div>
              )}
            </div>

            {/* CART FOOTER */}

            {cart.length > 0 && (
              <div className="border-t border-[#E8E4DB] px-7 py-7">
                <div className="flex justify-between font-semibold">
                  <span>Subtotal</span>

                  <span>
                    ₹{formatPrice(cartTotal)}
                  </span>
                </div>

                <p className="mt-3 text-xs text-[#8A8B82]">
                  Delivery and other charges will be
                  calculated at checkout.
                </p>

                <button
  type="button"
  onClick={() => {
    if (cartBusy || cartLoading || cart.length === 0) {
      return;
    }

    setCartOpen(false);
    navigate("/checkout");
  }}
  disabled={cartBusy || cartLoading}
  className="mt-6 flex w-full items-center justify-center gap-3 bg-[#173E31] px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-[#F07836] disabled:cursor-not-allowed disabled:opacity-50"
>
  Proceed to checkout
  <ArrowRight size={16} />
</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
