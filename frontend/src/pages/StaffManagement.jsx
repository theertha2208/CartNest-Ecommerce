import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  UserCog,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  Check,
} from "lucide-react";
import { adminRequest, dateLabel } from "./adminApi";
import { getCurrentRole } from "../lib/staffRoles";

const emptyForm = {
  username: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  role: "employee",
  password: "",
  is_active: true,
};

// [role filter, approval filter, label]; managers don't see the Managers tab.
const FILTERS = [
  ["", "", "All"],
  ["manager", "", "Managers"],
  ["employee", "", "Staff"],
  ["delivery", "", "Delivery"],
  ["", "pending", "Pending approval"],
];

const ROLE_NAMES = {
  manager: "Manager",
  employee: "Staff",
  delivery: "Delivery Staff",
};

const ROLE_BADGES = {
  manager: "bg-amber-50 text-green-700",
  employee: "bg-green-50 text-gray-600",
  delivery: "bg-sky-50 text-sky-700",
};

const ROLE_DESCRIPTIONS = {
  employee: "Punches in, packs one assigned order at a time, views products and categories.",
  delivery: "Punches in, picks up one packed order at a time and marks it shipped, then delivered.",
  manager: "Adds store staff and delivery staff, manages products and stock, monitors all orders.",
};

// adminRequest puts field errors in the message as JSON; show them as text.
function readableError(message) {
  try {
    const data = JSON.parse(message);
    return Object.entries(data)
      .map(([field, value]) =>
        `${field.replace("_", " ")}: ${[].concat(value).join(" ")}`
      )
      .join(" ");
  } catch {
    return message;
  }
}

export default function StaffManagement() {
  // Admins manage everyone and approve accounts. Managers add staff and
  // delivery staff, whose accounts wait for an admin's approval.
  const isAdmin = getCurrentRole() === "admin";
  const creatableRoles = isAdmin ? ["manager", "employee", "delivery"] : ["employee", "delivery"];
  const filters = FILTERS.filter(([role]) => isAdmin || role !== "manager");

  const [staff, setStaff] = useState([]);
  const [roleFilter, setRoleFilter] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadStaff() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (roleFilter) params.set("role", roleFilter);
      if (approvalFilter) params.set("approval", approvalFilter);
      if (search.trim()) params.set("search", search.trim());

      setStaff(await adminRequest(`/admin/staff/?${params}`));
    } catch (err) {
      setError(readableError(err.message));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(loadStaff, 250);
    return () => clearTimeout(timer);
  }, [roleFilter, approvalFilter, search]);

  function openCreateModal() {
    setEditing(null);
    setForm(emptyForm);
    setShowPassword(false);
    setFormError("");
    setNotice("");
    setModalOpen(true);
  }

  function openEditModal(member) {
    setEditing(member);
    setForm({
      username: member.username,
      first_name: member.first_name || "",
      last_name: member.last_name || "",
      email: member.email || "",
      phone: member.phone || "",
      role: member.role,
      password: "",
      is_active: member.is_active,
    });
    setShowPassword(false);
    setFormError("");
    setNotice("");
    setModalOpen(true);
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const payload = { ...form };

      // A blank password while editing keeps the current one.
      if (editing && !payload.password) delete payload.password;

      if (editing) {
        await adminRequest(`/admin/staff/${editing.id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setNotice(`${payload.username}'s account was updated.`);
      } else {
        await adminRequest("/admin/staff/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setNotice(
          isAdmin
            ? `${ROLE_NAMES[payload.role]} account "${payload.username}" created. ` +
                "They can now sign in with this username and password."
            : `${ROLE_NAMES[payload.role]} account "${payload.username}" sent to the admin ` +
                "for approval. They can sign in once it's approved."
        );
      }

      setModalOpen(false);
      await loadStaff();
    } catch (err) {
      setFormError(readableError(err.message));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(member) {
    const action = member.is_active ? "deactivate" : "reactivate";

    if (
      member.is_active &&
      !window.confirm(`Deactivate ${member.username}? They will no longer be able to sign in.`)
    ) {
      return;
    }

    setBusyId(member.id);
    setError("");
    setNotice("");

    try {
      await adminRequest(`/admin/staff/${member.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !member.is_active }),
      });
      setNotice(`${member.username}'s account was ${action}d.`);
      await loadStaff();
    } catch (err) {
      setError(readableError(err.message));
    } finally {
      setBusyId(null);
    }
  }

  async function decide(member, decision) {
    if (
      decision === "reject" &&
      !window.confirm(`Reject ${member.username}'s account? They will not be able to sign in.`)
    ) {
      return;
    }

    setBusyId(member.id);
    setError("");
    setNotice("");

    try {
      await adminRequest(`/admin/staff/${member.id}/approve/`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      setNotice(
        decision === "approve"
          ? `${member.username} approved. They can now sign in.`
          : `${member.username}'s account was rejected.`
      );
      await loadStaff();
    } catch (err) {
      setError(readableError(err.message));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(member) {
    if (!window.confirm(`Permanently delete ${member.username}'s staff account?`)) return;

    setBusyId(member.id);
    setError("");
    setNotice("");

    try {
      await adminRequest(`/admin/staff/${member.id}/`, { method: "DELETE" });
      setNotice(`${member.username}'s account was deleted.`);
      await loadStaff();
    } catch (err) {
      setError(readableError(err.message));
    } finally {
      setBusyId(null);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-gray-200 cn-glass px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-yellow-500";

  const labelClass = "mb-2 block text-xs font-semibold text-gray-600";

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
              Staff Management
            </h1>

            <p className="mt-2 text-sm text-green-50/90">
              {isAdmin
                ? "Add managers, approve store staff and delivery staff added by managers."
                : "Add store staff and delivery staff. Accounts can sign in once an admin approves them."}
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
        {/* ACTION BAR */}

        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green-700">
              Team
            </p>

            <h2 className="mt-2 text-2xl font-semibold">Store Staff</h2>

            <p className="mt-2 text-sm text-gray-600">
              {staff.length} {staff.length === 1 ? "account" : "accounts"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={loadStaff}
              className="inline-flex items-center gap-2 border border-gray-200 cn-glass px-4 py-3 text-xs font-semibold hover:bg-green-100"
            >
              <RefreshCw size={16} />
              Refresh
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 cn-gradient-gold px-5 py-3 text-xs font-semibold text-gray-900 hover:bg-amber-500"
            >
              <Plus size={17} />
              Add Staff Member
            </button>
          </div>
        </div>

        {/* MESSAGES */}

        {notice && (
          <div
            role="status"
            className="mb-6 flex items-center gap-3 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
          >
            <CheckCircle2 size={19} className="shrink-0" />
            {notice}
          </div>
        )}

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

        <div className="mb-6 flex flex-col gap-4 border border-gray-200 cn-glass p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {filters.map(([role, approval, label]) => {
              const active = roleFilter === role && approvalFilter === approval;

              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setRoleFilter(role);
                    setApprovalFilter(approval);
                  }}
                  aria-pressed={active}
                  className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                    active
                      ? "border-yellow-400 cn-gradient-gold text-gray-900"
                      : "border-gray-200 text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:max-w-sm">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
            />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, username or email..."
              aria-label="Search staff"
              className="w-full border border-gray-200 cn-glass-deep py-3 pl-11 pr-4 text-sm outline-none focus:border-yellow-500"
            />
          </div>
        </div>

        {/* STAFF TABLE */}

        <div className="overflow-x-auto border border-gray-200 cn-glass">
          {loading && staff.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-gray-600">
              <Loader2 size={21} className="animate-spin" />
              Loading staff...
            </div>
          ) : staff.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
              <UserCog size={40} strokeWidth={1.3} className="text-gray-500" />

              <h3 className="mt-5 font-serif text-2xl">No staff accounts yet</h3>

              <p className="mt-2 text-sm text-gray-600">
                {isAdmin
                  ? "Add a manager, staff member or delivery staff member to give them access."
                  : "Add a staff member or delivery staff member. An admin approves new accounts."}
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[900px] text-left">
              <thead className="border-b border-gray-200 cn-glass-deep">
                <tr className="text-[11px] uppercase tracking-[0.12em] text-gray-600">
                  <th className="px-6 py-4 font-semibold">Staff member</th>
                  <th className="px-6 py-4 font-semibold">Role</th>
                  <th className="px-6 py-4 font-semibold">Contact</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Added</th>
                  <th className="px-6 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>

              <tbody>
                {staff.map((member) => (
                  <tr
                    key={member.id}
                    className="border-b border-gray-200 last:border-b-0"
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold">{member.full_name}</p>
                      <p className="mt-1 text-xs text-gray-500">@{member.username}</p>
                    </td>

                    <td className="px-6 py-4">
                      <span className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${ROLE_BADGES[member.role] || ""}`}>
                        {ROLE_NAMES[member.role] || member.role}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-600">
                      <p>{member.email || "—"}</p>
                      {member.phone && <p className="mt-1 text-xs">{member.phone}</p>}
                    </td>

                    <td className="px-6 py-4">
                      {member.approval_status === "approved" ? (
                        <span
                          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                            member.is_active
                              ? "bg-green-50 text-green-700"
                              : "bg-amber-50 text-red-600"
                          }`}
                        >
                          {member.is_active ? "Active" : "Deactivated"}
                        </span>
                      ) : (
                        <span
                          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
                            member.approval_status === "pending"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          {member.approval_status === "pending" ? "Pending approval" : "Rejected"}
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-xs text-gray-600">
                      <p>{dateLabel(member.date_joined)}</p>
                      {member.created_by && (
                        <p className="mt-1 text-gray-500">by {member.created_by}</p>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {/* Approving and activating accounts is for admins. */}
                        {isAdmin && member.approval_status === "pending" && (
                          <>
                            <button
                              type="button"
                              onClick={() => decide(member, "approve")}
                              disabled={busyId === member.id}
                              className="inline-flex items-center gap-1.5 rounded-lg cn-gradient-gold px-3 py-2.5 text-xs font-semibold text-gray-900 disabled:opacity-50"
                            >
                              <Check size={14} />
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => decide(member, "reject")}
                              disabled={busyId === member.id}
                              className="rounded-lg border border-red-200 px-3 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {isAdmin && member.approval_status === "approved" && (
                          <button
                            type="button"
                            onClick={() => toggleActive(member)}
                            disabled={busyId === member.id}
                            className="rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-semibold hover:bg-green-100 disabled:opacity-50"
                          >
                            {member.is_active ? "Deactivate" : "Reactivate"}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => openEditModal(member)}
                          className="rounded-lg border border-gray-200 p-2.5 hover:bg-green-100"
                          aria-label={`Edit ${member.username}`}
                        >
                          <Pencil size={16} />
                        </button>

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDelete(member)}
                            disabled={busyId === member.id}
                            className="rounded-lg border border-red-200 p-2.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                            aria-label={`Delete ${member.username}`}
                          >
                            {busyId === member.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* ADD / EDIT MODAL */}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editing ? "Edit staff member" : "Add staff member"}
            className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden cn-glass-deep shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-green-700">
                  Store Staff
                </p>

                <h2 className="mt-2 font-serif text-3xl">
                  {editing ? `Edit ${editing.username}` : "Add Staff Member"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2"
                aria-label="Close form"
              >
                <X size={22} />
              </button>
            </div>

            <form
              id="staff-form"
              onSubmit={handleSubmit}
              className="space-y-5 overflow-y-auto px-6 py-6"
            >
              {formError && (
                <div
                  role="alert"
                  className="border border-red-200 bg-red-50 p-4 text-sm text-red-600"
                >
                  {formError}
                </div>
              )}

              {/* ROLE */}

              <fieldset>
                <legend className={labelClass}>Role *</legend>

                <div className={`grid gap-3 ${creatableRoles.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                  {creatableRoles.map((role) => (
                    <label
                      key={role}
                      className={`cursor-pointer border p-4 transition ${
                        form.role === role
                          ? "border-yellow-400 bg-yellow-50"
                          : "border-gray-200 hover:bg-green-50"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <input
                          type="radio"
                          name="role"
                          value={role}
                          checked={form.role === role}
                          onChange={handleChange}
                          className="accent-yellow-500"
                        />
                        {ROLE_NAMES[role]}
                      </span>

                      <span className="mt-2 block text-xs leading-5 text-gray-500">
                        {ROLE_DESCRIPTIONS[role]}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* NAME */}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="staff-first-name" className={labelClass}>
                    First Name
                  </label>
                  <input
                    id="staff-first-name"
                    name="first_name"
                    value={form.first_name}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="staff-last-name" className={labelClass}>
                    Last Name
                  </label>
                  <input
                    id="staff-last-name"
                    name="last_name"
                    value={form.last_name}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* LOGIN DETAILS */}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="staff-username" className={labelClass}>
                    Username *
                  </label>
                  <input
                    id="staff-username"
                    name="username"
                    value={form.username}
                    onChange={handleChange}
                    required
                    autoComplete="off"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="staff-password" className={labelClass}>
                    {editing ? "New Password" : "Password *"}
                  </label>
                  <div className="relative">
                    <input
                      id="staff-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={handleChange}
                      required={!editing}
                      autoComplete="new-password"
                      placeholder={editing ? "Leave blank to keep current" : ""}
                      className={`${inputClass} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* CONTACT */}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="staff-email" className={labelClass}>
                    Email
                  </label>
                  <input
                    id="staff-email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="staff-phone" className={labelClass}>
                    Phone
                  </label>
                  <input
                    id="staff-phone"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>

              {editing && isAdmin && editing.approval_status === "approved" && (
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={form.is_active}
                    onChange={handleChange}
                    className="accent-yellow-500"
                  />
                  Account active (can sign in)
                </label>
              )}
            </form>

            <div className="flex justify-end gap-3 border-t border-gray-200 cn-glass px-6 py-5">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="border border-gray-200 px-5 py-3 text-xs font-semibold"
              >
                Cancel
              </button>

              <button
                type="submit"
                form="staff-form"
                disabled={saving}
                className="flex items-center gap-2 cn-gradient-gold px-6 py-3 text-xs font-semibold text-gray-900 hover:bg-amber-500 disabled:opacity-60"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? "Saving..." : editing ? "Save Changes" : "Create Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
