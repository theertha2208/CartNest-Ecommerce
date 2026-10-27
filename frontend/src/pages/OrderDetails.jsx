import { formatOrderId, statusLabel } from "../lib/orderUtils";
import OrderTracker from "../components/OrderTracker";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Package,
  MapPin,
  CreditCard,
  CalendarDays,
  UserRound,
  Phone,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  RefreshCw,
  AlertCircle,
  ImageOff,
  ShoppingBag,
  MessageSquareText,
  CircleCheck,
  Star,
} from "lucide-react";
import CustomerHeader, { CustomerFooter } from "../components/CustomerHeader";
import { getProductImageUrl, isDemoImage } from "../lib/productImages";

const API_BASE = "http://127.0.0.1:8000";

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function formatPrice(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Customers see Placed → Packed → Shipped → Delivered.
function formatStatus(value) {
  return statusLabel(value);
}

function getStatusDetails(status) {
  switch (status) {
    case "pending":
      return {
        icon: Clock,
        style: "bg-amber-50 text-amber-700",
        message: "Your order has been placed and will be packed soon.",
      };

    case "confirmed":
      return {
        icon: CheckCircle2,
        style: "bg-sky-50 text-sky-700",
        message: "Your order has been placed and will be packed soon.",
      };

    case "packed":
      return {
        icon: Package,
        style: "bg-purple-50 text-purple-700",
        message: "Your order is packed and ready for shipping.",
      };

    case "shipped":
      return {
        icon: Truck,
        style: "bg-indigo-50 text-indigo-700",
        message: "Your order is on its way.",
      };

    case "delivered":
      return {
        icon: CheckCircle2,
        style: "bg-emerald-50 text-emerald-700",
        message: "Your order has been marked as delivered.",
      };

    case "cancelled":
      return {
        icon: XCircle,
        style: "bg-red-50 text-red-600",
        message: "This order has been cancelled.",
      };

    default:
      return {
        icon: Clock,
        style: "bg-green-50 text-gray-600",
        message: "Your order information is available below.",
      };
  }
}

function getErrorMessage(data, fallback) {
  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (typeof data?.non_field_errors?.[0] === "string") {
    return data.non_field_errors[0];
  }

  const first = Object.values(data || {})[0];
  if (Array.isArray(first) && first.length) return String(first[0]);
  if (typeof first === "string") return first;
  return fallback;
}

// ==========================================
// AUTHENTICATED API REQUEST
// ==========================================

async function authenticatedRequest(endpoint, options = {}) {
  let accessToken = sessionStorage.getItem("accessToken");

  if (!accessToken) {
    throw new Error("Please sign in to view this order.");
  }

  async function sendRequest(token) {
    return fetch(`${API_BASE}${endpoint}`, {
      ...options,
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  }

  let response = await sendRequest(accessToken);

  if (response.status === 401) {
    const refreshToken = sessionStorage.getItem("refreshToken");

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
        const refreshData = await refreshResponse.json();

        accessToken = refreshData.access;

        sessionStorage.setItem("accessToken", accessToken);

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

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        "Your session has expired. Please sign in again."
      );
    }

    throw new Error(
      getErrorMessage(data, "Unable to load order details.")
    );
  }

  return data;
}

// ==========================================
// VERIFIED PRODUCT REVIEW FORM
// ==========================================

function ProductReviewForm({ productId }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [existingReview, setExistingReview] = useState(null);
  const [open, setOpen] = useState(false);
  const [loadingReview, setLoadingReview] = useState(true);

  useEffect(() => {
    if (!productId) {
      setLoadingReview(false);
      return;
    }

    let cancelled = false;
    setLoadingReview(true);
    setExistingReview(null);
    setRating(0);
    setComment("");
    setOpen(false);
    setError("");
    setSuccess("");

    async function loadSavedReview() {
      try {
        // Authenticated GET is important: the API sets is_mine
        // only when it can identify the current customer.
        const data = await authenticatedRequest(
          `/api/products/${productId}/reviews/`
        );
        if (cancelled) return;
        const mine = (Array.isArray(data.reviews) ? data.reviews : [])
          .find((review) => review.is_mine === true);
        if (mine) {
          setExistingReview(mine);
          setRating(Number(mine.rating));
          setComment(mine.comment || "");
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load your saved review.");
      } finally {
        if (!cancelled) setLoadingReview(false);
      }
    }

    loadSavedReview();
    return () => { cancelled = true; };
  }, [productId]);

  if (!productId) return null;

  async function submitReview(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!rating || !comment.trim()) {
      setError("Please select a star rating and write your review.");
      return;
    }
    setBusy(true);
    try {
      const saved = await authenticatedRequest(
        existingReview
          ? `/api/reviews/${existingReview.id}/`
          : `/api/products/${productId}/reviews/`,
        {
          method: existingReview ? "PATCH" : "POST",
          body: JSON.stringify({ rating, comment: comment.trim() }),
        }
      );
      setExistingReview(saved);
      setRating(Number(saved.rating));
      setComment(saved.comment || "");
      setSuccess(existingReview ? "Your review was updated." : "Thank you! Your review has been submitted.");
      setOpen(false);
    } catch (err) {
      setError(err.message || "Could not save your review.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteReview() {
    if (!existingReview || busy) return;
    setBusy(true);
    setError("");
    try {
      await authenticatedRequest(`/api/reviews/${existingReview.id}/`, {
        method: "DELETE",
      });
      setExistingReview(null);
      setRating(0);
      setComment("");
      setOpen(false);
      setSuccess("Your review was deleted.");
    } catch (err) {
      setError(err.message || "Could not delete your review.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 border-t border-gray-200 pt-4">
      {loadingReview ? (
        <p className="text-xs text-gray-600">Checking your saved review...</p>
      ) : (
        <>
          {existingReview && (
            <div className="mb-4 rounded-sm bg-green-50 p-4">
              <p className="text-xs font-semibold text-green-700">
                Your review
              </p>
              <div className="mt-2 flex gap-1" aria-label={`${existingReview.rating} out of 5 stars`}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <Star key={value} size={18} color="#F0A673"
                    fill={value <= Number(existingReview.rating) ? "#F0A673" : "none"} />
                ))}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-900">
                {existingReview.comment}
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => { setOpen((value) => !value); setError(""); }}
              className="inline-flex items-center gap-2 border border-gray-900 px-4 py-2.5 text-xs font-semibold text-gray-900 transition hover:bg-green-100"
            >
              <Star size={16} color="#F0A673" />
              {existingReview ? "Edit Review" : "Rate & Review"}
            </button>
            {existingReview && (
              <button type="button" disabled={busy} onClick={deleteReview}
                className="border border-red-200 px-4 py-2.5 text-xs font-semibold text-red-600 disabled:opacity-50">
                Delete Review
              </button>
            )}
          </div>
        </>
      )}
      {success && <p role="status" className="mt-3 text-sm text-green-700">{success}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      {open && !loadingReview && (
        <form onSubmit={submitReview} className="mt-4 max-w-lg cn-glass-deep p-5">
          <p className="text-sm font-semibold text-gray-900">How was this product?</p>
          <div className="mt-3 flex gap-2" role="group" aria-label="Select star rating">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                type="button"
                key={value}
                onClick={() => setRating(value)}
                aria-label={`${value} star${value === 1 ? "" : "s"}`}
                aria-pressed={rating === value}
                className="p-1"
              >
                <Star size={27} color="#F0A673" fill={value <= rating ? "#F0A673" : "none"} />
              </button>
            ))}
          </div>
          <label htmlFor={`review-${productId}`} className="mt-4 block text-sm font-medium text-gray-900">
            Write your review
          </label>
          <textarea
            id={`review-${productId}`}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Tell other customers about your experience..."
            className="mt-2 w-full border border-gray-300 cn-glass p-3 text-sm text-gray-900 outline-none focus:border-yellow-500"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className="cn-gradient-gold px-5 py-3 text-xs font-semibold text-gray-900 disabled:opacity-50">
              {busy ? "Saving..." : existingReview ? "Save changes" : "Submit Review"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}


// ==========================================
// COMPACT ORDER TRACKING
// ==========================================

function CompactTracking({ order, onRefresh, refreshing }) {
  const status = order.status;

  return (
    <section className="rounded-2xl border border-gray-200 cn-glass p-5 sm:p-7">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-yellow-700">Delivery status</h2>
          <p className="mt-1 text-sm text-gray-600">
            {status === "cancelled" ? "This order was cancelled." :
             status === "delivered" ? "Your order has arrived." :
             "Follow your order as it moves toward delivery. This page updates automatically."}
          </p>
        </div>
        <button type="button" onClick={onRefresh} disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-yellow-700 hover:bg-green-50 disabled:opacity-50">
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""}/>
          Refresh
        </button>
      </div>

      <OrderTracker order={order}/>
    </section>
  );
}

// ==========================================
// CUSTOMER ORDER CANCELLATION
// ==========================================

const CANCELLABLE_STATUSES = ["pending", "confirmed", "packed"];

const CANCEL_REASONS = [
  "Changed my mind",
  "Ordered by mistake",
  "Found a better price",
  "Delivery is taking too long",
  "Other",
];

function CancelOrderPanel({ order, onCancelled }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canCancel = order.can_cancel ?? CANCELLABLE_STATUSES.includes(order.status);

  if (order.status === "shipped") {
    return (
      <section className="flex items-start gap-3 rounded-2xl border border-gray-200 cn-glass p-5 sm:p-6">
        <Truck size={20} className="mt-0.5 shrink-0 text-yellow-700"/>
        <div>
          <h2 className="font-semibold">This order is on its way</h2>
          <p className="mt-1 text-sm text-gray-600">
            It has already been shipped, so it can no longer be cancelled.
          </p>
        </div>
      </section>
    );
  }

  if (!canCancel) return null;

  async function confirmCancel() {
    if (busy) return;
    setBusy(true);
    setError("");
    const fullReason = [reason, note.trim()].filter(Boolean).join(" — ");
    try {
      const data = await authenticatedRequest(`/api/orders/${order.id}/cancel/`, {
        method: "POST",
        body: JSON.stringify({ reason: fullReason }),
      });
      onCancelled(data);
    } catch (err) {
      setError(err.message || "Could not cancel this order. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 cn-glass p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">Need to cancel?</h2>
          <p className="mt-1 text-sm text-gray-600">
            You can cancel this order any time before it ships.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => { setOpen(true); setError(""); }}
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            <XCircle size={16}/> Cancel order
          </button>
        )}
      </div>

      {open && (
        <div className="mt-5 border-t border-gray-200 pt-5">
          <p className="text-sm font-medium">Why are you cancelling? <span className="font-normal text-gray-500">(optional)</span></p>
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Cancellation reason">
            {CANCEL_REASONS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={reason === option}
                onClick={() => setReason(reason === option ? "" : option)}
                className={`rounded-full border px-3.5 py-1.5 text-xs transition ${
                  reason === option
                    ? "border-yellow-400 cn-gradient-gold text-gray-900"
                    : "border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          <label htmlFor="cancel-note" className="mt-4 block text-sm font-medium">
            Anything else? <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <textarea
            id="cancel-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={300}
            rows={2}
            placeholder="Tell us a little more"
            className="mt-2 w-full border border-gray-200 cn-glass-deep px-3 py-2.5 text-sm outline-none transition focus:border-yellow-400"
          />

          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={confirmCancel}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? <RefreshCw size={16} className="animate-spin"/> : <XCircle size={16}/>}
              {busy ? "Cancelling..." : "Yes, cancel order"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium transition hover:border-yellow-400 disabled:opacity-60"
            >
              Keep my order
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ==========================================
// ORDER DETAILS PAGE
// ==========================================

export default function OrderDetails() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [cancelMessage, setCancelMessage] = useState("");

  function handleCancelled(updatedOrder) {
    setOrder(updatedOrder);
    setCancelMessage("Your order has been cancelled.");
  }

  async function loadOrder(full = true) {
    if (full) {
      setLoading(true);
      setError("");
    } else {
      setRefreshing(true);
      setRefreshError("");
    }
    try {
      const data = await authenticatedRequest(`/api/orders/${orderId}/`);
      setOrder(data);
    } catch (err) {
      if (full) setError(err.message || "Unable to load order details.");
      else setRefreshError(err.message || "Unable to refresh your order.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!/^\d+$/.test(orderId || "")) {
      setError("Invalid order number.");
      setLoading(false);
      return;
    }
    loadOrder();
  }, [orderId]);

  // Keep the tracker current while the order is still moving.
  const stillMoving = order && !["delivered", "cancelled"].includes(order.status);

  useEffect(() => {
    if (!stillMoving) return;
    const timer = setInterval(() => loadOrder(false), 20000);
    return () => clearInterval(timer);
  }, [stillMoving, orderId]);

  const items = Array.isArray(order?.items) ? order.items : [];
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const statusDetails = getStatusDetails(order?.status);
  const StatusIcon = statusDetails.icon;

  return (
    <div className="min-h-screen bg-transparent text-gray-900">
      <CustomerHeader />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-7 sm:px-5 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl text-gray-900 sm:text-4xl">Order Details</h1>
            {order && <p className="mt-1 text-sm text-gray-600">Order #CN{String(order.id).padStart(6, "0")} · {formatDate(order.created_at)}</p>}
          </div>
          {order && (
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${statusDetails.style}`}>
              <StatusIcon size={15}/>{formatStatus(order.status)}
            </span>
          )}
        </div>

        {loading && (
          <div className="flex min-h-52 items-center justify-center gap-3 text-sm text-gray-600">
            <RefreshCw size={20} className="animate-spin"/> Loading your order...
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="rounded-xl border border-red-200 cn-glass p-7 text-center">
            <AlertCircle className="mx-auto text-red-600" size={28}/>
            <p className="mt-3 text-red-600">{error}</p>
            <button type="button" onClick={() => loadOrder()} className="mt-4 rounded-lg cn-gradient-gold px-5 py-2.5 text-sm text-gray-900">
              Try again
            </button>
          </div>
        )}

        {!loading && !error && order && (
          <>
            <section className="overflow-hidden rounded-2xl border border-gray-200 cn-glass">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-5 py-4 sm:px-7">
                <h2 className="text-lg font-semibold">Products ordered</h2>
                <span className="text-xs text-gray-600">{totalQuantity} {totalQuantity === 1 ? "item" : "items"}</span>
              </div>

              <div className="divide-y divide-gray-100 px-5 sm:px-7">
                {items.map((item) => (
                  <div key={item.id} className="py-5">
                    <div className="flex items-start gap-4">
                      {getProductImageUrl(item.product_image, item.product_name) ? (
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white sm:h-20 sm:w-20">
                          <img
                            src={getProductImageUrl(item.product_image, item.product_name)}
                            alt={item.product_name}
                            className={`h-full w-full object-contain ${
                              isDemoImage(getProductImageUrl(item.product_image, item.product_name)) ? "scale-[1.9]" : "p-1"
                            }`}
                          />
                        </div>
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-green-50 sm:h-20 sm:w-20">
                          <Package size={26} className="text-green-700"/>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold">{item.product_name}</h3>
                        <p className="mt-1 text-sm text-gray-600">Quantity: {item.quantity}</p>
                        <p className="mt-1 text-sm text-gray-600">₹{formatPrice(item.price)} each</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold">₹{formatPrice(Number(item.price) * Number(item.quantity))}</span>
                    </div>
                    {order.status === "delivered" && item.product_id && (
                      <div className="ml-0 sm:ml-24">
                        <ProductReviewForm productId={item.product_id}/>
                      </div>
                    )}
                  </div>
                ))}
                {items.length === 0 && <p className="py-6 text-sm text-gray-600">No products found in this order.</p>}
              </div>
              <div className="flex items-center justify-between cn-glass-deep px-5 py-4 sm:px-7">
                <span className="font-medium">Order total</span>
                <span className="text-lg font-bold">₹{formatPrice(order.total_amount)}</span>
              </div>
            </section>

            <CompactTracking order={order} onRefresh={() => loadOrder(false)} refreshing={refreshing}/>
            {refreshError && <p role="alert" className="text-sm text-red-600">{refreshError}</p>}

            {cancelMessage && (
              <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <CheckCircle2 size={17}/> {cancelMessage}
              </p>
            )}

            <CancelOrderPanel order={order} onCancelled={handleCancelled}/>

            {order.status === "cancelled" && (
              <section className="rounded-2xl border border-red-200 cn-glass p-5 sm:p-7">
                <h2 className="font-semibold text-red-600">Cancellation details</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-red-600">
                  {order.cancellation_reason || "No cancellation reason was provided."}
                </p>
                {order.cancelled_at && <p className="mt-2 text-xs text-red-600">Cancelled on {formatDate(order.cancelled_at)}</p>}
              </section>
            )}

            <div className="grid gap-5 md:grid-cols-2">
              <section className="rounded-2xl border border-gray-200 cn-glass p-5 sm:p-7">
                <div className="flex items-center gap-2">
                  <MapPin size={19} className="text-amber-600"/>
                  <h2 className="font-semibold">Delivery details</h2>
                </div>
                <p className="mt-4 text-sm font-medium">{order.full_name}</p>
                <p className="mt-1 text-sm text-gray-600">{order.phone}</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-600">{order.address}</p>
                <p className="text-sm leading-6 text-gray-600">{order.city}, {order.state} - {order.postal_code}</p>
              </section>

              <section className="rounded-2xl border border-gray-200 cn-glass p-5 sm:p-7">
                <div className="flex items-center gap-2">
                  <CreditCard size={19} className="text-amber-600"/>
                  <h2 className="font-semibold">Payment</h2>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-600">Method</span>
                  <span className="font-medium">{order.payment_method === "cod" ? "Cash on Delivery" : formatStatus(order.payment_method)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-600">Status</span>
                  <span className="font-medium">{formatStatus(order.payment_status)}</span>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
                  <span className="font-medium">Total</span>
                  <span className="font-bold">₹{formatPrice(order.total_amount)}</span>
                </div>
              </section>
            </div>

            <div className="flex flex-wrap gap-3 pb-5">
              <Link to="/orders" className="inline-flex items-center gap-2 rounded-lg border border-yellow-400 px-5 py-3 text-sm font-medium text-yellow-700 hover:bg-green-50">
                <ArrowLeft size={16}/> Back to My Orders
              </Link>
              <Link to="/" className="inline-flex items-center gap-2 rounded-lg cn-gradient-gold px-5 py-3 text-sm font-medium !text-gray-900 hover:bg-yellow-500">
                Continue shopping <ArrowRight size={16}/>
              </Link>
            </div>
          </>
        )}
      </main>

      <CustomerFooter />
    </div>
  );
}
