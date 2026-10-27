import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import AdminNotificationBell from "../components/AdminNotificationBell";
import OrdersTable from "../components/OrdersTable";

// All orders as a compact list; each row opens the full order details.
// `embedded` renders just the list, for use inside the manager dashboard.
export default function AdminOrders({ embedded = false }) {
  if (embedded) return <OrdersTable />;

  return (
    <div className="min-h-screen bg-transparent text-gray-900">
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

            <h1 className="mt-3 font-serif text-3xl sm:text-4xl">Orders</h1>

            <p className="mt-2 text-sm text-green-50/90">
              Every order in the store. Open one to see its items, customer and status.
            </p>
          </div>

          <AdminNotificationBell />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-9">
        <OrdersTable />
      </main>
    </div>
  );
}
