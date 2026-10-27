import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  History,
  RefreshCw,
  AlertCircle,
  Loader2,
  PackagePlus,
  PackageMinus,
  PackageX,
  PackageCheck,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import { adminRequest } from "./adminApi";

const ACTION_FILTERS = [
  ["", "All activity"],
  ["product_created", "Products added"],
  ["product_deleted", "Products removed"],
  ["stock_added", "Stock added"],
  ["stock_removed", "Stock removed"],
  ["product_updated", "Product edits"],
];

const ROLE_FILTERS = [
  ["", "Anyone"],
  ["admin", "Admins"],
  ["manager", "Managers"],
];

const ACTION_STYLES = {
  product_created: { icon: PackageCheck, className: "bg-green-50 text-green-700" },
  product_deleted: { icon: PackageX, className: "bg-red-50 text-red-600" },
  stock_added: { icon: PackagePlus, className: "bg-green-50 text-green-700" },
  stock_removed: { icon: PackageMinus, className: "bg-amber-50 text-green-700" },
  product_updated: { icon: Pencil, className: "bg-green-50 text-gray-600" },
};

const ROLE_NAMES = {
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
};

function dateTimeLabel(value) {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatChange(change) {
  if (change > 0) return `+${change}`;
  return String(change);
}

export default function StockActivityLog() {
  const [data, setData] = useState(null);
  const [action, setAction] = useState("");
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [alerts, setAlerts] = useState(null);
  const [alertView, setAlertView] = useState("out");
  const [alertsError, setAlertsError] = useState("");

  function loadAlerts() {
    return adminRequest("/admin/stock-alerts/")
      .then((data) => {
        setAlerts(data);
        setAlertsError("");
      })
      .catch((err) => setAlertsError(err.message));
  }

  useEffect(() => {
    loadAlerts();
  }, []);

  function refresh() {
    loadLog();
    loadAlerts();
  }

  // Show a product's history by searching the log for it.
  function showHistory(product) {
    setAction("");
    setRole("");
    setSearch(product.name);
  }

  async function loadLog() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (action) params.set("action", action);
      if (role) params.set("role", role);
      if (search.trim()) params.set("search", search.trim());

      setData(await adminRequest(`/admin/stock-logs/?${params}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(loadLog, 250);
    return () => clearTimeout(timer);
  }, [action, role, search]);

  const logs = data?.results || [];

  const summary = [
    { label: "Matching entries", value: data?.count ?? "—" },
    { label: "Units added", value: data ? `+${data.units_added}` : "—" },
    { label: "Units removed", value: data ? `−${data.units_removed}` : "—" },
  ];

  const lowStockThreshold = alerts?.low_stock_threshold ?? 5;

  const alertViews = [
    {
      key: "out",
      label: "Out of stock",
      description: "0 units left",
      count: alerts?.out_of_stock_count,
      items: alerts?.out_of_stock || [],
      icon: PackageX,
      activeClass: "border-red-300 bg-red-50",
      countClass: "text-red-600",
    },
    {
      key: "low",
      label: "Low stock",
      description: `Less than ${lowStockThreshold + 1} units left`,
      count: alerts?.low_stock_count,
      items: alerts?.low_stock || [],
      icon: AlertTriangle,
      activeClass: "border-amber-400 bg-amber-50",
      countClass: "text-green-700",
    },
  ];

  const selectedAlert = alertViews.find((view) => view.key === alertView);

  const selectClass =
    "border border-gray-200 cn-glass-deep px-4 py-3 text-sm outline-none focus:border-yellow-500";

  return (
    <div className="min-h-screen bg-transparent text-gray-900">
      {/* HEADER */}

      <header className="cn-band shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5">
          <div>
            <Link
              to="/admin/dashboard"
              className="inline-flex items-center gap-2 text-xs font-semibold text-yellow-300 hover:underline"
            >
              <ArrowLeft size={15} />
              Back to Dashboard
            </Link>

            <h1 className="mt-3 font-serif text-3xl sm:text-4xl">
              Stock Activity Log
            </h1>

            <p className="mt-2 text-sm text-green-50/90">
              Who added or removed products and stock, and when.
            </p>
          </div>

          <Link
            to="/"
            className="hidden text-2xl font-semibold tracking-[-0.04em] sm:block"
          >
            cart<span className="text-yellow-300">nest</span>.
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-9">
        {/* SUMMARY */}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {summary.map((item) => (
            <div key={item.label} className="border border-gray-200 cn-glass p-6">
              <p className="text-xs font-medium text-gray-500">{item.label}</p>
              <p className="mt-3 font-serif text-3xl">{item.value}</p>
            </div>
          ))}
        </div>

        {/* OUT OF STOCK AND LOW STOCK */}

        <section className="mb-8 border border-gray-200 cn-glass">
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {alertViews.map((view) => {
              const Icon = view.icon;
              const active = alertView === view.key;

              return (
                <button
                  key={view.key}
                  type="button"
                  onClick={() => setAlertView(view.key)}
                  aria-pressed={active}
                  className={`flex items-center justify-between gap-4 border-b-2 p-5 text-left transition ${
                    active ? view.activeClass : "border-transparent hover:bg-green-100"
                  }`}
                >
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <Icon size={17} className={view.countClass} />
                      {view.label}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">{view.description}</p>
                  </div>

                  <span className={`font-serif text-4xl ${view.count ? view.countClass : "text-gray-500"}`}>
                    {view.count ?? "—"}
                  </span>
                </button>
              );
            })}
          </div>

          {alertsError ? (
            <p role="alert" className="border-t border-gray-200 p-5 text-sm text-red-600">
              {alertsError}
            </p>
          ) : !alerts ? (
            <p className="border-t border-gray-200 p-5 text-sm text-gray-600">
              Loading stock levels...
            </p>
          ) : selectedAlert.items.length === 0 ? (
            <p className="border-t border-gray-200 p-5 text-sm text-gray-600">
              No {selectedAlert.label.toLowerCase()} products. Every product is well stocked.
            </p>
          ) : (
            <div className="max-h-80 overflow-auto border-t border-gray-200">
              <table className="w-full min-w-[600px] text-left">
                <thead className="sticky top-0 cn-glass-deep">
                  <tr className="text-[11px] uppercase tracking-[0.12em] text-gray-600">
                    <th className="px-6 py-3 font-semibold">Product</th>
                    <th className="px-6 py-3 font-semibold">Category</th>
                    <th className="px-6 py-3 text-right font-semibold">In stock</th>
                    <th className="px-6 py-3 text-right font-semibold">History</th>
                  </tr>
                </thead>

                <tbody>
                  {selectedAlert.items.map((product) => (
                    <tr key={product.id} className="border-t border-gray-200">
                      <td className="px-6 py-3 text-sm font-semibold">
                        {product.name}
                        {!product.is_available && (
                          <span className="ml-2 text-[11px] font-normal text-gray-500">
                            (unavailable)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">{product.category_name}</td>
                      <td className={`px-6 py-3 text-right text-sm font-semibold ${selectedAlert.countClass}`}>
                        {product.stock}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => showHistory(product)}
                          className="text-xs font-semibold text-green-700 underline-offset-4 hover:underline"
                        >
                          View history
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-center gap-3 border border-red-200 bg-red-50 p-4 text-sm text-red-600"
          >
            <AlertCircle size={19} className="shrink-0" />
            {error}
          </div>
        )}

        {/* FILTERS */}

        <div className="mb-6 flex flex-col gap-3 border border-gray-200 cn-glass p-5 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
            />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product, staff member or note..."
              aria-label="Search stock activity"
              className="w-full border border-gray-200 cn-glass-deep py-3 pl-11 pr-4 text-sm outline-none focus:border-yellow-500"
            />
          </div>

          <select
            value={action}
            onChange={(event) => setAction(event.target.value)}
            aria-label="Filter by activity"
            className={selectClass}
          >
            {ACTION_FILTERS.map(([value, label]) => (
              <option key={value || "all"} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            aria-label="Filter by role"
            className={selectClass}
          >
            {ROLE_FILTERS.map(([value, label]) => (
              <option key={value || "anyone"} value={value}>
                {label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center justify-center gap-2 border border-gray-200 cn-glass-deep px-4 py-3 text-xs font-semibold hover:bg-green-100"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* LOG TABLE */}

        <div className="overflow-x-auto border border-gray-200 cn-glass">
          {loading && !data ? (
            <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-gray-600">
              <Loader2 size={21} className="animate-spin" />
              Loading activity...
            </div>
          ) : logs.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
              <History size={40} strokeWidth={1.3} className="text-gray-500" />

              <h3 className="mt-5 font-serif text-2xl">No stock activity found</h3>

              <p className="mt-2 text-sm text-gray-600">
                Product and stock changes by admins and managers will appear here.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[950px] text-left">
              <thead className="border-b border-gray-200 cn-glass-deep">
                <tr className="text-[11px] uppercase tracking-[0.12em] text-gray-600">
                  <th className="px-6 py-4 font-semibold">When</th>
                  <th className="px-6 py-4 font-semibold">Activity</th>
                  <th className="px-6 py-4 font-semibold">Product</th>
                  <th className="px-6 py-4 text-right font-semibold">Change</th>
                  <th className="px-6 py-4 text-right font-semibold">Stock</th>
                  <th className="px-6 py-4 font-semibold">Done by</th>
                  <th className="px-6 py-4 font-semibold">Note</th>
                </tr>
              </thead>

              <tbody>
                {logs.map((log) => {
                  const style = ACTION_STYLES[log.action] || ACTION_STYLES.product_updated;
                  const Icon = style.icon;

                  return (
                    <tr key={log.id} className="border-b border-gray-200 last:border-b-0">
                      <td className="whitespace-nowrap px-6 py-4 text-xs text-gray-600">
                        {dateTimeLabel(log.created_at)}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${style.className}`}
                        >
                          <Icon size={14} />
                          {log.action_label}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-sm font-semibold">
                        {log.product_name}
                        {log.product === null && (
                          <span className="ml-2 text-[11px] font-normal text-gray-500">
                            (deleted)
                          </span>
                        )}
                      </td>

                      <td
                        className={`px-6 py-4 text-right text-sm font-semibold ${
                          log.quantity_change > 0
                            ? "text-green-700"
                            : log.quantity_change < 0
                            ? "text-red-600"
                            : "text-gray-500"
                        }`}
                      >
                        {log.quantity_change === 0 ? "—" : formatChange(log.quantity_change)}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-right text-xs text-gray-600">
                        {log.stock_before} → <span className="text-sm text-gray-900">{log.stock_after}</span>
                      </td>

                      <td className="px-6 py-4">
                        <p className="text-sm">{log.performed_by_name || "Unknown"}</p>
                        <p className="mt-0.5 text-[11px] text-gray-500">
                          {ROLE_NAMES[log.performed_by_role] || "—"}
                        </p>
                      </td>

                      <td className="max-w-xs px-6 py-4 text-xs text-gray-600">
                        {log.note || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {data && data.count > logs.length && (
          <p className="mt-4 text-xs text-gray-500">
            Showing the latest {logs.length} of {data.count} entries. Use the filters to narrow down.
          </p>
        )}
      </main>
    </div>
  );
}
