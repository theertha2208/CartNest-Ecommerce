import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BellRing, X } from "lucide-react";
import { money } from "../pages/adminApi";
import { ordersPagePath } from "../lib/staffRoles";
import {
  isAdminSession,
  useAdminNotifications,
} from "../lib/adminNotifications";

const POLL_INTERVAL_MS = 15000;
const TOAST_LIFETIME_MS = 9000;
const LAST_SEEN_KEY = "cartnestAdminLastNotificationId";

function playChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContext();
    [880, 1318.5].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.16;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.5);
    });
    setTimeout(() => context.close(), 1200);
  } catch {
    // Browsers block audio until the admin has interacted with the page.
  }
}

function showDesktopNotification(notification, onOpen) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const desktop = new Notification(notification.title, {
      body: notification.message,
      tag: `cartnest-order-${notification.order_id}`,
    });
    desktop.onclick = () => {
      window.focus();
      onOpen(notification);
      desktop.close();
    };
  } catch {
    // Some browsers only allow notifications from a service worker.
  }
}

// ==========================================
// NEW ORDER ALERTS FOR ADMINS (MOUNTED ONCE)
// ==========================================

export default function AdminOrderAlerts() {
  const navigate = useNavigate();
  const refresh = useAdminNotifications((state) => state.refresh);
  const markRead = useAdminNotifications((state) => state.markRead);
  const signalNewOrder = useAdminNotifications((state) => state.signalNewOrder);
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  function dismiss(id) {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  function pushToast(toast) {
    setToasts((current) => [toast, ...current.filter((item) => item.id !== toast.id)].slice(0, 3));
    timers.current[toast.id] = setTimeout(() => dismiss(toast.id), TOAST_LIFETIME_MS);
  }

  function openOrder(notification) {
    if (notification.order_id) {
      markRead(notification.id);
      navigate(`${ordersPagePath()}#order-${notification.order_id}`);
    } else {
      navigate(ordersPagePath());
    }
  }

  useEffect(() => {
    let stopped = false;
    let timer;

    async function poll() {
      if (stopped) return;

      if (isAdminSession()) {
        try {
          const data = await refresh();
          const results = Array.isArray(data?.results) ? data.results : [];
          const newestId = results.reduce((max, item) => Math.max(max, item.id), 0);
          const stored = sessionStorage.getItem(LAST_SEEN_KEY);

          if (stored === null) {
            // First check this session: summarise what was waiting.
            if (data.unread_count > 0) {
              pushToast({
                id: "summary",
                title: `${data.unread_count} new ${data.unread_count === 1 ? "order" : "orders"} waiting`,
                message: "Open the bell to review them.",
              });
            }
          } else {
            const fresh = results
              .filter((item) => item.id > Number(stored) && !item.is_read)
              .reverse();

            if (fresh.length) {
              playChime();
              signalNewOrder();
              fresh.slice(-3).forEach((item) => {
                pushToast(item);
                showDesktopNotification(item, openOrder);
              });
            }
          }

          if (newestId >= Number(stored || 0)) {
            sessionStorage.setItem(LAST_SEEN_KEY, String(newestId));
          }
        } catch {
          // Network hiccup or expired session: try again next round.
        }
      }

      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    function pollWhenVisible() {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        poll();
      }
    }

    poll();
    document.addEventListener("visibilitychange", pollWhenVisible);

    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", pollWhenVisible);
      Object.values(timers.current).forEach(clearTimeout);
    };
  }, []);

  if (!toasts.length) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-[80] flex w-[min(380px,calc(100vw-2.5rem))] flex-col gap-3"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="cn-toast pointer-events-auto overflow-hidden rounded-2xl border border-yellow-300 bg-white shadow-[0_24px_48px_-16px_rgba(0,0,0,0.75)] backdrop-blur-xl"
        >
          <div className="flex items-start gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full cn-gradient-gold text-gray-900">
              <BellRing size={18} className="cn-ring" />
            </span>

            <button
              type="button"
              onClick={() => {
                dismiss(toast.id);
                if (toast.id === "summary") navigate(ordersPagePath());
                else openOrder(toast);
              }}
              className="min-w-0 flex-1 text-left"
            >
              <p className="text-sm font-semibold text-gray-900">{toast.title}</p>
              <p className="mt-0.5 text-xs leading-5 text-gray-600">{toast.message}</p>
              {toast.order_total && (
                <p className="mt-2 text-xs font-medium text-green-700">
                  {money(toast.order_total)} · View order →
                </p>
              )}
            </button>

            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss alert"
              className="rounded-full p-1 text-gray-500 transition hover:bg-green-100 hover:text-gray-900"
            >
              <X size={15} />
            </button>
          </div>
          <div className="cn-toast-timer h-0.5 bg-yellow-100" />
        </div>
      ))}
    </div>
  );
}
