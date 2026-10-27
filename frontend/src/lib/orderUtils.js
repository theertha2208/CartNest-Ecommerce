export function formatOrderId(orderId) {
  if (orderId === null || orderId === undefined) {
    return "";
  }

  return `#CN${String(orderId).padStart(6, "0")}`;
}

// The four steps customers see. "Placed" covers both pending and
// confirmed orders, which are waiting to be packed.
export const TRACKING_STEPS = [
  { key: "placed", title: "Placed", timeField: "created_at", statuses: ["pending", "confirmed"] },
  { key: "packed", title: "Packed", timeField: "packed_at", statuses: ["packed"] },
  { key: "shipped", title: "Shipped", timeField: "shipped_at", statuses: ["shipped"] },
  { key: "delivered", title: "Delivered", timeField: "delivered_at", statuses: ["delivered"] },
];

export function trackingStepIndex(status) {
  return TRACKING_STEPS.findIndex((step) => step.statuses.includes(status));
}

export const STATUS_LABELS = {
  pending: "Placed",
  confirmed: "Placed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || status || "Unknown";
}

// Badge colours for each status, shared by every order list.
export const STATUS_BADGES = {
  pending: "bg-amber-500/10 text-amber-300",
  confirmed: "bg-amber-500/10 text-amber-300",
  packed: "bg-sky-500/10 text-sky-300",
  shipped: "bg-violet-500/10 text-violet-300",
  delivered: "bg-emerald-500/10 text-emerald-300",
  cancelled: "bg-red-500/10 text-red-300",
};

// Statuses a manager or admin can move an order to next. The backend
// enforces the same rules.
export const NEXT_STATUSES = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function dateTimeLabel(value) {
  return value
    ? new Date(value).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
}
