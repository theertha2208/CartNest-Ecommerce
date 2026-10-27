import { useEffect, useRef, useState } from "react";
import {
  LogIn,
  LogOut,
  PackageCheck,
  Truck,
  Clock,
  Loader2,
  MapPin,
  Phone,
  Inbox,
  AlertCircle,
  CheckCircle2,
  Coffee,
} from "lucide-react";
import { adminRequest, money } from "../pages/adminApi";
import { formatOrderId } from "../lib/orderUtils";

// How often to check for a newly assigned order.
const POLL_MS = 10000;

function timeLabel(value) {
  return value
    ? new Date(value).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
    : "";
}

// Wording for staff (packing) and delivery staff (delivering).
const COPY = {
  employee: {
    noun: "order",
    done: "packed today",
    current: "Your current order",
    itemsTitle: "Items to pack",
    nextHint: "Your next order is assigned as soon as this one is packed.",
    offShift: "Punch in when you're ready to start packing orders.",
    historyTitle: "Orders you've handled",
    historyEmpty: "Orders you pack will be listed here.",
  },
  delivery: {
    noun: "delivery",
    done: "delivered today",
    current: "Your current delivery",
    itemsTitle: "Parcel contents",
    nextHint: "Your next delivery is assigned as soon as this one is delivered.",
    offShift: "Punch in when you're ready to start delivering.",
    historyTitle: "Deliveries you've made",
    historyEmpty: "Orders you deliver will be listed here.",
  },
};

// The one button for the current order: pack it, pick it up, or deliver it.
function nextAction(order) {
  if (["pending", "confirmed"].includes(order.status)) {
    return { status: "packed", label: "Mark as packed", done: "marked as packed" };
  }
  if (order.status === "packed") {
    return { status: "shipped", label: "Picked up · Mark as shipped", done: "picked up and marked as shipped" };
  }
  if (order.status === "shipped") {
    return { status: "delivered", label: "Mark as delivered", done: "delivered" };
  }
  return null;
}

export default function EmployeeWorkspace() {
  const [work, setWork] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lastOrderId = useRef(null);

  function applyWork(data) {
    const newId = data.current_order?.id ?? null;

    if (newId && lastOrderId.current !== null && newId !== lastOrderId.current) {
      setNotice(`New ${COPY[data.role]?.noun || "order"} ${formatOrderId(newId)} assigned to you.`);
    }

    lastOrderId.current = newId ?? 0;
    setWork(data);
  }

  function loadHistory() {
    return adminRequest("/admin/orders/")
      .then((data) => {
        setHistory(Array.isArray(data) ? data : data?.results || []);
      })
      .catch(() => {});
  }

  function refresh() {
    return adminRequest("/staff/my-work/")
      .then((data) => {
        applyWork(data);
        setError("");
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    refresh();
    loadHistory();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  async function run(action, successMessage) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await action();
      if (successMessage) setNotice(successMessage);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function punch(direction) {
    return run(async () => {
      applyWork(await adminRequest(`/staff/punch-${direction}/`, { method: "POST" }));
    }, direction === "in" ? "You're punched in. Orders will be assigned to you." : "You're punched out. Have a good rest!");
  }

  function advance(order, action) {
    return run(async () => {
      await adminRequest(`/admin/orders/${order.id}/status/`, {
        method: "PATCH",
        body: JSON.stringify({ status: action.status }),
      });
      await refresh();
      await loadHistory();
    }, `Order ${formatOrderId(order.id)} ${action.done}.`);
  }

  if (!work) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-gray-600">
        {error ? (
          <span role="alert" className="text-red-600">{error}</span>
        ) : (
          <>
            <Loader2 size={20} className="animate-spin" />
            Loading your workspace...
          </>
        )}
      </div>
    );
  }

  const order = work.current_order;
  const items = order?.items || [];
  const copy = COPY[work.role] || COPY.employee;

  // Everything this person has handled, apart from what they're working on now.
  const pastOrders = history.filter((past) => past.id !== order?.id);
  const action = order ? nextAction(order) : null;
  const collectCash = order && order.payment_method === "cod" && order.payment_status !== "paid";

  return (
    <div className="space-y-6">
      {/* SHIFT */}

      <section className="flex flex-col gap-5 rounded-2xl border border-gray-200 cn-glass p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-full ${
              work.is_punched_in ? "bg-green-50 text-green-700" : "bg-green-50 text-gray-500"
            }`}
          >
            {work.is_punched_in ? <Clock size={22} /> : <Coffee size={22} />}
          </span>

          <div>
            <p className="flex items-center gap-2 text-lg font-semibold">
              <span
                className={`h-2.5 w-2.5 rounded-full ${work.is_punched_in ? "bg-green-500" : "bg-gray-300"}`}
              />
              {work.is_punched_in ? "On shift" : "Off shift"}
            </p>

            <p className="mt-1 text-sm text-gray-600">
              {work.is_punched_in
                ? `Punched in at ${timeLabel(work.punched_in_at)} · ${work.completed_today} ${copy.done}`
                : "Punch in to start receiving orders."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => punch(work.is_punched_in ? "out" : "in")}
          disabled={busy}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition disabled:opacity-60 ${
            work.is_punched_in
              ? "border border-gray-300 text-gray-900 hover:bg-green-50"
              : "cn-gradient-gold text-gray-900"
          }`}
        >
          {busy ? (
            <Loader2 size={17} className="animate-spin" />
          ) : work.is_punched_in ? (
            <LogOut size={17} />
          ) : (
            <LogIn size={17} />
          )}
          {work.is_punched_in ? "Punch out" : "Punch in"}
        </button>
      </section>

      {notice && (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle2 size={19} className="shrink-0" />
          {notice}
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          <AlertCircle size={19} className="shrink-0" />
          {error}
        </div>
      )}

      {/* CURRENT ORDER */}

      {order ? (
        <section className="overflow-hidden rounded-2xl border border-yellow-300 cn-glass">
          <div className="flex flex-col gap-3 border-b border-gray-200 p-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green-700">
                {copy.current}
              </p>
              <h3 className="mt-2 font-serif text-3xl">{formatOrderId(order.id)}</h3>
              <p className="mt-1 text-xs text-gray-500">
                Assigned at {timeLabel(order.assigned_at)} · placed{" "}
                {new Date(order.created_at).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>

            <p className="font-serif text-3xl">{money(order.total_amount)}</p>
          </div>

          <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">
                {copy.itemsTitle}
              </p>

              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                    <span>
                      <span className="mr-3 inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-green-50 px-2 font-semibold">
                        {item.quantity}×
                      </span>
                      {item.product_name}
                    </span>
                    <span className="text-gray-600">
                      {money(Number(item.price) * Number(item.quantity))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">
                Deliver to
              </p>

              <div className="space-y-2 rounded-xl border border-gray-200 p-4 text-sm">
                <p className="font-semibold">{order.full_name}</p>
                <p className="flex gap-2 text-gray-600">
                  <MapPin size={16} className="mt-0.5 shrink-0" />
                  <span>
                    {order.address}, {order.city}, {order.state} {order.postal_code}
                  </span>
                </p>
                <p className="flex items-center gap-2 text-gray-600">
                  <Phone size={16} className="shrink-0" />
                  {order.phone}
                </p>
              </div>

              {work.role === "delivery" && collectCash && (
                <p className="mt-3 rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-sm text-green-700">
                  Collect {money(order.total_amount)} cash on delivery.
                </p>
              )}

              {action && (
                <button
                  type="button"
                  onClick={() => advance(order, action)}
                  disabled={busy}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl cn-gradient-gold px-6 py-3.5 text-sm font-semibold text-gray-900 disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : action.status === "shipped" ? (
                    <Truck size={17} />
                  ) : (
                    <PackageCheck size={17} />
                  )}
                  {action.label}
                </button>
              )}

              <p className="mt-2 text-center text-xs text-gray-500">{copy.nextHint}</p>
            </div>
          </div>
        </section>
      ) : (
        <section className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 cn-glass p-8 text-center">
          <Inbox size={36} strokeWidth={1.4} className="text-gray-500" />
          <h3 className="mt-4 font-serif text-2xl">
            {work.is_punched_in ? `No ${copy.noun} right now` : "You're off shift"}
          </h3>
          <p className="mt-2 max-w-sm text-sm text-gray-600">
            {work.is_punched_in
              ? `The next ${copy.noun} will appear here automatically when one is ready.`
              : copy.offShift}
          </p>
        </section>
      )}

      {/* HISTORY */}

      <section className="rounded-2xl border border-gray-200 cn-glass p-6">
        <h3 className="text-base font-semibold">{copy.historyTitle}</h3>

        {pastOrders.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600">{copy.historyEmpty}</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100">
            {pastOrders.slice(0, 10).map((past) => (
              <li key={past.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span>
                  <span className="font-semibold">{formatOrderId(past.id)}</span>
                  <span className="ml-2 text-gray-500">{past.full_name}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs capitalize text-gray-600">
                    {past.status}
                  </span>
                  {money(past.total_amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
