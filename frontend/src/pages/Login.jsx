import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Eye,
  EyeOff,
  ArrowRight,
  LockKeyhole,
  UserRound,
  CheckCircle2,
  Package,
  Heart,
  Truck,
} from "lucide-react";
import { landsOnDashboard } from "../lib/staffRoles";
import StoreLogo from "../components/StoreLogo";

const PERKS = [
  { icon: Package, text: "Track your orders from placed to delivered" },
  { icon: Heart, text: "Save favourites to your wishlist" },
  { icon: Truck, text: "Cash on delivery, right to your door" },
];

function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  // Shown after a successful sign-up on the register page.
  const successMessage = location.state?.message || "";

  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/api/auth/login/",
        formData
      );

      const { access, refresh, user } = response.data;

      // Temporary development storage.
      // We'll improve token handling when creating AuthContext.
      sessionStorage.setItem("accessToken", access);
      sessionStorage.setItem("refreshToken", refresh);
      sessionStorage.setItem("user", JSON.stringify(user));

      // Managers and employees go straight to their dashboard;
      // admins and customers start on the store homepage.
      navigate(landsOnDashboard(user.role) ? "/admin/dashboard" : "/");
      window.location.reload();
    } catch (err) {
      const message =
        err.response?.data?.detail ||
        "Login failed. Please check your username and password.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white py-3 text-sm text-gray-900 outline-none transition focus:border-yellow-500 focus:ring-4 focus:ring-yellow-400/25";

  return (
    <div className="cn-light flex min-h-screen flex-col">
      {/* HEADER */}

      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <StoreLogo />

          <p className="text-sm text-gray-600">
            New here?{" "}
            <Link to="/register" className="font-semibold text-gray-900 underline-offset-4 hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </header>

      {/* CARD */}

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_-24px_rgba(0,0,0,0.25)] md:grid-cols-[0.9fr_1.1fr]">
          {/* Yellow side panel */}
          <div className="relative hidden flex-col justify-between overflow-hidden bg-yellow-400 p-10 text-gray-900 md:flex">
            <div className="relative z-10">
              <h1 className="text-3xl font-extrabold leading-tight">Welcome back</h1>
              <p className="mt-3 text-sm leading-6 text-gray-800">
                Sign in to pick up where you left off with your groceries and essentials.
              </p>

              <ul className="mt-8 space-y-4">
                {PERKS.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3 text-sm font-medium">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/70">
                      <Icon size={17} />
                    </span>
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            <img
              src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80"
              alt=""
              aria-hidden="true"
              className="relative z-10 mt-10 h-44 w-full rounded-xl object-cover shadow-lg"
            />

            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-yellow-300" />
          </div>

          {/* Form */}
          <div className="p-8 sm:p-12">
            <h2 className="text-2xl font-bold text-gray-900">Sign in</h2>
            <p className="mt-2 text-sm text-gray-500">Use your CartNest username and password.</p>

            {successMessage && !error && (
              <div role="status" className="mt-6 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                <CheckCircle2 size={17} className="shrink-0" />
                {successMessage}
              </div>
            )}

            {error && (
              <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div>
                <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Username
                </label>

                <div className="relative">
                  <UserRound size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />

                  <input
                    id="username"
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="Enter your username"
                    autoComplete="username"
                    required
                    className={`${inputClass} pl-11 pr-4`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Password
                </label>

                <div className="relative">
                  <LockKeyhole size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    className={`${inputClass} pl-11 pr-11`}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-bold text-gray-900 shadow-sm transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign in"}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>

            <div className="my-7 flex items-center gap-3 text-xs text-gray-400">
              <span className="h-px flex-1 bg-gray-200" />
              New to CartNest?
              <span className="h-px flex-1 bg-gray-200" />
            </div>

            <Link
              to="/register"
              className="flex w-full items-center justify-center rounded-lg border border-gray-300 py-3 text-sm font-semibold text-gray-900 transition hover:border-gray-400 hover:bg-gray-50"
            >
              Create your account
            </Link>

            <p className="mt-6 text-center text-xs text-gray-400">
              Customers and store staff use the same sign-in.
            </p>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} CartNest. All rights reserved.
      </footer>
    </div>
  );
}

export default Login;
