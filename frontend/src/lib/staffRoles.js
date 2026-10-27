// Store roles, as reported by the backend on login:
// "admin", "manager", "employee" (store staff), "delivery" or "customer".

export const STAFF_ROLES = ["admin", "manager", "employee", "delivery"];

const ROLE_LABELS = {
  admin: "Store Administrator",
  manager: "Store Manager",
  employee: "Store Staff",
  delivery: "Delivery Staff",
};

export function getStoredUser() {
  try {
    if (!sessionStorage.getItem("accessToken")) return null;
    return JSON.parse(sessionStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

export function getCurrentRole() {
  return getStoredUser()?.role || null;
}

export function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}

// Staff and delivery staff work only in the staff dashboard; they don't
// use the storefront or customer pages. Admins and managers can browse the
// store (view only).
export function isDashboardOnlyRole(role) {
  return role === "employee" || role === "delivery";
}

// Roles that open on their dashboard after signing in (no Overview page).
export function landsOnDashboard(role) {
  return role === "manager" || isDashboardOnlyRole(role);
}

// Staff pack orders and delivery staff deliver them; both punch in and
// receive one order at a time.
export function isShiftWorker(role) {
  return role === "employee" || role === "delivery";
}

// Where new-order alerts lead: the all-orders list (which opens the clicked
// order's details) for admins and managers; everyone else works from the dashboard.
export function ordersPagePath() {
  return canSeeAllOrders(getCurrentRole()) ? "/admin/orders" : "/admin/dashboard";
}

// Admins and managers see every order and get new-order alerts.
export function canSeeAllOrders(role) {
  return role === "admin" || role === "manager";
}

// Only managers reassign orders or cancel them; admins only view orders.
export function canManageOrders(role) {
  return role === "manager";
}

// Managers and admins can add, edit and remove products and stock.
export function canManageStock(role) {
  return role === "admin" || role === "manager";
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || "Customer";
}
