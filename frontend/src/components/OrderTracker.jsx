import { CheckCircle2, Package, Truck, PackageCheck, XCircle } from "lucide-react";
import { TRACKING_STEPS, dateTimeLabel, trackingStepIndex } from "../lib/orderUtils";

const STEP_ICONS = {
  placed: CheckCircle2,
  packed: Package,
  shipped: Truck,
  delivered: PackageCheck,
};

// Placed → Packed → Shipped → Delivered, with the time of each completed step.
export default function OrderTracker({ order }) {
  if (order.status === "cancelled") {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-600">
        <XCircle size={20} className="shrink-0" />
        <span>
          Order cancelled{order.cancelled_at ? ` on ${dateTimeLabel(order.cancelled_at)}` : ""}.
          {order.cancellation_reason && (
            <span className="mt-1 block text-red-600">{order.cancellation_reason}</span>
          )}
        </span>
      </div>
    );
  }

  const currentIndex = trackingStepIndex(order.status);

  return (
    <ol className="grid grid-cols-4 gap-1 sm:gap-3">
      {TRACKING_STEPS.map((step, index) => {
        const complete = index <= currentIndex;
        const current = index === currentIndex;
        const Icon = STEP_ICONS[step.key];

        return (
          <li key={step.key} className="min-w-0" aria-current={current ? "step" : undefined}>
            <div className={`h-1.5 rounded-full ${complete ? "cn-gradient-gold" : "bg-green-100"}`} />

            <div
              className={`mt-3 flex flex-col items-center gap-1 text-center ${
                complete ? "text-yellow-700" : "text-gray-500"
              }`}
            >
              <Icon size={18} />
              <span className={`text-[11px] sm:text-xs ${current ? "font-semibold" : "font-medium"}`}>
                {step.title}
              </span>
              <span className="text-[10px] text-gray-500">
                {complete ? dateTimeLabel(order[step.timeField]) : ""}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
