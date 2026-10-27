import { Link, NavLink, useNavigate } from "react-router-dom";
import { Wallet, Store, Package, Heart, UserRound, LogOut } from "lucide-react";
import StoreLogo from "./StoreLogo";
import { getStoredUser } from "../lib/staffRoles";

const API_BASE = "http://127.0.0.1:8000";

const LINKS = [
  { to: "/", label: "Shop", icon: Store, end: true },
  { to: "/orders", label: "My Orders", icon: Package },
  { to: "/wishlist", label: "Wishlist", icon: Heart },
  { to: "/profile", label: "My Profile", icon: UserRound },
];

// Header for the customer account pages, matching the shop's header.
export default function CustomerHeader() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const displayName = user?.first_name || user?.username || "";

  async function handleLogout() {
    const refresh = sessionStorage.getItem("refreshToken");
    const access = sessionStorage.getItem("accessToken");

    if (refresh) {
      try {
        await fetch(`${API_BASE}/api/auth/logout/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(access ? { Authorization: `Bearer ${access}` } : {}),
          },
          body: JSON.stringify({ refresh }),
        });
      } catch (err) {
        console.error("Logout error:", err);
      }
    }

    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("refreshToken");
    sessionStorage.removeItem("user");
    navigate("/");
  }

  return (
    <>
      <div className="bg-gray-900 text-xs text-gray-200">
        <p className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 sm:px-6">
          <Wallet size={14} className="text-yellow-400" />
          Cash on delivery available
          <span className="hidden text-gray-500 sm:inline">|</span>
          <span className="hidden sm:inline">Cancel any time before shipping</span>
        </p>
      </div>

      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <StoreLogo />

          <nav className="cn-no-scrollbar ml-2 flex flex-1 gap-1 overflow-x-auto" aria-label="Account">
            {LINKS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                    isActive
                      ? "bg-yellow-100 font-semibold text-gray-900"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`
                }
              >
                <Icon size={17} />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>

          {user && (
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-2 text-sm text-gray-700 md:flex">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100 font-bold text-yellow-800">
                  {displayName.charAt(0).toUpperCase()}
                </span>
                Hi, <span className="font-semibold">{displayName}</span>
              </span>

              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              >
                <LogOut size={17} />
                <span className="hidden lg:inline">Logout</span>
              </button>
            </div>
          )}
        </div>
      </header>
    </>
  );
}

// Footer for the customer account pages.
export function CustomerFooter() {
  return (
    <footer className="mt-12 border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <StoreLogo />
        <div className="flex flex-wrap justify-center gap-5 text-sm text-gray-600">
          <Link to="/" className="hover:text-gray-900">Shop</Link>
          <Link to="/orders" className="hover:text-gray-900">My Orders</Link>
          <Link to="/wishlist" className="hover:text-gray-900">Wishlist</Link>
          <Link to="/profile" className="hover:text-gray-900">My Profile</Link>
        </div>
        <p className="text-xs text-gray-400">© {new Date().getFullYear()} CartNest. All rights reserved.</p>
      </div>
    </footer>
  );
}
