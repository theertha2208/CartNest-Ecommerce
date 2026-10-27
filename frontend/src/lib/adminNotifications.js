import { create } from "zustand";
import { adminRequest } from "../pages/adminApi";
import { canSeeAllOrders, getStoredUser } from "./staffRoles";

// Shared admin notification state: the alert watcher fills it,
// bells in the page headers read from it.

// Admins and managers get new-order alerts; employees get orders by assignment.
export function isAdminSession() {
  return canSeeAllOrders(getStoredUser()?.role);
}

export const useAdminNotifications = create((set, get) => ({
  items: [],
  unreadCount: 0,
  // Bumped whenever a new order arrives, so open pages can reload.
  newOrderSignal: 0,

  async refresh() {
    const data = await adminRequest("/admin/notifications/");
    set({
      items: Array.isArray(data.results) ? data.results : [],
      unreadCount: Number(data.unread_count || 0),
    });
    return data;
  },

  signalNewOrder() {
    set({ newOrderSignal: get().newOrderSignal + 1 });
  },

  async markRead(id) {
    const target = get().items.find((item) => item.id === id);
    if (!target || target.is_read) return;

    set({
      items: get().items.map((item) =>
        item.id === id ? { ...item, is_read: true } : item
      ),
      unreadCount: Math.max(0, get().unreadCount - 1),
    });

    try {
      await adminRequest(`/admin/notifications/${id}/read/`, { method: "POST" });
    } catch {
      get().refresh().catch(() => {});
    }
  },

  async markAllRead() {
    set({
      items: get().items.map((item) => ({ ...item, is_read: true })),
      unreadCount: 0,
    });

    try {
      await adminRequest("/admin/notifications/read-all/", { method: "POST" });
    } catch {
      get().refresh().catch(() => {});
    }
  },
}));

export function timeAgo(value) {
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
