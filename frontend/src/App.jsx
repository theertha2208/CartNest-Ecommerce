
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ShoppingCart,
  Package,
  Search,
  UserRound,
  Menu,
  ArrowRight,
  Truck,
  ShieldCheck,
  Heart,
  Plus,
  Minus,
  LogOut,
  LayoutDashboard,
  X,
  ChevronDown,
  Leaf,
  RefreshCw,
  ImageOff,
  Trash2,
  Star,
  Eye,
  Wallet,
  RotateCcw,
  BadgePercent,
  SlidersHorizontal,
} from "lucide-react";
import AdminNotificationBell from "./components/AdminNotificationBell";
import StoreLogo from "./components/StoreLogo";
import Pagination from "./components/Pagination";
import { getImageUrl, getProductImageUrl, isDemoImage } from "./lib/productImages";
import { canSeeAllOrders, isStaffRole } from "./lib/staffRoles";

// ==========================================
// API CONFIGURATION
// ==========================================

const API_BASE = "http://127.0.0.1:8000";

// Products shown per page on the store.
const PRODUCTS_PER_PAGE = 12;

// Local cover photos for the store categories.
// Django-uploaded category images still take priority when available.
const DEMO_CATEGORY_SLUGS = new Set([
  "bakery",
  "beverages",
  "dairy-eggs",
  "fresh-fruits",
  "fresh-vegetables",
  "fruits",
  "home-essentials",
  "rice-grains",
  "snacks",
  "vegetables",
]);

function getCategoryImageUrl(category) {
  const djangoImage = getImageUrl(category.image);
  if (djangoImage) return djangoImage;

  const slug = String(category.slug || category.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return DEMO_CATEGORY_SLUGS.has(slug)
    ? `/cartnest-categories/${slug}.jpg`
    : null;
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

  // Other pages (e.g. the wishlist) can send shoppers here with their cart
  // open: navigate("/", { state: { openCart: true, cartMessage: "..." } }).
  const location = useLocation();
  const openCartOnArrival = Boolean(location.state?.openCart);

  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState([]);
  const [wishlistItems, setWishlistItems] = useState({});
  const [wishlistBusyId, setWishlistBusyId] = useState(null);
  const [wishlistError, setWishlistError] = useState("");
  const [wishlistMessage, setWishlistMessage] = useState("");
  const wishlistBusyRef = useRef(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(openCartOnArrival);
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
  const [cartMessage, setCartMessage] = useState(
    openCartOnArrival ? location.state?.cartMessage || "" : ""
  );

  // Forget the "open cart" request so a page refresh doesn't reopen it.
  useEffect(() => {
    if (openCartOnArrival) {
      window.history.replaceState({}, "");
    }
  }, [openCartOnArrival]);

  const cartBusyRef = useRef(false);

  // Admins, managers and employees can browse the store but not buy.
  const isStaff = isStaffRole(user?.role);
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
          fetch(`${API_BASE}/api/categories/?page_size=500`, { signal }),
          fetch(`${API_BASE}/api/products/?page_size=500`, { signal }),
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
            image: getProductImageUrl(product.image, product.name),
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
      image: getProductImageUrl(item.product_image, item.product_name),
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

    // Admins can browse the store but not buy.
    if (isStaff) return;

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
    if (!user || isStaff) {
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
  }, [user?.id, user?.username, isStaff]);

  // ==========================================
  // WISHLIST - ADD OR REMOVE A PRODUCT
  // ==========================================

  async function toggleFavorite(productId) {
    if (!user) {
      navigate("/login");
      return;
    }

    if (isStaff || wishlistBusyRef.current) return;

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
  // SORTING, ACCOUNT MENU AND DERIVED VALUES
  // ==========================================

  const [sortBy, setSortBy] = useState("relevance");
  const [accountOpen, setAccountOpen] = useState(false);
  const accountMenuRef = useRef(null);

  // Close the account menu when clicking anywhere else.
  useEffect(() => {
    if (!accountOpen) return;

    function handlePointerDown(event) {
      if (!accountMenuRef.current?.contains(event.target)) {
        setAccountOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [accountOpen]);

  const SORTERS = {
    relevance: (a, b) => Number(b.featured) - Number(a.featured),
    "price-low": (a, b) => a.price - b.price,
    "price-high": (a, b) => b.price - a.price,
    discount: (a, b) => b.discount - a.discount,
    rating: (a, b) =>
      (reviewSummaries[b.id]?.average_rating || 0) -
      (reviewSummaries[a.id]?.average_rating || 0),
  };

  const sortedProducts = [...filteredProducts].sort(
    SORTERS[sortBy] || SORTERS.relevance
  );

  // ==========================================
  // PAGINATION (12 PRODUCTS PER PAGE)
  // ==========================================

  // The page is stored together with the filters it belongs to. Whenever
  // search, category or sort changes, it goes back to page 1 straight away
  // (React's "adjust state when inputs change" pattern, no effect needed).
  const filterKey = `${search.trim()}|${selectedCategory}|${sortBy}`;
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });

  if (pageState.key !== filterKey) {
    setPageState({ key: filterKey, page: 1 });
  }

  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / PRODUCTS_PER_PAGE));
  const currentPage = Math.min(
    pageState.key === filterKey ? pageState.page : 1,
    totalPages
  );
  const pageStart = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const pageProducts = sortedProducts.slice(pageStart, pageStart + PRODUCTS_PER_PAGE);

  function goToPage(page) {
    setPageState({ key: filterKey, page });
    document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
  }

  const cartByProduct = Object.fromEntries(
    cart.map((item) => [item.id, item])
  );

  const productCountByCategory = products.reduce((counts, product) => {
    counts[product.category] = (counts[product.category] || 0) + 1;
    return counts;
  }, {});

  // What the customer saves against the listed MRP.
  const cartSavings = cart.reduce((total, item) => {
    const product = products.find((entry) => entry.id === item.id);
    if (!product?.originalPrice || product.originalPrice <= item.price) {
      return total;
    }
    return total + (product.originalPrice - item.price) * item.quantity;
  }, 0);

  const displayName = user?.first_name || user?.username || "";
  const browsing = search.trim() === "" && selectedCategory === "All";

  const accountLinks = [
    { to: "/orders", label: "My Orders", icon: Package },
    { to: "/wishlist", label: "My Wishlist", icon: Heart },
    { to: "/profile", label: "My Profile", icon: UserRound },
  ];

  const promises = [
    { icon: Wallet, title: "Cash on delivery", text: "Pay when your order arrives" },
    { icon: Leaf, title: "Fresh & quality", text: "Picked and packed with care" },
    { icon: RotateCcw, title: "Easy cancellation", text: "Cancel any time before shipping" },
  ];

  function chooseCategory(category) {
    setMobileMenuOpen(false);
    scrollToProducts(category);
  }

  // ==========================================
  // RENDER HOMEPAGE
  // ==========================================

  return (
    <div className="cn-light min-h-screen">
      {/* TOP STRIP */}

      <div className="bg-gray-900 text-xs text-gray-200">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <p className="flex items-center gap-2">
            <Wallet size={14} className="text-yellow-400" />
            Cash on delivery available
            <span className="hidden text-gray-500 sm:inline">|</span>
            <span className="hidden sm:inline">Cancel any time before shipping</span>
          </p>
          <p className="hidden md:block">Fresh groceries & everyday essentials</p>
        </div>
      </div>

      {/* HEADER */}

      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 lg:hidden"
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <StoreLogo />

          {/* Search (desktop) */}
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="hidden flex-1 md:flex"
          >
            <div className="relative flex w-full">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search for fruits, vegetables, snacks and more"
                aria-label="Search products"
                className="w-full rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 py-2.5 pl-11 pr-4 text-sm outline-none transition focus:border-yellow-500 focus:bg-white"
              />
              <button
                type="submit"
                className="rounded-r-lg bg-yellow-400 px-5 text-sm font-semibold text-gray-900 transition hover:bg-yellow-500"
              >
                Search
              </button>
            </div>
          </form>

          {/* Actions */}
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {user ? (
              <div className="relative" ref={accountMenuRef}>
                <button
                  type="button"
                  onClick={() => setAccountOpen(!accountOpen)}
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-gray-800 hover:bg-gray-100 sm:px-3"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100 text-sm font-bold text-yellow-800">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden text-left leading-tight sm:block">
                    <span className="block text-[11px] text-gray-500">Hello,</span>
                    <span className="block max-w-28 truncate font-semibold">{displayName}</span>
                  </span>
                  <ChevronDown size={16} className="hidden text-gray-500 sm:block" />
                </button>

                {accountOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1.5 shadow-xl"
                  >
                    {isStaff ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleAdminClick}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-yellow-50"
                      >
                        <LayoutDashboard size={17} />
                        {isAdmin ? "Admin Dashboard" : user?.role === "manager" ? "Manager Dashboard" : "Staff Dashboard"}
                      </button>
                    ) : (
                      accountLinks.map(({ to, label, icon: Icon }) => (
                        <Link
                          key={to}
                          to={to}
                          role="menuitem"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-yellow-50"
                        >
                          <Icon size={17} />
                          {label}
                        </Link>
                      ))
                    )}

                    <div className="my-1.5 border-t border-gray-100" />

                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-yellow-50"
                    >
                      <LogOut size={17} />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100"
              >
                <UserRound size={19} />
                <span className="hidden sm:inline">Login</span>
              </Link>
            )}

            {canSeeAllOrders(user?.role) && <AdminNotificationBell />}

            {!isStaff && (
              <Link
                to={user ? "/wishlist" : "/login"}
                className="relative hidden rounded-lg p-2.5 text-gray-700 hover:bg-gray-100 sm:block"
                aria-label="Wishlist"
              >
                <Heart size={21} />
                {favorites.length > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {favorites.length}
                  </span>
                )}
              </Link>
            )}

            {/* CART (customers only) */}
            {!isStaff && (
              <button
                type="button"
                onClick={handleCartClick}
                aria-label={`Open cart, ${cartCount} items`}
                className="flex items-center gap-2 rounded-lg bg-yellow-400 px-3 py-2 text-sm font-bold text-gray-900 shadow-sm transition hover:bg-yellow-500 sm:px-4 sm:py-2.5"
              >
                <ShoppingCart size={19} />
                {cartCount > 0 ? (
                  <span className="leading-tight">
                    <span className="block text-[11px] font-semibold">{cartCount} {cartCount === 1 ? "item" : "items"}</span>
                    <span className="hidden sm:block">₹{formatPrice(cartTotal)}</span>
                  </span>
                ) : (
                  <span className="hidden sm:inline">My Cart</span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Search (mobile) */}
        <div className="px-4 pb-3 md:hidden">
          <div className="relative">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products"
              aria-label="Search products"
              className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-yellow-500 focus:bg-white"
            />
          </div>
        </div>

        {/* Category bar */}
        <nav className="hidden border-t border-gray-100 lg:block" aria-label="Categories">
          <div className="cn-no-scrollbar mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6 py-1.5">
            {["All", ...categories.map((item) => item.name)].map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => chooseCategory(category)}
                className={`shrink-0 rounded-md px-3 py-1.5 text-sm transition ${
                  selectedCategory === category
                    ? "bg-yellow-100 font-semibold text-gray-900"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {category === "All" ? "All products" : category}
              </button>
            ))}
          </div>
        </nav>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="border-t border-gray-200 bg-white px-4 py-3 lg:hidden">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Categories</p>
            <div className="grid grid-cols-2 gap-1">
              {["All", ...categories.map((item) => item.name)].map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => chooseCategory(category)}
                  className={`rounded-md px-2 py-2 text-left text-sm ${
                    selectedCategory === category ? "bg-yellow-100 font-semibold" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {category === "All" ? "All products" : category}
                </button>
              ))}
            </div>

            {user && !isStaff && (
              <div className="mt-3 border-t border-gray-100 pt-3">
                {accountLinks.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-md px-2 py-2.5 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Icon size={17} />
                    {label}
                  </Link>
                ))}
              </div>
            )}

            {!user && (
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-3 block rounded-lg bg-yellow-400 px-3 py-2.5 text-center text-sm font-semibold text-gray-900"
              >
                Create an account
              </Link>
            )}
          </div>
        )}
      </header>

      {/* STAFF VIEW-ONLY NOTICE */}

      {isStaff && (
        <div className="border-b border-yellow-200 bg-yellow-50">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-6">
            <p className="flex items-center gap-2 text-yellow-900">
              <Eye size={16} className="shrink-0" />
              You're viewing the store as {isAdmin ? "an admin" : `a ${user.role}`}. Purchasing is turned off for staff accounts.
            </p>
            <button
              type="button"
              onClick={handleAdminClick}
              className="inline-flex items-center gap-1 font-semibold text-yellow-900 underline-offset-4 hover:underline"
            >
              Back to dashboard
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      <main>
        {/* HERO AND PROMISES (home view only) */}

        {browsing && (
          <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-400 p-8 sm:p-10 lg:col-span-2">
                <div className="relative z-10 max-w-md sm:max-w-[46%]">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-gray-900">
                    <BadgePercent size={14} />
                    Daily deals on fresh groceries
                  </span>
                  <h1 className="mt-4 text-3xl font-extrabold leading-tight text-gray-900 sm:text-4xl">
                    Groceries & essentials, delivered to your door
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-gray-800">
                    Fruits, vegetables, dairy, snacks and home essentials at great prices.
                  </p>
                  <button
                    type="button"
                    onClick={() => document.getElementById("products")?.scrollIntoView({ behavior: "smooth" })}
                    className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
                  >
                    Shop now
                    <ArrowRight size={16} />
                  </button>
                </div>

                <img
                  src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80"
                  alt="Fresh produce at a market"
                  className="absolute -right-10 bottom-0 top-0 hidden h-full w-1/2 rounded-l-[48px] object-cover shadow-2xl sm:block"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-yellow-800">Doorstep delivery</p>
                    <p className="mt-1 text-lg font-bold text-gray-900">Track every order</p>
                    <p className="mt-1 text-xs text-gray-600">Placed → Packed → Shipped → Delivered.</p>
                  </div>
                  <Truck size={40} className="shrink-0 text-yellow-500" strokeWidth={1.5} />
                </div>

                <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pay your way</p>
                    <p className="mt-1 text-lg font-bold text-gray-900">Cash on delivery</p>
                    <p className="mt-1 text-xs text-gray-600">Pay when your order reaches you.</p>
                  </div>
                  <Wallet size={40} className="shrink-0 text-yellow-500" strokeWidth={1.5} />
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:grid-cols-3">
              {promises.map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex items-center gap-3 p-2">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-yellow-700">
                    <Icon size={19} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{title}</p>
                    <p className="text-xs text-gray-500">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SHOP BY CATEGORY (home view only) */}

        {browsing && categories.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
            <div className="flex items-end justify-between">
              <h2 className="text-xl font-bold text-gray-900">Shop by category</h2>
            </div>

            <div className="cn-no-scrollbar mt-4 flex gap-4 overflow-x-auto pb-2">
              {categories.map((category) => {
                const image = getCategoryImageUrl(category);

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => chooseCategory(category.name)}
                    className="group w-28 shrink-0 text-center sm:w-32"
                  >
                    <span className="mx-auto block aspect-square w-full overflow-hidden rounded-2xl border border-gray-200 bg-yellow-50 transition group-hover:border-yellow-400 group-hover:shadow-md">
                      {image ? (
                        <img
                          src={image}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-yellow-600">
                          <Leaf size={28} />
                        </span>
                      )}
                    </span>
                    <span className="mt-2 block truncate text-sm font-medium text-gray-800">{category.name}</span>
                    <span className="block text-xs text-gray-500">
                      {productCountByCategory[category.name] || 0} items
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* PRODUCTS */}

        <section id="products" className="mx-auto max-w-7xl scroll-mt-32 px-4 py-10 sm:px-6">
          <div className="flex gap-6">
            {/* Filters */}
            <aside className="hidden w-56 shrink-0 lg:block">
              <div className="sticky top-36 rounded-xl border border-gray-200 bg-white p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <SlidersHorizontal size={16} />
                  Categories
                </p>

                <ul className="mt-3 space-y-0.5">
                  {["All", ...categories.map((item) => item.name)].map((category) => (
                    <li key={category}>
                      <button
                        type="button"
                        onClick={() => setSelectedCategory(category)}
                        className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition ${
                          selectedCategory === category
                            ? "bg-yellow-100 font-semibold text-gray-900"
                            : "text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <span className="truncate">{category === "All" ? "All products" : category}</span>
                        <span className="text-xs text-gray-400">
                          {category === "All" ? products.length : productCountByCategory[category] || 0}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>

            <div className="min-w-0 flex-1">
              {/* Toolbar */}
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {search.trim()
                      ? `Results for "${search.trim()}"`
                      : selectedCategory === "All"
                      ? "All products"
                      : selectedCategory}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {loading
                      ? "Loading..."
                      : sortedProducts.length > PRODUCTS_PER_PAGE
                      ? `Showing ${pageStart + 1}${pageProducts.length > 1 ? `–${pageStart + pageProducts.length}` : ""} of ${sortedProducts.length} items`
                      : `${sortedProducts.length} ${sortedProducts.length === 1 ? "item" : "items"}`}
                  </p>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-600">
                  Sort by
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-yellow-500"
                  >
                    <option value="relevance">Relevance</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="discount">Discount</option>
                    <option value="rating">Customer rating</option>
                  </select>
                </label>
              </div>

              {/* Category chips (below desktop) */}
              <div className="cn-no-scrollbar mb-5 flex gap-2 overflow-x-auto lg:hidden">
                {["All", ...categories.map((item) => item.name)].map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={`shrink-0 rounded-full border px-4 py-1.5 text-sm ${
                      selectedCategory === category
                        ? "border-yellow-400 bg-yellow-400 font-semibold text-gray-900"
                        : "border-gray-300 bg-white text-gray-700"
                    }`}
                  >
                    {category === "All" ? "All" : category}
                  </button>
                ))}
              </div>

              {wishlistError && (
                <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  Wishlist: {wishlistError}
                </p>
              )}
              {wishlistMessage && !wishlistError && (
                <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                  {wishlistMessage}{" "}
                  <Link to="/wishlist" className="font-semibold underline underline-offset-2">
                    View wishlist
                  </Link>
                </p>
              )}

              {loading ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 8 }, (_, index) => (
                    <div key={index} className="animate-pulse rounded-xl border border-gray-200 bg-white p-3">
                      <div className="aspect-square rounded-lg bg-gray-100" />
                      <div className="mt-3 h-3 w-1/2 rounded bg-gray-100" />
                      <div className="mt-2 h-4 w-3/4 rounded bg-gray-100" />
                      <div className="mt-4 h-9 rounded-lg bg-gray-100" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
                  <p className="text-lg font-semibold text-gray-900">We couldn't load the products</p>
                  <p className="mt-2 text-sm text-gray-500">{error}</p>
                  <button
                    type="button"
                    onClick={() => fetchStoreData()}
                    className="mt-6 inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-5 py-2.5 text-sm font-semibold text-gray-900 hover:bg-yellow-500"
                  >
                    <RefreshCw size={15} />
                    Try again
                  </button>
                </div>
              ) : sortedProducts.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-yellow-100 text-yellow-700">
                    <Search size={22} />
                  </span>
                  <p className="mt-4 text-lg font-semibold text-gray-900">No products found</p>
                  <p className="mt-1 text-sm text-gray-500">
                    {products.length === 0
                      ? "Products will appear here when they are available."
                      : "Try a different search or category."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setSelectedCategory("All");
                    }}
                    className="mt-5 text-sm font-semibold text-gray-900 underline underline-offset-4"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {pageProducts.map((product) => {
                    const inCart = cartByProduct[product.id];
                    const saved = favorites.includes(product.id);
                    const summary = reviewSummaries[product.id];

                    return (
                      <article
                        key={product.id}
                        className="group relative flex flex-col rounded-xl border border-gray-200 bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-lg"
                      >
                        {product.discount > 0 && (
                          <span className="absolute left-3 top-3 z-10 rounded-md bg-green-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                            {product.discount}% OFF
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => toggleFavorite(product.id)}
                          aria-label={`${saved ? "Remove" : "Add"} ${product.name} ${saved ? "from" : "to"} wishlist`}
                          aria-pressed={saved}
                          disabled={wishlistBusyId !== null || isStaff}
                          title={isStaff ? "Wishlist is for customers" : "Save to wishlist"}
                          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-200 transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Heart size={15} className={saved ? "fill-red-500 text-red-500" : "text-gray-500"} />
                        </button>

                        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-white">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              loading="lazy"
                              className={`h-full w-full object-contain transition duration-300 ${
                                // The bundled demo photos have wide white margins
                                // around the product, so zoom them in to fill the card.
                                isDemoImage(product.image)
                                  ? "scale-[1.9] group-hover:scale-[2]"
                                  : "p-2 group-hover:scale-105"
                              }`}
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-2 text-gray-300">
                              <ImageOff size={30} strokeWidth={1.3} />
                              <span className="text-xs">No image</span>
                            </div>
                          )}
                        </div>

                        <div className="mt-2 flex flex-1 flex-col">
                          <span className="w-fit rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
                            {product.unit || product.category}
                          </span>

                          <h3 className="mt-1.5 line-clamp-2 min-h-10 text-sm font-medium leading-5 text-gray-900">
                            {product.name}
                          </h3>

                          <button
                            type="button"
                            onClick={() => openProductReviews(product)}
                            className="mt-1 flex items-center gap-1.5 text-left text-xs text-gray-500 hover:text-gray-800"
                            aria-label={`Read reviews for ${product.name}`}
                          >
                            {summary?.review_count ? (
                              <>
                                <span className="inline-flex items-center gap-0.5 rounded bg-green-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                                  {summary.average_rating.toFixed(1)}
                                  <Star size={10} className="fill-white" />
                                </span>
                                ({summary.review_count})
                              </>
                            ) : (
                              <span className="underline-offset-2 hover:underline">No reviews yet</span>
                            )}
                          </button>

                          <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                            <div className="leading-tight">
                              <p className="text-base font-bold text-gray-900">₹{formatPrice(product.price)}</p>
                              {product.originalPrice !== null && product.originalPrice > product.price && (
                                <p className="text-xs text-gray-400 line-through">₹{formatPrice(product.originalPrice)}</p>
                              )}
                            </div>

                            {isStaff ? (
                              <span
                                className="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-400"
                                title="Staff accounts can't purchase items"
                              >
                                View only
                              </span>
                            ) : inCart ? (
                              <div className="flex items-center overflow-hidden rounded-lg bg-yellow-400 text-gray-900 shadow-sm">
                                <button
                                  type="button"
                                  onClick={() => changeQuantity(inCart, inCart.quantity - 1)}
                                  disabled={cartBusy}
                                  aria-label={`Decrease ${product.name} quantity`}
                                  className="px-2.5 py-2 transition hover:bg-yellow-500 disabled:opacity-50"
                                >
                                  <Minus size={14} />
                                </button>
                                <span className="min-w-6 text-center text-sm font-bold">{inCart.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => changeQuantity(inCart, inCart.quantity + 1)}
                                  disabled={cartBusy || inCart.quantity >= product.stock}
                                  aria-label={`Increase ${product.name} quantity`}
                                  className="px-2.5 py-2 transition hover:bg-yellow-500 disabled:opacity-50"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => addToCart(product)}
                                disabled={cartBusy}
                                className="rounded-lg border border-yellow-500 bg-yellow-50 px-5 py-2 text-sm font-bold text-gray-900 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                ADD
                              </button>
                            )}
                          </div>

                          {product.stock <= 5 && (
                            <p className="mt-2 text-[11px] font-medium text-orange-600">
                              Only {product.stock} left
                            </p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onChange={goToPage}
                  />
                )}
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
          <div>
            <StoreLogo />
            <p className="mt-4 text-sm leading-6 text-gray-500">
              Fresh groceries and everyday essentials, delivered to your door.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-900">Shop</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-gray-600">
              {categories.slice(0, 5).map((category) => (
                <li key={category.id}>
                  <button type="button" onClick={() => chooseCategory(category.name)} className="hover:text-gray-900">
                    {category.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-900">Your account</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-gray-600">
              {user && !isStaff ? (
                accountLinks.map(({ to, label }) => (
                  <li key={to}>
                    <Link to={to} className="hover:text-gray-900">{label}</Link>
                  </li>
                ))
              ) : (
                <>
                  <li><Link to="/login" className="hover:text-gray-900">Login</Link></li>
                  <li><Link to="/register" className="hover:text-gray-900">Create an account</Link></li>
                </>
              )}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-900">Shopping with us</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-gray-600">
              <li className="flex items-center gap-2"><Wallet size={15} className="text-yellow-500" /> Cash on delivery</li>
              <li className="flex items-center gap-2"><RotateCcw size={15} className="text-yellow-500" /> Cancel before shipping</li>
              <li className="flex items-center gap-2"><ShieldCheck size={15} className="text-yellow-500" /> Secure account sign-in</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-100">
          <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-gray-400 sm:px-6">
            © {new Date().getFullYear()} CartNest. All rights reserved.
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
            className="relative max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-yellow-700">Ratings & reviews</p>
                <h2 className="mt-1 text-xl font-bold text-gray-900">{selectedReviewProduct.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReviewProduct(null)}
                aria-label="Close reviews"
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            {reviewLoading ? (
              <p className="mt-8 text-sm text-gray-500">Loading reviews...</p>
            ) : reviewError ? (
              <p role="alert" className="mt-8 text-sm text-red-600">{reviewError}</p>
            ) : reviewDetails ? (
              <>
                <div className="mt-6 flex items-center gap-3 border-b border-gray-100 pb-6">
                  <span className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2 py-1 text-lg font-bold text-white">
                    {Number(reviewDetails.average_rating || 0).toFixed(1)}
                    <Star size={16} className="fill-white" />
                  </span>
                  <span className="text-sm text-gray-500">
                    {reviewDetails.review_count || 0} ratings & reviews
                  </span>
                </div>

                {Array.isArray(reviewDetails.reviews) && reviewDetails.reviews.length ? (
                  <div className="divide-y divide-gray-100">
                    {reviewDetails.reviews.map((item) => (
                      <div key={item.id} className="py-5">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-0.5 rounded bg-green-600 px-1.5 py-0.5 text-xs font-bold text-white">
                            {item.rating}
                            <Star size={10} className="fill-white" />
                          </span>
                          <span className="text-sm font-semibold text-gray-900">
                            {item.customer_name || item.username || "Customer"}
                          </span>
                        </div>
                        {item.is_verified_purchase && (
                          <p className="mt-1 text-xs text-green-700">✓ Verified purchase</p>
                        )}
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                          {item.review || item.comment || ""}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-10 text-center text-sm text-gray-500">
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
            onClick={() => setCartOpen(false)}
            className="absolute inset-0 bg-black/50"
            aria-label="Close cart"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="My cart"
            className="relative flex h-full w-full max-w-md flex-col bg-gray-50 shadow-2xl"
          >
            {/* DRAWER HEADER */}

            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
              <h2 className="text-lg font-bold text-gray-900">
                My Cart{" "}
                <span className="text-sm font-normal text-gray-500">
                  ({cartCount} {cartCount === 1 ? "item" : "items"})
                </span>
              </h2>

              <button
                type="button"
                onClick={() => setCartOpen(false)}
                aria-label="Close cart"
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* ERROR AND SUCCESS MESSAGES */}

            {cartError && (
              <div role="alert" className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {cartError}
              </div>
            )}

            {cartMessage && !cartError && (
              <div role="status" className="mx-5 mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                {cartMessage}
              </div>
            )}

            {/* CART ITEMS */}

            <div className="flex flex-1 flex-col overflow-y-auto">
              {cartLoading ? (
                <div className="flex flex-1 items-center justify-center gap-3 text-sm text-gray-500">
                  <RefreshCw size={18} className="animate-spin" />
                  Loading your cart...
                </div>
              ) : cart.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-yellow-100 text-yellow-600">
                    <ShoppingCart size={34} strokeWidth={1.6} />
                  </span>
                  <p className="mt-5 text-lg font-bold text-gray-900">Your cart is empty</p>
                  <p className="mt-1 text-sm text-gray-500">Add items to it now.</p>
                  <button
                    type="button"
                    onClick={() => setCartOpen(false)}
                    className="mt-6 rounded-lg bg-yellow-400 px-6 py-2.5 text-sm font-bold text-gray-900 hover:bg-yellow-500"
                  >
                    Shop now
                  </button>
                </div>
              ) : (
                <div className="space-y-3 p-5">
                  <div className="divide-y divide-gray-100 rounded-xl bg-white">
                    {cart.map((item) => (
                      <div key={item.cartItemId} className="flex gap-3 p-4">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-white">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="h-full w-full object-contain p-1" />
                          ) : (
                            <ImageOff size={20} className="text-gray-300" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-medium leading-snug text-gray-900">{item.name}</h3>
                            <button
                              type="button"
                              onClick={() => removeFromCart(item)}
                              disabled={cartBusy}
                              aria-label={`Remove ${item.name}`}
                              className="-mr-1 -mt-1 rounded-full p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>

                          <p className="text-xs text-gray-500">{item.unit}</p>

                          <div className="mt-2 flex items-center justify-between gap-3">
                            <p className="text-sm font-bold text-gray-900">₹{formatPrice(item.price * item.quantity)}</p>

                            <div className="flex items-center overflow-hidden rounded-lg bg-yellow-400 text-gray-900">
                              <button
                                type="button"
                                onClick={() => changeQuantity(item, item.quantity - 1)}
                                disabled={cartBusy}
                                aria-label={`Decrease ${item.name} quantity`}
                                className="px-2.5 py-1.5 hover:bg-yellow-500 disabled:opacity-50"
                              >
                                <Minus size={13} />
                              </button>
                              <span className="min-w-6 text-center text-sm font-bold">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => changeQuantity(item, item.quantity + 1)}
                                disabled={cartBusy || item.quantity >= item.stock}
                                aria-label={`Increase ${item.name} quantity`}
                                className="px-2.5 py-1.5 hover:bg-yellow-500 disabled:opacity-50"
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                          </div>

                          {item.quantity >= item.stock && (
                            <p className="mt-1.5 text-[11px] text-orange-600">Maximum available quantity</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Bill details */}
                  <div className="rounded-xl bg-white p-4 text-sm">
                    <p className="font-bold text-gray-900">Bill details</p>
                    <div className="mt-3 space-y-2 text-gray-600">
                      <div className="flex justify-between">
                        <span>Items total</span>
                        <span>₹{formatPrice(cartTotal)}</span>
                      </div>
                      {cartSavings > 0 && (
                        <div className="flex justify-between text-green-700">
                          <span>You save</span>
                          <span>₹{formatPrice(cartSavings)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Delivery</span>
                        <span className="text-gray-500">Calculated at checkout</span>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 font-bold text-gray-900">
                      <span>Total</span>
                      <span>₹{formatPrice(cartTotal)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={clearCart}
                    disabled={cartBusy}
                    className="flex items-center gap-2 px-1 text-xs text-gray-500 hover:text-red-600 disabled:opacity-40"
                  >
                    <Trash2 size={14} />
                    Clear cart
                  </button>
                </div>
              )}
            </div>

            {/* CHECKOUT BAR */}

            {cart.length > 0 && (
              <div className="border-t border-gray-200 bg-white p-4">
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
                  className="flex w-full items-center justify-between rounded-xl bg-yellow-400 px-5 py-3.5 text-gray-900 shadow-sm transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="text-left leading-tight">
                    <span className="block text-base font-bold">₹{formatPrice(cartTotal)}</span>
                    <span className="block text-[11px] font-semibold uppercase">Total</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-sm font-bold">
                    Proceed to Checkout
                    <ArrowRight size={17} />
                  </span>
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
