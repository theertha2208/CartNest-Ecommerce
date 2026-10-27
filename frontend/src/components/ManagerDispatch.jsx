import { useEffect, useState } from "react";
import { Package, Truck, Loader2, Eye, RefreshCw } from "lucide-react";
import { adminRequest, money } from "../pages/adminApi";
import { dateTimeLabel, formatOrderId } from "../lib/orderUtils";
import OrderDetailsDialog from "./OrderDetailsDialog";

const POLL_MS = 10000;

const COLUMNS = [
  {
    status: "packed",
    title: "Awaiting pickup",
    hint: "Packed by staff, waiting for a delivery staff member to pick up.",
    icon: Package,
    timeField: "packed_at",
    timeLabel: "Packed",
    who: (order) =>
      order.delivery_person_name
        ? `Assigned to ${order.delivery_person_name}`
        : "Waiting for a delivery staff member",
  },
  {
    status: "shipped",
    title: "Out for delivery",
    hint: "Picked up and on the way to the customer.",
    icon: Truck,
    timeField: "shipped_at",
    timeLabel: "Shipped",
    who: (order) => `With ${order.delivery_person_name || "a delivery staff member"}`,
  },
];

function listOf(data) {
  return Array.isArray(data) ? data : data?.results || [];
}

// Managers monitor packed and shipped orders; delivery staff update them.
export default function ManagerDispatch() {
  const [orders, setOrders] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  function load() {
    return Promise.all(
      COLUMNS.map((column) => adminRequest(`/admin/orders/?status=${column.status}&page_size=100`))
    )
      .then(([packed, shipped]) => {
        setOrders({ packed: listOf(packed), shipped: listOf(shipped) });
        setError("");
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  if (!orders) {
    return (
      <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-gray-600">
        {error ? (
          <span role="alert" className="text-red-600">{error}</span>
        ) : (
          <>
            <Loader2 size={20} className="animate-spin" />
            Loading deliveries...
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {COLUMNS.map((column) => {
          const Icon = column.icon;
          const list = orders[column.status];

          return (
            <section key={column.status} className="rounded-2xl border border-gray-200 cn-glass">
              <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-700">
                    <Icon size={19} />
                  </span>
                  <div>
                    <h3 className="font-semibold">
                      {column.title}
                      <span className="ml-2 rounded-full bg-green-50 px-2 py-0.5 text-xs">{list.length}</span>
                    </h3>
                    <p className="text-xs text-gray-500">{column.hint}</p>
                  </div>
                </div>

                <button type="button" onClick={load} aria-label="Refresh" className="rounded-lg p-2 hover:bg-green-50">
                  <RefreshCw size={15} />
                </button>
              </div>

              {list.length === 0 ? (
                <p className="p-6 text-sm text-gray-600">Nothing here right now.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {list.map((order) => (
                    <li key={order.id} className="flex items-center justify-between gap-3 px-5 py-4">
                      <div className="text-sm">
                        <p className="font-semibold">
                          {formatOrderId(order.id)}
                          <span className="ml-2 font-normal text-gray-600">
                            {order.full_name}, {order.city}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {money(order.total_amount)} · {column.timeLabel} {dateTimeLabel(order[column.timeField])}
                        </p>
                        <p className={`mt-1 text-xs ${order.delivery_person_name ? "text-green-700" : "text-green-700"}`}>
                          {column.who(order)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelected(order)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-50"
                      >
                        <Eye size={14} />
                        View details
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {selected && (
        <OrderDetailsDialog
          order={selected}
          canCancel
          onClose={() => setSelected(null)}
          onUpdated={(updated) => {
            setSelected(updated);
            load();
          }}
        />
      )}
    </div>
  );
}
