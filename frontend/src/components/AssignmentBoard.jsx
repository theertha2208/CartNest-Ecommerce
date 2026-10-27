import { useEffect, useState } from "react";
import {
  Users,
  PackageOpen,
  Hourglass,
  Truck,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Undo2,
  Eye,
} from "lucide-react";
import { adminRequest, money } from "../pages/adminApi";
import { formatOrderId } from "../lib/orderUtils";

// The board refreshes itself so managers and admins see assignments as they happen.
const POLL_MS = 10000;

const LANES = [
  {
    key: "packing",
    title: "Packing",
    people: "Staff",
    workingLabel: "Packing",
    queueTitle: "Waiting to be packed",
    queueHint: "Placed orders, assigned oldest first as staff become free.",
    sinceField: "created_at",
    sinceLabel: "placed",
    icon: PackageOpen,
  },
  {
    key: "delivery",
    title: "Delivery",
    people: "Delivery staff",
    workingLabel: "Delivering",
    queueTitle: "Waiting for pickup",
    queueHint: "Packed orders, assigned oldest first as delivery staff become free.",
    sinceField: "packed_at",
    sinceLabel: "packed",
    icon: Truck,
  },
];

function sinceLabel(value) {
  if (!value) return "";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min ago`;
}

export default function AssignmentBoard() {
  const [board, setBoard] = useState(null);
  const [busyOrderId, setBusyOrderId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function load() {
    return adminRequest("/admin/assignments/")
      .then((data) => {
        setBoard(data);
        setError("");
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  async function assign(lane, order, personId, label) {
    setBusyOrderId(order.id);
    setError("");
    setNotice("");

    try {
      await adminRequest(`/admin/orders/${order.id}/assign/`, {
        method: "POST",
        body: JSON.stringify({ employee: personId, lane: lane.key }),
      });
      setNotice(label);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyOrderId(null);
    }
  }

  if (!board) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-gray-600">
        {error ? (
          <span role="alert" className="text-red-600">{error}</span>
        ) : (
          <>
            <Loader2 size={20} className="animate-spin" />
            Loading assignments...
          </>
        )}
      </div>
    );
  }

  const canReassign = board.can_reassign;

  return (
    <div className="space-y-8">
      {!canReassign && (
        <p className="flex items-center gap-2 rounded-xl border border-gray-200 bg-yellow-50 p-4 text-sm text-green-700">
          <Eye size={17} className="shrink-0" />
          View only. Managers reassign orders.
        </p>
      )}

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

      {LANES.map((lane) => (
        <LaneSection
          key={lane.key}
          lane={lane}
          data={board[lane.key]}
          canReassign={canReassign}
          busyOrderId={busyOrderId}
          onAssign={assign}
          onRefresh={load}
        />
      ))}
    </div>
  );
}

function LaneSection({ lane, data, canReassign, busyOrderId, onAssign, onRefresh }) {
  const LaneIcon = lane.icon;

  const free = data.people.filter((person) => person.is_punched_in && person.is_active && !person.current_order);
  const nameOf = (id) => data.people.find((person) => person.id === id)?.full_name || "them";

  function personSelect(order, excludeId) {
    const options = free.filter((person) => person.id !== excludeId);

    return (
      <select
        aria-label={`Assign ${formatOrderId(order.id)}`}
        value=""
        disabled={busyOrderId !== null || options.length === 0}
        onChange={(event) => {
          const id = Number(event.target.value);
          onAssign(lane, order, id, `${formatOrderId(order.id)} assigned to ${nameOf(id)}.`);
        }}
        className="rounded-lg border border-gray-200 cn-glass-deep px-3 py-2 text-xs outline-none focus:border-yellow-500 disabled:opacity-50"
      >
        <option value="">
          {options.length ? (excludeId ? "Reassign to…" : "Assign to…") : "Nobody free"}
        </option>
        {options.map((person) => (
          <option key={person.id} value={person.id}>
            {person.full_name}
          </option>
        ))}
      </select>
    );
  }

  const summary = [
    { label: `${lane.people} on shift`, value: data.on_shift, icon: Users },
    { label: lane.workingLabel + " now", value: data.busy, icon: LaneIcon },
    { label: lane.queueTitle, value: data.queue.length, icon: Hourglass },
  ];

  return (
    <section className="space-y-4">
      <h3 className="flex items-center gap-2 font-serif text-2xl">
        <LaneIcon size={22} className="text-green-700" />
        {lane.title}
      </h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summary.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-2xl border border-gray-200 cn-glass p-5">
              <div className="flex items-start justify-between">
                <p className="text-xs font-medium text-gray-500">{item.label}</p>
                <Icon size={18} className="text-green-700" />
              </div>
              <p className="mt-3 font-serif text-3xl">{item.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* PEOPLE */}

        <div className="rounded-2xl border border-gray-200 cn-glass">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5">
            <h4 className="text-sm font-semibold">{lane.people}</h4>
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-gray-900"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>

          {data.people.length === 0 ? (
            <p className="p-5 text-sm text-gray-600">No approved {lane.people.toLowerCase()} yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.people.map((person) => {
                const order = person.current_order;

                return (
                  <li key={person.id} className="space-y-3 px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          person.is_punched_in ? (order ? "bg-amber-500" : "bg-green-500") : "bg-gray-300"
                        }`}
                      />
                      <div>
                        <p className="text-sm font-semibold">{person.full_name}</p>
                        <p className="text-xs text-gray-500">
                          {!person.is_active
                            ? "Account deactivated"
                            : person.is_punched_in
                            ? `${order ? lane.workingLabel : "Free"} · on shift since ${sinceLabel(person.punched_in_at)}`
                            : order
                            ? `Off shift · finishing ${formatOrderId(order.id)}`
                            : "Off shift"}
                        </p>
                      </div>
                    </div>

                    {order && (
                      <div className="flex flex-wrap items-center gap-2 pl-5 text-sm">
                        <span className="rounded-lg bg-green-50 px-3 py-1.5">
                          <span className="font-semibold">{formatOrderId(order.id)}</span>
                          <span className="ml-2 text-xs text-gray-600">
                            {order.status === "shipped" ? "out for delivery" : `${order.item_count} items`} ·{" "}
                            {money(order.total_amount)}
                          </span>
                        </span>

                        {/* Reassigning only makes sense before work has really started. */}
                        {canReassign && order.status !== "shipped" && (
                          <>
                            {personSelect(order, person.id)}
                            <button
                              type="button"
                              onClick={() =>
                                onAssign(lane, order, null, `${formatOrderId(order.id)} returned to the queue.`)
                              }
                              disabled={busyOrderId !== null}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold hover:bg-green-50 disabled:opacity-50"
                            >
                              <Undo2 size={14} />
                              Return to queue
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* QUEUE */}

        <div className="rounded-2xl border border-gray-200 cn-glass">
          <div className="border-b border-gray-200 px-5 py-3.5">
            <h4 className="text-sm font-semibold">{lane.queueTitle}</h4>
            <p className="mt-0.5 text-xs text-gray-500">{lane.queueHint}</p>
          </div>

          {data.queue.length === 0 ? (
            <p className="p-5 text-sm text-gray-600">The queue is empty.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.queue.map((order, index) => (
                <li key={order.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-50 text-xs font-semibold">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-semibold">
                        {formatOrderId(order.id)}
                        <span className="ml-2 font-normal text-gray-600">{order.full_name}, {order.city}</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {order.item_count} items · {money(order.total_amount)} · {lane.sinceLabel}{" "}
                        {sinceLabel(order[lane.sinceField])}
                      </p>
                    </div>
                  </div>

                  {canReassign && personSelect(order)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
