import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, BellRing, CheckCheck, ShoppingBag } from "lucide-react";
import { money } from "../pages/adminApi";
import { ordersPagePath } from "../lib/staffRoles";
import {
  timeAgo,
  useAdminNotifications,
} from "../lib/adminNotifications";

// ==========================================
// ADMIN NOTIFICATION BELL (HEADER DROPDOWN)
// ==========================================

export default function AdminNotificationBell() {
  const navigate = useNavigate();
  const items = useAdminNotifications((state) => state.items);
  const unreadCount = useAdminNotifications((state) => state.unreadCount);
  const refresh = useAdminNotifications((state) => state.refresh);
  const markRead = useAdminNotifications((state) => state.markRead);
  const markAllRead = useAdminNotifications((state) => state.markAllRead);
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState(
    "Notification" in window ? Notification.permission : "unsupported"
  );
  const wrapperRef = useRef(null);

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;

    function handleOutside(event) {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    }
    function handleEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  async function enableDesktopAlerts() {
    try {
      setPermission(await Notification.requestPermission());
    } catch {
      // Ignore browsers without the promise-based API.
    }
  }

  function openNotification(notification) {
    markRead(notification.id);
    setOpen(false);
    navigate(`${ordersPagePath()}#order-${notification.order_id}`);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={`Order notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-gray-900 transition hover:bg-green-100"
      >
        {unreadCount > 0 ? (
          <BellRing size={20} strokeWidth={1.7} className="cn-ring" />
        ) : (
          <Bell size={20} strokeWidth={1.7} />
        )}

        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-gray-900 ring-2 ring-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-[0_24px_48px_-16px_rgba(0,0,0,0.75)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3.5">
            <div>
              <p className="text-sm font-semibold text-gray-900">Order alerts</p>
              <p className="text-xs text-gray-500">
                {unreadCount ? `${unreadCount} unread` : "You're all caught up"}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-green-700 transition hover:bg-green-100"
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          {permission === "default" && (
            <button
              type="button"
              onClick={enableDesktopAlerts}
              className="flex w-full items-center gap-2 border-b border-gray-200 bg-gray-100 px-4 py-2.5 text-left text-xs text-green-700 transition hover:bg-green-100"
            >
              <BellRing size={14} /> Turn on desktop alerts for new orders
            </button>
          )}

          <div className="max-h-[360px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <ShoppingBag size={24} strokeWidth={1.5} className="mx-auto text-gray-500" />
                <p className="mt-3 text-sm text-gray-600">New orders will appear here.</p>
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openNotification(item)}
                  className={`flex w-full items-start gap-3 border-b border-gray-200 px-4 py-3.5 text-left transition last:border-b-0 hover:bg-green-100 ${
                    item.is_read ? "opacity-70" : ""
                  }`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      item.is_read ? "bg-transparent" : "bg-amber-500"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-gray-900">{item.title}</span>
                      <span className="shrink-0 text-[11px] text-gray-500">{timeAgo(item.created_at)}</span>
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-gray-600">{item.message}</span>
                    <span className="mt-1 block text-[11px] text-gray-500">
                      {money(item.order_total)} · <span className="capitalize">{item.order_status}</span>
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={() => { setOpen(false); navigate(ordersPagePath()); }}
            className="w-full border-t border-gray-200 px-4 py-3 text-center text-xs font-medium text-green-700 transition hover:bg-green-100"
          >
            View all orders
          </button>
        </div>
      )}
    </div>
  );
}
