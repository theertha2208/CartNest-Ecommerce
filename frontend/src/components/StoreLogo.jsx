import { Link } from "react-router-dom";
import { ShoppingBag } from "lucide-react";

// The CartNest wordmark for the light storefront pages.
export default function StoreLogo({ className = "" }) {
  return (
    <Link to="/" className={`flex shrink-0 items-center gap-2 ${className}`} aria-label="CartNest home">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-400 text-gray-900 shadow-sm">
        <ShoppingBag size={19} strokeWidth={2.2} />
      </span>
      <span className="text-xl font-extrabold tracking-tight text-gray-900">
        cart<span className="text-yellow-500">nest</span>
      </span>
    </Link>
  );
}
