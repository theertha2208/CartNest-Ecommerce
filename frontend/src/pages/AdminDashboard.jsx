
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AdminNotificationBell from "../components/AdminNotificationBell";
import {
  canSeeAllOrders,
  getCurrentRole,
  getStoredUser,
  isDashboardOnlyRole,
  landsOnDashboard,
  isShiftWorker,
  roleLabel,
} from "../lib/staffRoles";
import AdminOrders from "./AdminOrders";
import AssignmentBoard from "../components/AssignmentBoard";
import EmployeeWorkspace from "../components/EmployeeWorkspace";
import ManagerDispatch from "../components/ManagerDispatch";
import AttendanceReport from "../components/AttendanceReport";

import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  Tags,
  BarChart3,
  Settings,
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  Menu,
  X,
  Store,
  LogOut,
  TrendingUp,
  Clock3,
  ShieldCheck,
  UserCog,
  History,
  ClipboardList,
  UserCheck,
  Truck,
  CalendarCheck,
} from "lucide-react";

// ==========================================
// DASHBOARD STATISTICS
// ==========================================

const API_BASE = "http://127.0.0.1:8000/api";

function formatRupees(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}


// ==========================================
// SIDEBAR NAVIGATION
// ==========================================

// Items without `roles` are shown to every store staff member.
const ADMIN_ONLY = ["admin"];

// Everyone who works in the store itself; delivery staff only see their deliveries.
const STORE_TEAM = ["admin", "manager", "employee"];

const navigation = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    roles: ADMIN_ONLY,
  },
  {
    label: "My Work",
    icon: ClipboardList,
    roles: ["employee", "delivery"],
  },
  {
    label: "Deliveries",
    icon: Truck,
    roles: ["manager"],
  },
  {
    label: "Orders",
    icon: ShoppingBag,
    path: "/admin/orders",
    roles: ["admin", "manager"],
  },
  {
    label: "Assignments",
    icon: UserCheck,
    path: "/admin/assignments",
    roles: ["admin", "manager"],
  },
  {
    label: "Attendance",
    icon: CalendarCheck,
    roles: ["admin", "manager", "employee", "delivery"],
  },
  {
    label: "Products",
    icon: Package,
    path: "/admin/products",
    roles: STORE_TEAM,
  },
  {
    label: "Categories",
    icon: Tags,
    path: "/admin/categories",
    roles: STORE_TEAM,
  },
  {
    label: "Customers",
    icon: Users,
    path: "/admin/customers",
    roles: ADMIN_ONLY,
  },
  {
    label: "Staff",
    icon: UserCog,
    path: "/admin/staff",
    roles: ["admin", "manager"],
  },
  {
    label: "Stock Log",
    icon: History,
    path: "/admin/stock-log",
    roles: ADMIN_ONLY,
  },
  {
    label: "Analytics",
    icon: BarChart3,
    path: "/admin/analytics",
    roles: ADMIN_ONLY,
  },
  {
    label: "Settings",
    icon: Settings,
    path: "/admin/settings",
    roles: ADMIN_ONLY,
  },
];

function allowedFor(role) {
  return (item) => !item.roles || item.roles.includes(role);
}

// ==========================================
// MANAGEMENT SHORTCUTS
// ==========================================

const management = [
  {
    title: "Product Management",
    description:
      "Create listings, update pricing, upload images and manage stock.",
    icon: Package,
    path: "/admin/products",
  },
  {
    title: "Category Management",
    description:
      "Create collections, upload category images and manage visibility.",
    icon: Tags,
    path: "/admin/categories",
  },
  {
    title: "Order Management",
    description:
      "Review customer orders, manage fulfillment and update delivery statuses.",
    icon: ShoppingBag,
    path: "/admin/orders",
  },
  {
    title: "Customer Management",
    description:
      "View registered customers and account information.",
    icon: Users,
    path: "/admin/customers",
  },
  {
    title: "Staff Management",
    description:
      "Add employees and managers, reset passwords and deactivate accounts.",
    icon: UserCog,
    path: "/admin/staff",
  },
  {
    title: "Stock Activity Log",
    description:
      "See who added or removed products and stock, and when.",
    icon: History,
    path: "/admin/stock-log",
  },
];

function AdminDashboard() {
  const navigate = useNavigate();

  // Managers, staff and delivery staff have no Overview: managers open on
  // Deliveries, staff and delivery staff on their own assigned work.
  const currentRole = getCurrentRole();
  const dashboardOnly = landsOnDashboard(currentRole);

  // Admins and managers can open the shop (view only).
  const canBrowseStore = !isDashboardOnlyRole(currentRole);

  const [activeSection, setActiveSection] = useState(
    isShiftWorker(currentRole) ? "My Work" : dashboardOnly ? "Deliveries" : "Overview"
  );

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [dashboardData, setDashboardData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(!dashboardOnly);
  const [statsError, setStatsError] = useState("");

  useEffect(() => {
    if (dashboardOnly) return;

    let active = true;

    async function loadDashboardStats() {
      try {
        let accessToken = sessionStorage.getItem("accessToken");
        if (!accessToken) throw new Error("Please sign in as an administrator.");

        const fetchStats = (token) => fetch(`${API_BASE}/admin/dashboard/stats/`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        let response = await fetchStats(accessToken);

        if (response.status === 401) {
          const refreshToken = sessionStorage.getItem("refreshToken");
          if (refreshToken) {
            const refreshed = await fetch(`${API_BASE}/auth/refresh/`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refresh: refreshToken }),
            });
            if (refreshed.ok) {
              const tokens = await refreshed.json();
              accessToken = tokens.access;
              sessionStorage.setItem("accessToken", accessToken);
              response = await fetchStats(accessToken);
            }
          }
        }

        if (!response.ok) {
          if (response.status === 403) throw new Error("Admin access is required to view statistics.");
          if (response.status === 401) throw new Error("Your session expired. Please sign in again.");
          throw new Error(`Unable to load dashboard statistics (HTTP ${response.status}).`);
        }

        const data = await response.json();
        if (active) {
          setDashboardData(data);
          setStatsError("");
        }
      } catch (error) {
        if (active) setStatsError(error.message || "Unable to load statistics.");
      } finally {
        if (active) setStatsLoading(false);
      }
    }

    loadDashboardStats();
    return () => { active = false; };
  }, [dashboardOnly]);

  const salesDays = Array.isArray(dashboardData?.sales_last_7_days)
    ? dashboardData.sales_last_7_days
    : [];
  const highestDailyRevenue = Math.max(
    0,
    ...salesDays.map((day) => Number(day.revenue) || 0)
  );
  const sevenDayRevenue = salesDays.reduce(
    (sum, day) => sum + (Number(day.revenue) || 0), 0
  );
  const sevenDayOrders = salesDays.reduce(
    (sum, day) => sum + (Number(day.orders) || 0), 0
  );

  const stats = [
    {
      label: "Total Revenue",
      value: dashboardData ? formatRupees(dashboardData.total_revenue) : "—",
      description: "Paid orders (excluding cancellations)",
      icon: TrendingUp,
    },
    {
      label: "Total Orders",
      value: dashboardData ? dashboardData.total_orders : "—",
      description: "All orders, including cancelled",
      icon: ShoppingBag,
    },
    {
      label: "Total Products",
      value: dashboardData ? dashboardData.total_products : "—",
      description: "Products in inventory",
      icon: Package,
    },
    {
      label: "Customers",
      value: dashboardData ? dashboardData.total_customers : "—",
      description: "Registered non-staff accounts",
      icon: Users,
    },
  ];

  // ==========================================
  // CURRENT ADMIN
  // ==========================================

  const storedUser = getStoredUser();
  const role = storedUser?.role;

  const displayName =
    storedUser?.first_name ||
    storedUser?.username ||
    roleLabel(role);

  // For managers, Orders and Assignments open inside this dashboard
  // instead of on their own pages.
  const visibleNavigation = navigation
    .filter(allowedFor(role))
    .map((item) =>
      dashboardOnly && ["Orders", "Assignments"].includes(item.label)
        ? { ...item, path: undefined }
        : item
    );

  // ==========================================
  // NAVIGATION
  // ==========================================

  function selectSection(section) {
    setActiveSection(section);
    setSidebarOpen(false);
  }

  function handleNavigation(item) {
    setSidebarOpen(false);

    if (item.path) {
      navigate(item.path);
    } else {
      selectSection(item.label);
    }
  }

  function handleManagementClick(item) {
    if (item.path) {
      navigate(item.path);
    } else {
      selectSection(item.section);
    }
  }

  // ==========================================
  // LOGOUT
  // ==========================================

  async function handleLogout() {
    const refreshToken =
      sessionStorage.getItem("refreshToken");

    const accessToken =
      sessionStorage.getItem("accessToken");

    if (refreshToken) {
      try {
        await fetch(
          "http://127.0.0.1:8000/api/auth/logout/",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(accessToken
                ? {
                    Authorization: `Bearer ${accessToken}`,
                  }
                : {}),
            },
            body: JSON.stringify({
              refresh: refreshToken,
            }),
          }
        );
      } catch (error) {
        console.error(
          "Logout request failed:",
          error
        );
      }
    }

    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("refreshToken");
    sessionStorage.removeItem("user");

    navigate("/login", { replace: true });
  }

  // ==========================================
  // PAGE
  // ==========================================

  return (
    <div className="min-h-screen bg-transparent text-gray-900">

      {/* MOBILE BACKDROP */}

      {sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label="Close sidebar"
        />
      )}

      {/* SIDEBAR */}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[265px] flex-col cn-sidebar shadow-xl transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >

        {/* LOGO */}

        <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
          <Link
            to={canBrowseStore ? "/" : "/admin/dashboard"}
            className="flex items-center gap-2"
            aria-label="CartNest"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-400 text-green-950 shadow-sm">
              <ShoppingBag size={19} strokeWidth={2.2} />
            </span>
            <span className="text-xl font-extrabold tracking-tight text-white">
              cart<span className="text-yellow-400">nest</span>
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="text-green-100 lg:hidden"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* WORKSPACE LABEL */}

        <div className="px-6 pb-3 pt-7">
          <p className="px-3 text-[11px] font-semibold text-green-300/80">
            {roleLabel(role)} workspace
          </p>
        </div>

        {/* NAVIGATION */}

        <nav className="flex-1 space-y-1 px-4">
          {visibleNavigation.map((item) => {
            const Icon = item.icon;

            const selected =
              activeSection === item.label;

            return (
              <button
                key={item.label}
                type="button"
                onClick={() =>
                  handleNavigation(item)
                }
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[13px] font-medium transition ${
                  selected
                    ? "bg-yellow-400 font-semibold text-green-950 shadow-[0_8px_20px_-10px_rgba(250,204,21,0.8)]"
                    : "text-green-50/85 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon
                  size={18}
                  strokeWidth={1.7}
                />

                {item.label}

                {item.path && (
                  <ChevronRight
                    size={14}
                    className="ml-auto"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* ADMIN PROFILE */}

        <div className="border-t border-white/10 p-5">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-white/10 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-400 font-bold text-green-950">
              {displayName.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {displayName}
              </p>

              <p className="flex items-center gap-1 text-[11px] text-green-200">
                <ShieldCheck size={12} />
                {roleLabel(role)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-green-100 hover:bg-white/10 hover:text-white"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      {/* MAIN AREA */}

      <div className="lg:pl-[265px]">

        {/* TOP BAR */}

        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-gray-200 bg-white px-5 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() =>
                setSidebarOpen(true)
              }
              className="lg:hidden"
              aria-label="Open sidebar"
            >
              <Menu size={23} />
            </button>

            <div>
              <p className="text-xs text-gray-500">
                {roleLabel(role)}
              </p>

              <h1 className="text-lg font-bold">
                {activeSection}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {canSeeAllOrders(role) && <AdminNotificationBell />}

            {canBrowseStore && (
              <>
                <Link
                  to="/"
                  className="hidden items-center gap-2 text-xs font-semibold text-gray-600 hover:text-green-700 sm:flex"
                >
                  <Store size={17} />
                  View Store
                  <ArrowUpRight size={15} />
                </Link>

                <div className="hidden h-6 w-px bg-green-100 sm:block" />
              </>
            )}

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-yellow-400 text-sm font-bold text-green-950">
              {displayName
                .charAt(0)
                .toUpperCase()}
            </div>
          </div>
        </header>

        {/* CONTENT */}

        <main className="mx-auto max-w-[1500px] px-5 py-9 sm:px-8 lg:px-10">

          {/* PAGE INTRO */}

          {/* Green welcome banner with a yellow glow */}
          <div className="relative mb-8 flex flex-col justify-between gap-5 overflow-hidden rounded-2xl cn-band p-7 shadow-lg sm:flex-row sm:items-end sm:p-9">
            <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full border-[28px] border-yellow-300/25" />
            <div className="pointer-events-none absolute bottom-0 right-40 h-24 w-24 rounded-full bg-yellow-300/20 blur-2xl" />

            <div className="relative">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-yellow-200">
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-300" />
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
              </p>

              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                {activeSection === "Overview"
                  ? `Welcome back, ${displayName}.`
                  : activeSection}
              </h2>

              <p className="mt-2 max-w-xl text-sm text-green-50/90">
                {activeSection === "Overview"
                  ? "Here's your store management overview."
                  : activeSection === "My Work"
                  ? role === "delivery"
                    ? `Hi ${displayName}. Punch in to receive deliveries, one at a time.`
                    : `Hi ${displayName}. Punch in to receive orders, then pack them one at a time.`
                  : activeSection === "Deliveries"
                  ? `Hi ${displayName}. Watch packed orders get picked up and delivered.`
                  : activeSection === "Orders"
                  ? "Every order in the store. Open one to see its items, customer and status."
                  : activeSection === "Attendance"
                  ? canSeeAllOrders(role)
                    ? "Monthly attendance for store staff and delivery staff, from their punch in and out."
                    : `Hi ${displayName}. Your attendance for each month, from when you punch in and out.`
                  : activeSection === "Assignments"
                  ? "Who is on shift, what each person is packing or delivering, and the orders waiting."
                  : "Manage this part of your CartNest store."}
              </p>
            </div>

            {canBrowseStore && (
              <Link
                to="/"
                className="relative inline-flex items-center gap-2 self-start rounded-xl bg-yellow-400 px-5 py-3 text-xs font-bold text-green-950 shadow-md transition hover:bg-yellow-300 sm:self-end"
              >
                <ArrowLeft size={16} />
                Back to storefront
              </Link>
            )}
          </div>

          {activeSection === "My Work" ? (
            <EmployeeWorkspace />
          ) : activeSection === "Deliveries" ? (
            <ManagerDispatch />
          ) : activeSection === "Attendance" ? (
            <AttendanceReport />
          ) : activeSection === "Orders" && dashboardOnly ? (
            <AdminOrders embedded />
          ) : activeSection === "Assignments" && dashboardOnly ? (
            <AssignmentBoard />
          ) : activeSection === "Overview" ? (
            <>

              {/* STATISTICS */}

              {statsLoading && (
                <p className="mb-4 text-sm text-gray-600">Loading dashboard statistics...</p>
              )}
              {statsError && (
                <p role="alert" className="mb-4 border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                  {statsError}
                </p>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat) => {
                  const Icon = stat.icon;

                  return (
                    <div
                      key={stat.label}
                      className="border border-gray-200 cn-glass p-6"
                    >
                      <div className="flex items-start justify-between">
                        <p className="text-xs font-medium text-gray-500">
                          {stat.label}
                        </p>

                        <div className="rounded-lg bg-green-50 p-2.5 text-gray-600">
                          <Icon
                            size={19}
                            strokeWidth={1.7}
                          />
                        </div>
                      </div>

                      <p className="mt-5 font-serif text-4xl">
                        {stat.value}
                      </p>

                      <p className="mt-3 text-[11px] text-gray-500">
                        {stat.description}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* OVERVIEW PANELS */}

              <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">

                {/* SALES PANEL */}

                <div className="border border-gray-200 cn-glass p-7">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold">
                        Sales Overview
                      </h3>

                      <p className="mt-2 text-xs text-gray-500">
                        Revenue performance
                      </p>
                    </div>

                    <BarChart3
                      size={21}
                      className="text-green-700"
                    />
                  </div>

                  <div className="mt-8">
                    {statsLoading ? (
                      <div className="flex min-h-[240px] items-center justify-center text-sm text-gray-600">
                        Loading sales data...
                      </div>
                    ) : statsError ? (
                      <div className="flex min-h-[240px] items-center justify-center border border-dashed border-gray-200 p-6 text-center text-sm text-red-600">
                        {statsError}
                      </div>
                    ) : salesDays.length !== 7 ? (
                      <div className="flex min-h-[240px] items-center justify-center border border-dashed border-gray-200 p-6 text-center text-sm text-gray-600">
                        Seven-day sales data is unavailable. Check that your Django backend is running the updated views.py.
                      </div>
                    ) : (
                      <>
                        <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] text-gray-500">Last 7 days · paid orders</p>
                            <p className="mt-1 font-serif text-2xl text-gray-900">
                              {formatRupees(sevenDayRevenue)}
                            </p>
                          </div>
                          <span className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-medium text-gray-600">
                            {sevenDayOrders} paid {sevenDayOrders === 1 ? "order" : "orders"}
                          </span>
                        </div>
                        <div className="flex h-[215px] items-end gap-2 border-b border-gray-200 pb-2 sm:gap-4">
                          {salesDays.map((day) => {
                            const revenue = Number(day.revenue) || 0;
                            const barHeight = highestDailyRevenue > 0
                              ? (revenue / highestDailyRevenue) * 100
                              : 0;
                            const dayLabel = new Date(`${day.date}T12:00:00`).toLocaleDateString("en-IN", {
                              weekday: "short",
                            });
                            return (
                              <div key={day.date} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                                <div className="text-center text-[10px] font-medium text-gray-600 sm:text-xs" title={`${day.orders} paid orders`}>
                                  {revenue > 0 ? formatRupees(revenue) : "₹0"}
                                </div>
                                <div className="flex h-[145px] w-full items-end justify-center">
                                  <div
                                    className={`w-full max-w-[54px] rounded-t-md transition-all duration-300 ${revenue > 0 ? "cn-gradient-gold group-hover:bg-amber-500" : "bg-green-100"}`}
                                    style={{ height: `${revenue > 0 ? Math.max(8, barHeight) : 3}%` }}
                                    title={`${day.date}: ${formatRupees(revenue)} · ${day.orders} paid orders`}
                                  />
                                </div>
                                <span className="text-[11px] text-gray-500">{dayLabel}</span>
                              </div>
                            );
                          })}
                        </div>
                        <p className="mt-4 text-xs leading-5 text-gray-500">
                          {highestDailyRevenue === 0
                            ? "No paid sales during the last 7 days."
                            : "Daily revenue from currently paid, non-cancelled orders, grouped by order date."}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* STORE OVERVIEW */}

                <div className="border border-gray-200 cn-glass p-7">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold">
                      Store Overview
                    </h3>

                    <Store
                      size={20}
                      className="text-green-700"
                    />
                  </div>

                  <p className="mt-2 text-xs text-gray-500">
                    Your management workspace
                  </p>

                  <div className="mt-8 space-y-6">

                    {/* PRODUCTS */}

                    <div className="flex items-center gap-4">
                      <div className="rounded-lg bg-green-50 p-3">
                        <Package size={19} />
                      </div>

                      <div>
                        <p className="text-sm font-semibold">
                          Product Inventory
                        </p>

                        <Link
                          to="/admin/products"
                          className="mt-1 inline-block text-xs text-green-700 hover:underline"
                        >
                          Manage products →
                        </Link>
                      </div>
                    </div>

                    {/* CATEGORIES */}

                    <div className="flex items-center gap-4">
                      <div className="rounded-lg bg-green-50 p-3">
                        <Tags size={19} />
                      </div>

                      <div>
                        <p className="text-sm font-semibold">
                          Product Categories
                        </p>

                        <Link
                          to="/admin/categories"
                          className="mt-1 inline-block text-xs text-green-700 hover:underline"
                        >
                          Manage categories →
                        </Link>
                      </div>
                    </div>

                    {/* ORDERS */}

                    <div className="flex items-center gap-4">
                      <div className="rounded-lg bg-green-50 p-3">
                        <ShoppingBag size={19} />
                      </div>

                      <div>
                        <p className="text-sm font-semibold">
                          Order Processing
                        </p>

                        <Link
                          to="/admin/orders"
                          className="mt-1 inline-block text-xs text-green-700 hover:underline"
                        >
                          Manage orders →
                        </Link>
                      </div>
                    </div>

                    {/* CUSTOMERS */}

                    <div className="flex items-center gap-4">
                      <div className="rounded-lg bg-green-50 p-3">
                        <Users size={19} />
                      </div>

                      <div>
                        <p className="text-sm font-semibold">
                          Customer Accounts
                        </p>

                        <Link
                          to="/admin/customers"
                          className="mt-1 inline-block text-xs text-green-700 hover:underline"
                        >
                          Manage customer accounts →
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* MANAGEMENT SHORTCUTS */}

              <div className="mt-10">
                <div className="mb-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green-700">
                    Store operations
                  </p>

                  <h3 className="mt-3 font-serif text-3xl">
                    Manage your store
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {management.map((item) => {
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.title}
                        type="button"
                        onClick={() =>
                          handleManagementClick(item)
                        }
                        className="group flex items-center gap-5 border border-gray-200 cn-glass p-6 text-left transition hover:border-gray-400 hover:shadow-sm"
                      >
                        <div className="rounded-lg bg-green-50 p-4 text-gray-600">
                          <Icon
                            size={23}
                            strokeWidth={1.6}
                          />
                        </div>

                        <div className="flex-1">
                          <h4 className="text-sm font-semibold">
                            {item.title}
                          </h4>

                          <p className="mt-2 text-xs leading-5 text-gray-500">
                            {item.description}
                          </p>
                        </div>

                        <ChevronRight
                          size={18}
                          className="text-gray-500 transition group-hover:translate-x-1"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (

            /* PENDING SECTIONS */

            <div className="border border-gray-200 cn-glass p-7">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-lg font-semibold">
                    {activeSection} Management
                  </h3>

                  <p className="mt-2 text-sm text-gray-500">
                    This section will connect
                    to your Django backend.
                  </p>
                </div>

                <span className="self-start rounded-full bg-green-50 px-4 py-2 text-xs font-medium text-gray-600">
                  Integration pending
                </span>
              </div>

              <div className="mt-8 flex min-h-[300px] flex-col items-center justify-center border border-dashed border-gray-200 cn-glass-deep text-center">
                <Clock3
                  size={36}
                  strokeWidth={1.3}
                  className="text-gray-500"
                />

                <h4 className="mt-5 font-serif text-2xl">
                  {activeSection} coming soon
                </h4>

                <p className="mt-3 max-w-md text-sm leading-7 text-gray-500">
                  We'll build the real{" "}
                  {activeSection.toLowerCase()}{" "}
                  management features using
                  Django REST Framework.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    selectSection("Overview")
                  }
                  className="mt-7 flex items-center gap-2 border-b border-gray-900 pb-2 text-xs font-semibold"
                >
                  Return to overview
                  <ArrowLeft size={16} />
                </button>
              </div>
            </div>
          )}

          {/* FOOTER */}

          <footer className="mt-12 flex flex-col justify-between gap-3 border-t border-gray-200 py-6 text-xs text-gray-500 sm:flex-row">
            <p>
              © {new Date().getFullYear()} CartNest.
              Administration.
            </p>

            <p>
              Thoughtful commerce, beautifully managed.
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;
