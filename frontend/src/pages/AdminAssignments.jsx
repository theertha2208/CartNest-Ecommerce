import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import AssignmentBoard from "../components/AssignmentBoard";

export default function AdminAssignments() {
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

            <h1 className="mt-3 font-serif text-3xl sm:text-4xl">Order Assignments</h1>

            <p className="mt-2 text-sm text-green-50/90">
              Who is on shift, what each employee is packing, and the orders waiting.
            </p>
          </div>

          <Link to="/" className="hidden text-2xl font-semibold tracking-[-0.04em] sm:block">
            cart<span className="text-yellow-300">nest</span>.
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-9">
        <AssignmentBoard />
      </main>
    </div>
  );
}
