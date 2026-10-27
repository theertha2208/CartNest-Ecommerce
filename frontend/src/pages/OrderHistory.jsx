import { formatOrderId } from "../lib/orderUtils";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, ShoppingBag, Package, RefreshCw,
  AlertCircle, CheckCircle2, Clock, Truck, XCircle,
} from "lucide-react";
import CustomerHeader, { CustomerFooter } from "../components/CustomerHeader";

const API_BASE = "http://127.0.0.1:8000";

function statusInfo(status) {
  const options = {
    pending: { label: "Placed", Icon: Clock, style: "bg-amber-50 text-amber-700" },
    confirmed: { label: "Placed", Icon: Clock, style: "bg-amber-50 text-amber-700" },
    packed: { label: "Packed", Icon: Package, style: "bg-violet-50 text-violet-700" },
    shipped: { label: "Shipped", Icon: Truck, style: "bg-indigo-50 text-indigo-700" },
    delivered: { label: "Delivered", Icon: CheckCircle2, style: "bg-emerald-50 text-emerald-700" },
    cancelled: { label: "Cancelled", Icon: XCircle, style: "bg-red-50 text-red-600" },
  };
  return options[status] || { label: status || "Unknown", Icon: Clock, style: "bg-green-50 text-gray-600" };
}

async function getOrders() {
  let token = sessionStorage.getItem("accessToken");
  if (!token) throw new Error("Please sign in to view your orders.");

  const send = (access) => fetch(`${API_BASE}/api/orders/`, {
    headers: { Authorization: `Bearer ${access}`, Accept: "application/json" },
  });
  let response = await send(token);

  if (response.status === 401) {
    const refresh = sessionStorage.getItem("refreshToken");
    if (refresh) {
      const refreshResponse = await fetch(`${API_BASE}/api/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        token = data.access;
        sessionStorage.setItem("accessToken", token);
        if (data.refresh) sessionStorage.setItem("refreshToken", data.refresh);
        response = await send(token);
      }
    }
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string" ? data.detail :
      response.status === 401 ? "Your session has expired. Please sign in again." :
      "Unable to load your orders."
    );
  }
  return Array.isArray(data) ? data : Array.isArray(data.results) ? data.results : [];
}

export default function OrderHistory() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadOrders() {
    setLoading(true);
    setError("");
    try {
      setOrders(await getOrders());
    } catch (err) {
      setError(err.message || "Unable to load your orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadOrders(); }, []);

  return (
    <div className="min-h-screen bg-transparent text-gray-900">
      <CustomerHeader />

      <main className="mx-auto max-w-5xl px-5 py-8 sm:py-12">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl">My Orders</h1>
            <p className="mt-2 text-sm text-gray-600">Your purchases at a glance.</p>
          </div>
          <button type="button" onClick={loadOrders} disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-gray-200 cn-glass px-4 py-2.5 text-sm font-medium hover:border-yellow-400 disabled:opacity-50">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-3 py-20 text-gray-600">
            <RefreshCw size={21} className="animate-spin" /> Loading orders...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 cn-glass p-8 text-center">
            <AlertCircle className="mx-auto text-red-600" size={30} />
            <p className="mt-3 text-sm text-red-600">{error}</p>
            <div className="mt-5 flex justify-center gap-3">
              <button onClick={loadOrders} className="rounded-lg cn-gradient-gold px-5 py-2.5 text-sm font-medium text-gray-900">Try again</button>
              <button onClick={() => navigate("/login")} className="rounded-lg border px-5 py-2.5 text-sm">Sign in</button>
            </div>
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="rounded-xl border border-gray-200 cn-glass px-6 py-16 text-center">
            <ShoppingBag className="mx-auto text-amber-600" size={40} />
            <h2 className="mt-4 text-xl font-semibold">No orders yet</h2>
            <p className="mt-2 text-sm text-gray-600">Start shopping to see your orders here.</p>
            <Link to="/" className="mt-6 inline-flex rounded-lg cn-gradient-gold px-6 py-3 text-sm font-medium text-gray-900">Shop groceries</Link>
          </div>
        )}

        {!loading && !error && orders.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{orders.length} {orders.length === 1 ? "order" : "orders"}</p>
            {orders.map((order) => {
              const { label, Icon, style } = statusInfo(order.status);
              const items = Array.isArray(order.items) ? order.items : [];
              return (
                <article key={formatOrderId(order.id)} className="overflow-hidden rounded-xl border border-gray-200 cn-glass shadow-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 sm:px-6">
                    <span className="text-sm font-semibold">#CN{String(order.id).padStart(6, "0")}</span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${style}`}>
                      <Icon size={14} /> {label}
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100 px-5 sm:px-6">
                    {items.length ? items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 py-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-green-50">
                          <Package size={23} className="text-green-700" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{item.product_name}</p>
                          <p className="mt-1 text-xs text-gray-600">Quantity: {item.quantity}</p>
                        </div>
                      </div>
                    )) : <p className="py-4 text-sm text-gray-600">Product details are available in the order view.</p>}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 cn-glass px-5 py-3 sm:px-6">
                    <Link to={`/orders/${order.id}`}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-yellow-700 hover:text-amber-600">
                      View Order Details <ArrowRight size={16} />
                    </Link>
                    {(order.can_cancel ?? ["pending", "confirmed", "packed"].includes(order.status)) && (
                      <Link to={`/orders/${order.id}`} className="text-xs text-gray-600 underline-offset-4 hover:text-red-600 hover:underline">
                        Cancel before it ships
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <CustomerFooter />
    </div>
  );
}
