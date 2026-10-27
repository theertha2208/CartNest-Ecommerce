import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  UserRound,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import StoreLogo from "../components/StoreLogo";

const BENEFITS = [
  "Fresh groceries and everyday essentials",
  "Save favourites and reorder quickly",
  "Track every order to your door",
  "Cash on delivery available",
];

function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    password: "",
    confirm_password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

    if (formData.password !== formData.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await axios.post(
        "http://127.0.0.1:8000/api/auth/register/",
        formData
      );

      // Registration succeeded. User can now log in.
      navigate("/login", {
        state: {
          message: "Account created successfully! Please sign in.",
        },
      });
    } catch (err) {
      const data = err.response?.data;

      if (data && typeof data === "object") {
        const messages = Object.entries(data).flatMap(
          ([field, errors]) => {
            const values = Array.isArray(errors) ? errors : [errors];

            return values.map((message) => `${field}: ${message}`);
          }
        );

        setError(messages.join(" "));
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white py-3 text-sm text-gray-900 outline-none transition focus:border-yellow-500 focus:ring-4 focus:ring-yellow-400/25";

  const labelClass = "mb-1.5 block text-sm font-medium text-gray-700";

  return (
    <div className="cn-light flex min-h-screen flex-col">
      {/* HEADER */}

      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <StoreLogo />

          <p className="text-sm text-gray-600">
            Already a customer?{" "}
            <Link to="/login" className="font-semibold text-gray-900 underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </header>

      {/* CARD */}

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_-24px_rgba(0,0,0,0.25)] md:grid-cols-[0.8fr_1.2fr]">
          {/* Yellow side panel */}
          <div className="relative hidden flex-col overflow-hidden bg-yellow-400 p-10 text-gray-900 md:flex">
            <div className="relative z-10">
              <h1 className="text-3xl font-extrabold leading-tight">
                Looks like you're new here!
              </h1>
              <p className="mt-3 text-sm leading-6 text-gray-800">
                Create a free account in under a minute and start shopping.
              </p>

              <ul className="mt-8 space-y-3.5">
                {BENEFITS.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm font-medium">
                    <CheckCircle2 size={18} className="shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <img
              src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80"
              alt=""
              aria-hidden="true"
              className="relative z-10 mt-auto h-48 w-full rounded-xl object-cover shadow-lg"
            />

            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-yellow-300" />
          </div>

          {/* Form */}
          <div className="p-8 sm:p-12">
            <h2 className="text-2xl font-bold text-gray-900">Create your account</h2>
            <p className="mt-2 text-sm text-gray-500">A few details and you're ready to shop.</p>

            {error && (
              <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="first_name" className={labelClass}>First name</label>
                  <input
                    id="first_name"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    placeholder="First name"
                    autoComplete="given-name"
                    required
                    className={`${inputClass} px-4`}
                  />
                </div>

                <div>
                  <label htmlFor="last_name" className={labelClass}>Last name</label>
                  <input
                    id="last_name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    placeholder="Last name"
                    autoComplete="family-name"
                    required
                    className={`${inputClass} px-4`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="username" className={labelClass}>Username</label>
                <div className="relative">
                  <UserRound size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="Choose a username"
                    autoComplete="username"
                    required
                    className={`${inputClass} pl-11 pr-4`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className={labelClass}>Email address</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className={`${inputClass} pl-11 pr-4`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="password" className={labelClass}>Password</label>
                  <div className="relative">
                    <LockKeyhole size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Create a password"
                      autoComplete="new-password"
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

                <div>
                  <label htmlFor="confirm_password" className={labelClass}>Confirm password</label>
                  <div className="relative">
                    <LockKeyhole size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      id="confirm_password"
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirm_password"
                      value={formData.confirm_password}
                      onChange={handleChange}
                      placeholder="Repeat password"
                      autoComplete="new-password"
                      required
                      className={`${inputClass} pl-11 pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Use at least 8 characters, and avoid common or all-number passwords.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-400 py-3 text-sm font-bold text-gray-900 shadow-sm transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Creating account..." : "Create account"}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-600">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-gray-900 underline-offset-4 hover:underline">
                Sign in
              </Link>
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

export default Register;
