import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Search, RefreshCw, Loader2, AlertCircle, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { adminRequest, money } from "../pages/adminApi";
import { STATUS_BADGES, dateTimeLabel, formatOrderId, statusLabel } from "../lib/orderUtils";
import { useAdminNotifications } from "../lib/adminNotifications";
import OrderDetailsDialog from "./OrderDetailsDialog";
import { canManageOrders, getCurrentRole } from "../lib/staffRoles";

const FILTERS = [
  ["", "All"],
  ["pending,confirmed", "Placed"],
  ["packed", "Packed"],
  ["shipped", "Shipped"],
  ["delivered", "Delivered"],
  ["cancelled", "Cancelled"],
];

const POLL_MS = 15000;

// Compact list of every order, with a details dialog for each one.
export default function OrdersTable() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  const location = useLocation();
  const openedFromLink = useRef("");
  const newOrderSignal = useAdminNotifications((state) => state.newOrderSignal);

  function load() {
    const params = new URLSearchParams({ page: String(page) });
    if (filter) params.set("status", filter);
    if (search.trim()) params.set("search", search.trim());

    return adminRequest(`/admin/orders/?${params}`)
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  // Reload on filter/search/page changes, on new-order alerts, and every few seconds.
  useEffect(() => {
    const timer = setTimeout(load, 250);
    const poll = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
    };
  }, [filter, search, page, newOrderSignal]);

  // Links like /admin/orders#order-12 (from alerts) open that order's details.
  useEffect(() => {
    const match = location.hash.match(/^#order-(\d+)$/);
    if (!match || openedFromLink.current === location.hash) return;

    openedFromLink.current = location.hash;
    adminRequest(`/admin/orders/${match[1]}/`).then(setSelected).catch((err) => setError(err.message));
  }, [location.hash]);

  function changeFilter(value) {
    setFilter(value);
    setPage(1);
  }

  function handleUpdated(updated) {
    setSelected(updated);
    load();
  }

  const orders = data?.results || [];
  const totalPages = data ? Math.max(1, Math.ceil(data.count / 25)) : 1;

  return (
    <div className="space-y-5">
      {/* FILTERS */}

      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 cn-glass p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(([value, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => changeFilter(value)}
              aria-pressed={filter === value}
              className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                filter === value
                  ? "border-yellow-400 cn-gradient-gold text-gray-900"
                  : "border-gray-200 text-gray-600 hover:text-gray-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full lg:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Order #, customer, phone, city..."
              aria-label="Search orders"
              className="w-full rounded-xl border border-gray-200 cn-glass-deep py-2.5 pl-10 pr-3 text-sm outline-none focus:border-yellow-500"
            />
          </div>

          <button
            type="button"
            onClick={load}
            aria-label="Refresh orders"
            className="rounded-xl border border-gray-200 p-2.5 hover:bg-green-50"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          <AlertCircle size={19} className="shrink-0" />
          {error}
        </div>
      )}

      {/* LIST */}

      <div className="overflow-x-auto rounded-2xl border border-gray-200 cn-glass">
        {loading && !data ? (
          <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-gray-600">
            <Loader2 size={20} className="animate-spin" />
            Loading orders...
          </div>
        ) : orders.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-600">No orders found.</p>
        ) : (
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-gray-200 text-[11px] uppercase tracking-[0.12em] text-gray-500">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Order</th>
                <th className="px-5 py-3.5 font-semibold">Placed</th>
                <th className="px-5 py-3.5 font-semibold">Customer</th>
                <th className="px-5 py-3.5 text-center font-semibold">Items</th>
                <th className="px-5 py-3.5 text-right font-semibold">Total</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
                <th className="px-5 py-3.5 font-semibold">Packed by</th>
                <th className="px-5 py-3.5 font-semibold">Delivery</th>
                <th className="px-5 py-3.5 text-right font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => {
                const itemCount = (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);

                return (
                  <tr key={order.id} className="transition hover:bg-green-50">
                    <td className="px-5 py-3 font-semibold">{formatOrderId(order.id)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-gray-600">{dateTimeLabel(order.created_at)}</td>
                    <td className="px-5 py-3">
                      <p>{order.full_name}</p>
                      <p className="text-xs text-gray-500">{order.city}</p>
                    </td>
                    <td className="px-5 py-3 text-center">{itemCount}</td>
                    <td className="px-5 py-3 text-right font-semibold">{money(order.total_amount)}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGES[order.status] || ""}`}>
                        {statusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-600">
                      {order.assigned_to_name || (["pending", "confirmed"].includes(order.status) ? "In queue" : "—")}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-600">
                      {order.delivery_person_name || (order.status === "packed" ? "Awaiting pickup" : "—")}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(order)}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-50"
                      >
                        <Eye size={14} />
                        View Order Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* PAGES */}

      {data && data.count > 0 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {data.count} {data.count === 1 ? "order" : "orders"} · page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage(page - 1)}
              disabled={!data.previous}
              aria-label="Previous page"
              className="rounded-lg border border-gray-200 p-2 hover:bg-green-50 disabled:opacity-40"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => setPage(page + 1)}
              disabled={!data.next}
              aria-label="Next page"
              className="rounded-lg border border-gray-200 p-2 hover:bg-green-50 disabled:opacity-40"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {selected && (
        <OrderDetailsDialog
          order={selected}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
          canCancel={canManageOrders(getCurrentRole())}
        />
      )}
    </div>
  );
}
