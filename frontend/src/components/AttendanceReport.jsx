import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
  Clock,
  Timer,
  LogIn,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Eye,
} from "lucide-react";
import { adminRequest } from "../pages/adminApi";
import { canSeeAllOrders, getCurrentRole, roleLabel } from "../lib/staffRoles";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month, delta) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(year, value - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month) {
  const [year, value] = month.split("-").map(Number);
  return new Date(year, value - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function hoursLabel(seconds) {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function timeLabel(value) {
  return new Date(value).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function localISODate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Monthly staff attendance. Admins and managers see the whole team and can
// open anyone's month; store staff and delivery staff see their own.
export default function AttendanceReport() {
  const seesTeam = canSeeAllOrders(getCurrentRole());

  const [month, setMonth] = useState(currentMonth);
  const [personId, setPersonId] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ month });
    if (personId) params.set("user", personId);

    adminRequest(`/attendance/?${params}`)
      .then((result) => {
        if (!active) return;
        setData(result);
        setError("");
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [month, personId]);

  function changeMonth(delta) {
    setLoading(true);
    setMonth(shiftMonth(month, delta));
  }

  function openPerson(id) {
    setLoading(true);
    setPersonId(id);
  }

  const isCurrentMonth = month === currentMonth();
  const showingTeam = seesTeam && !personId;

  return (
    <div className="space-y-6">
      {/* MONTH SWITCHER */}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {seesTeam && personId && (
            <button
              type="button"
              onClick={() => openPerson(null)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              <ArrowLeft size={16} />
              All staff
            </button>
          )}
          <h3 className="text-lg font-bold text-gray-900">
            {showingTeam ? "Team attendance" : data?.person ? data.person.full_name : "My attendance"}
          </h3>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            aria-label="Previous month"
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-36 text-center text-sm font-semibold">{monthLabel(month)}</span>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            disabled={isCurrentMonth}
            aria-label="Next month"
            className="rounded-lg p-2 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} className="shrink-0" />
          {error}
        </div>
      )}

      {loading || !data ? (
        <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-gray-500">
          <Loader2 size={20} className="animate-spin" />
          Loading attendance...
        </div>
      ) : showingTeam ? (
        <TeamTable people={data.people || []} onOpen={openPerson} />
      ) : (
        <PersonMonth report={data} month={month} />
      )}
    </div>
  );
}

function TeamTable({ people, onOpen }) {
  if (people.length === 0) {
    return (
      <p className="rounded-2xl border border-gray-200 cn-glass p-8 text-center text-sm text-gray-500">
        No store staff or delivery staff yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 cn-glass">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-gray-200 text-xs text-gray-500">
          <tr>
            <th className="px-5 py-3.5 font-semibold">Staff member</th>
            <th className="px-5 py-3.5 font-semibold">Role</th>
            <th className="px-5 py-3.5 text-center font-semibold">Days present</th>
            <th className="px-5 py-3.5 text-center font-semibold">Shifts</th>
            <th className="px-5 py-3.5 text-right font-semibold">Hours worked</th>
            <th className="px-5 py-3.5 font-semibold">Now</th>
            <th className="px-5 py-3.5"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {people.map((person) => (
            <tr key={person.id} className="hover:bg-green-50/50">
              <td className="px-5 py-3">
                <p className="font-semibold text-gray-900">{person.full_name}</p>
                <p className="text-xs text-gray-500">@{person.username}{!person.is_active && " · deactivated"}</p>
              </td>
              <td className="px-5 py-3 text-gray-600">{roleLabel(person.role)}</td>
              <td className="px-5 py-3 text-center font-semibold">
                {person.days_present}
                {person.estimated_days > 0 && (
                  <span className="block text-[11px] font-normal text-amber-700">{person.estimated_days} estimated</span>
                )}
              </td>
              <td className="px-5 py-3 text-center">{person.shift_count}</td>
              <td className="px-5 py-3 text-right font-semibold">{hoursLabel(person.total_seconds)}</td>
              <td className="px-5 py-3">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    person.is_punched_in ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${person.is_punched_in ? "bg-green-500" : "bg-gray-400"}`} />
                  {person.is_punched_in ? "On shift" : "Off shift"}
                </span>
              </td>
              <td className="px-5 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onOpen(person.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-50"
                >
                  <Eye size={14} />
                  View month
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PersonMonth({ report, month }) {
  const days = report.days || [];
  const byDate = Object.fromEntries(days.map((day) => [day.date, day]));
  // Estimated days have no hours, so they're left out of the average.
  const timedDays = report.days_present - (report.estimated_days || 0);
  const average = timedDays ? report.total_seconds / timedDays : 0;

  // Calendar cells, weeks starting on Monday.
  const [year, value] = month.split("-").map(Number);
  const first = new Date(year, value - 1, 1);
  const daysInMonth = new Date(year, value, 0).getDate();
  const leadingBlanks = (first.getDay() + 6) % 7;
  const today = localISODate(new Date());

  const cards = [
    {
      label: "Days present",
      value: report.days_present,
      icon: CalendarCheck,
      hint: report.estimated_days ? `incl. ${report.estimated_days} estimated` : "",
    },
    { label: "Hours worked", value: hoursLabel(report.total_seconds), icon: Clock },
    { label: "Average per day", value: timedDays ? hoursLabel(average) : "—", icon: Timer },
    { label: "Shifts", value: report.shift_count, icon: LogIn },
  ];

  return (
    <div className="space-y-6">
      {report.person && (
        <p className="text-sm text-gray-500">
          {roleLabel(report.person.role)} · @{report.person.username}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, hint }) => (
          <div key={label} className="rounded-2xl border border-gray-200 cn-glass p-5">
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium text-gray-500">{label}</p>
              <span className="rounded-lg bg-yellow-100 p-1.5 text-yellow-700">
                <Icon size={16} />
              </span>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-gray-900">{value}</p>
            {hint && <p className="mt-1 text-xs text-amber-700">{hint}</p>}
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        {/* CALENDAR */}

        <section className="rounded-2xl border border-gray-200 cn-glass p-5">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-semibold text-gray-900">{monthLabel(month)}</h4>
            <p className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-green-500" /> Present</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-yellow-300" /> Estimated</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-gray-300 bg-white" /> Absent</span>
            </p>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center">
            {WEEKDAYS.map((day) => (
              <span key={day} className="pb-1 text-[11px] font-semibold text-gray-400">{day}</span>
            ))}

            {Array.from({ length: leadingBlanks }, (_, index) => <span key={`blank-${index}`} />)}

            {Array.from({ length: daysInMonth }, (_, index) => {
              const iso = `${month}-${String(index + 1).padStart(2, "0")}`;
              const worked = byDate[iso];
              const future = iso > today;

              return (
                <div
                  key={iso}
                  title={
                    worked
                      ? worked.estimated
                        ? worked.shifts[0]?.note || "Estimated"
                        : `${hoursLabel(worked.seconds)} worked`
                      : future
                      ? ""
                      : "Absent"
                  }
                  className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-xs ${
                    worked?.estimated
                      ? "border-yellow-400 bg-yellow-300 font-semibold text-yellow-900"
                      : worked
                      ? "border-green-600 bg-green-500 font-semibold text-white"
                      : future
                      ? "border-gray-100 bg-gray-50 text-gray-300"
                      : "border-gray-200 bg-white text-gray-500"
                  } ${iso === today ? "ring-2 ring-yellow-400 ring-offset-1" : ""}`}
                >
                  <span>{index + 1}</span>
                  {worked && (
                    <span className={`text-[10px] font-medium ${worked.estimated ? "text-yellow-800" : "text-green-50"}`}>
                      {worked.estimated ? "Est." : hoursLabel(worked.seconds)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* DAILY LOG */}

        <section className="rounded-2xl border border-gray-200 cn-glass">
          <h4 className="border-b border-gray-200 px-5 py-4 font-semibold text-gray-900">Daily log</h4>

          {days.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">No shifts recorded this month.</p>
          ) : (
            <ul className="max-h-[420px] divide-y divide-gray-100 overflow-y-auto">
              {[...days].reverse().map((day) => (
                <li key={day.date} className="flex items-start justify-between gap-4 px-5 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {new Date(`${day.date}T12:00:00`).toLocaleDateString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                    {day.shifts.map((shift) =>
                      shift.estimated ? (
                        <p key={shift.punched_in_at} className="mt-0.5 text-xs text-amber-700">
                          {shift.note || "Estimated"} · punch times not recorded
                        </p>
                      ) : (
                        <p key={shift.punched_in_at} className="mt-0.5 text-xs text-gray-500">
                          {timeLabel(shift.punched_in_at)} –{" "}
                          {shift.open ? <span className="font-semibold text-green-700">on shift now</span> : timeLabel(shift.punched_out_at)}
                        </p>
                      )
                    )}
                  </div>
                  {day.estimated ? (
                    <span className="shrink-0 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-800">
                      Estimated
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                      {hoursLabel(day.seconds)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
