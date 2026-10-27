import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Checkout from "./pages/Checkout.jsx";
import OrderHistory from "./pages/OrderHistory.jsx";
import OrderDetails from "./pages/OrderDetails.jsx";
import CustomerProfile from "./pages/CustomerProfile.jsx";
import Wishlist from "./pages/Wishlist.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import ProductManagement from "./pages/ProductManagement.jsx";
import CategoryManagement from "./pages/CategoryManagement.jsx";
import AdminOrders from "./pages/AdminOrders.jsx";
import AdminCustomers from "./pages/AdminCustomers.jsx";
import AdminAnalytics from "./pages/AdminAnalytics.jsx";
import AdminSettings from "./pages/AdminSettings.jsx";
import StaffManagement from "./pages/StaffManagement.jsx";
import StockActivityLog from "./pages/StockActivityLog.jsx";
import AdminAssignments from "./pages/AdminAssignments.jsx";
import AdminOrderAlerts from "./components/AdminOrderAlerts.jsx";
import { STAFF_ROLES, getStoredUser, isDashboardOnlyRole, isStaffRole } from "./lib/staffRoles.js";
import "./index.css";

// Store staff pages. Admins see everything; managers and employees only the
// pages listed for them. The backend enforces the same rules.
function StaffRoute({ roles = STAFF_ROLES, children }) {
  const user = getStoredUser();
  if (!user) return <Navigate to="/login" replace />;
  if (!isStaffRole(user.role)) return <Navigate to="/" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/admin/dashboard" replace />;
  return children;
}
// Admins, managers and staff; delivery staff only use their dashboard.
const STORE_TEAM = ["admin", "manager", "employee"];

function AdminRoute({ children }) {
  return <StaffRoute roles={["admin"]}>{children}</StaffRoute>;
}
// Managers and employees only use the staff dashboard, never the shop.
function StorefrontRoute({ children }) {
  if (isDashboardOnlyRole(getStoredUser()?.role)) return <Navigate to="/admin/dashboard" replace />;
  return children;
}
function CustomerRoute({ children }) {
  if (!sessionStorage.getItem("accessToken")) return <Navigate to="/login" replace />;
  if (isDashboardOnlyRole(getStoredUser()?.role)) return <Navigate to="/admin/dashboard" replace />;
  return children;
}
// Staff can browse the store but cannot buy, so checkout is customers-only.
function CheckoutRoute({ children }) {
  if (!sessionStorage.getItem("accessToken")) return <Navigate to="/login" replace />;
  if (isStaffRole(getStoredUser()?.role)) return <Navigate to="/" replace />;
  return children;
}
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode><BrowserRouter><AdminOrderAlerts /><Routes>
    <Route path="/" element={<StorefrontRoute><App /></StorefrontRoute>} />
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/profile" element={<CustomerRoute><CustomerProfile /></CustomerRoute>} />
    <Route path="/wishlist" element={<CustomerRoute><Wishlist /></CustomerRoute>} />
    <Route path="/checkout" element={<CheckoutRoute><Checkout /></CheckoutRoute>} />
    <Route path="/orders" element={<CustomerRoute><OrderHistory /></CustomerRoute>} />
    <Route path="/orders/:orderId" element={<CustomerRoute><OrderDetails /></CustomerRoute>} />
    <Route path="/admin/dashboard" element={<StaffRoute><AdminDashboard /></StaffRoute>} />
    <Route path="/admin/products" element={<StaffRoute roles={STORE_TEAM}><ProductManagement /></StaffRoute>} />
    <Route path="/admin/categories" element={<StaffRoute roles={STORE_TEAM}><CategoryManagement /></StaffRoute>} />
    <Route path="/admin/orders" element={<StaffRoute roles={["admin", "manager"]}><AdminOrders /></StaffRoute>} />
    <Route path="/admin/customers" element={<AdminRoute><AdminCustomers /></AdminRoute>} />
    <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
    <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
    <Route path="/admin/staff" element={<StaffRoute roles={["admin", "manager"]}><StaffManagement /></StaffRoute>} />
    <Route path="/admin/stock-log" element={<AdminRoute><StockActivityLog /></AdminRoute>} />
    <Route path="/admin/assignments" element={<StaffRoute roles={["admin", "manager"]}><AdminAssignments /></StaffRoute>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></BrowserRouter></React.StrictMode>
);
