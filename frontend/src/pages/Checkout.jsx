
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  ArrowRight,
  ShoppingBag,
  MapPin,
  UserRound,
  Phone,
  CreditCard,
  ShieldCheck,
  Truck,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ImageOff,
  House,
  BriefcaseBusiness,
  Navigation,
  Plus,
  Pencil,
} from "lucide-react";
import CustomerHeader, { CustomerFooter } from "../components/CustomerHeader";
import { getProductImageUrl, isDemoImage } from "../lib/productImages";

// ==========================================
// API CONFIGURATION
// ==========================================

const API_BASE = "http://127.0.0.1:8000";

const EMPTY_DELIVERY = {
  full_name: "",
  phone: "",
  address: "",
  city: "",
  state: "Kerala",
  postal_code: "",
  payment_method: "cod",
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function formatPrice(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getErrorMessage(data, fallback) {
  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (typeof data?.non_field_errors?.[0] === "string") {
    return data.non_field_errors[0];
  }

  for (const [field, messages] of Object.entries(data || {})) {
    if (Array.isArray(messages) && messages.length > 0) {
      return `${field.replaceAll("_", " ")}: ${messages[0]}`;
    }

    if (typeof messages === "string") {
      return `${field.replaceAll("_", " ")}: ${messages}`;
    }
  }

  return fallback;
}

function getAddressIcon(label) {
  if (label === "home") return House;
  if (label === "work") return BriefcaseBusiness;
  return Navigation;
}

function formatAddressLabel(label) {
  if (!label) return "Other";

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getDeliveryFromAddress(address) {
  return {
    full_name: address.full_name || "",
    phone: address.phone || "",
    address: address.address || "",
    city: address.city || "",
    state: address.state || "Kerala",
    postal_code: address.postal_code || "",
    payment_method: "cod",
  };
}

// ==========================================
// AUTHENTICATED API REQUEST
// ==========================================

async function authenticatedRequest(endpoint, options = {}) {
  let accessToken = sessionStorage.getItem("accessToken");

  if (!accessToken) {
    throw new Error("Please sign in to continue.");
  }

  async function sendRequest(token) {
    return fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  }

  let response = await sendRequest(accessToken);

  if (response.status === 401) {
    const refreshToken = sessionStorage.getItem("refreshToken");

    if (refreshToken) {
      const refreshResponse = await fetch(
        `${API_BASE}/api/auth/refresh/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            refresh: refreshToken,
          }),
        }
      );

      if (refreshResponse.ok) {
        const data = await refreshResponse.json();

        accessToken = data.access;

        sessionStorage.setItem("accessToken", accessToken);

        if (data.refresh) {
          sessionStorage.setItem("refreshToken", data.refresh);
        }

        response = await sendRequest(accessToken);
      }
    }
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        data,
        response.status === 401
          ? "Your session has expired. Please sign in again."
          : "Something went wrong. Please try again."
      )
    );
  }

  return data;
}

// ==========================================
// DELIVERY INPUT COMPONENT
// ==========================================

function DeliveryField({
  label,
  name,
  value,
  onChange,
  placeholder,
  icon: Icon,
  type = "text",
  maxLength,
  pattern,
  inputMode,
  multiline = false,
}) {
  const commonProps = {
    id: name,
    name,
    value,
    onChange,
    required: true,
    placeholder,
    maxLength,
    className:
      "w-full border border-gray-300 cn-glass px-4 py-4 text-sm outline-none transition focus:border-yellow-500",
  };

  return (
    <div className={multiline ? "sm:col-span-2" : ""}>
      <label
        htmlFor={name}
        className="mb-2 block text-xs font-semibold text-gray-900"
      >
        {label} *
      </label>

      {multiline ? (
        <textarea
          {...commonProps}
          rows={4}
          className={`${commonProps.className} resize-none`}
        />
      ) : (
        <div className="relative">
          {Icon && (
            <Icon
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
            />
          )}

          <input
            {...commonProps}
            type={type}
            pattern={pattern}
            inputMode={inputMode}
            className={`${commonProps.className} ${
              Icon ? "pl-12" : ""
            }`}
          />
        </div>
      )}
    </div>
  );
}

// ==========================================
// CHECKOUT PAGE
// ==========================================

export default function Checkout() {
  const navigate = useNavigate();

  const [cart, setCart] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [useManualAddress, setUseManualAddress] = useState(true);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [addressWarning, setAddressWarning] = useState("");
  const [successOrder, setSuccessOrder] = useState(null);

  const [customerDefaults, setCustomerDefaults] = useState({
    ...EMPTY_DELIVERY,
  });

  const [form, setForm] = useState({
    ...EMPTY_DELIVERY,
  });

  // ==========================================
  // LOAD CART, PROFILE, AND SAVED ADDRESSES
  // ==========================================

  useEffect(() => {
    const token = sessionStorage.getItem("accessToken");

    if (!token) {
      navigate("/login");
      return;
    }

    let active = true;

    async function loadCheckoutData() {
      setLoading(true);
      setError("");
      setAddressWarning("");

      try {
        // Cart and authentication are required.
        const [cartData, userData] = await Promise.all([
          authenticatedRequest("/api/cart/"),
          authenticatedRequest("/api/auth/me/"),
        ]);

        if (!active) return;

        setCart(cartData);

        const defaults = {
          ...EMPTY_DELIVERY,
          full_name:
            [userData.first_name, userData.last_name]
              .filter(Boolean)
              .join(" ") ||
            userData.username ||
            "",
        };

        // Saved addresses are optional. Checkout should
        // still work if no addresses are available.
        const addressResult = await Promise.allSettled([
          authenticatedRequest("/api/profile/"),
          authenticatedRequest("/api/addresses/"),
        ]);

        if (!active) return;

        const [profileResult, addressesResult] = addressResult;

        if (profileResult.status === "fulfilled") {
          const profile = profileResult.value;

          defaults.full_name =
            [profile.first_name, profile.last_name]
              .filter(Boolean)
              .join(" ") || defaults.full_name;

          defaults.phone = profile.phone || "";
        }

        setCustomerDefaults(defaults);

        if (addressesResult.status === "fulfilled") {
          const responseData = addressesResult.value;

          const savedAddresses = Array.isArray(responseData)
            ? responseData
            : Array.isArray(responseData?.results)
            ? responseData.results
            : [];

          setAddresses(savedAddresses);

          if (savedAddresses.length > 0) {
            const defaultAddress =
              savedAddresses.find(
                (address) => address.is_default
              ) || savedAddresses[0];

            setSelectedAddressId(defaultAddress.id);
            setUseManualAddress(false);
            setForm(getDeliveryFromAddress(defaultAddress));
          } else {
            setSelectedAddressId(null);
            setUseManualAddress(true);
            setForm(defaults);
          }
        } else {
          setSelectedAddressId(null);
          setUseManualAddress(true);
          setForm(defaults);

          setAddressWarning(
            "Saved addresses could not be loaded. You can still enter your delivery information manually."
          );
        }
      } catch (err) {
        if (active) {
          setError(
            err.message || "Unable to prepare checkout."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadCheckoutData();

    return () => {
      active = false;
    };
  }, [navigate]);

  // ==========================================
  // ADDRESS SELECTION
  // ==========================================

  function selectSavedAddress(address) {
    if (submitting) return;

    setSelectedAddressId(address.id);
    setUseManualAddress(false);
    setForm(getDeliveryFromAddress(address));
    setError("");
  }

  function selectManualAddress() {
    if (submitting) return;

    setSelectedAddressId(null);
    setUseManualAddress(true);
    setForm({ ...customerDefaults });
    setError("");
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  // ==========================================
  // PLACE ORDER
  // ==========================================

  async function handlePlaceOrder(event) {
    event.preventDefault();

    if (submitting || successOrder) return;

    setError("");

    if (!cart?.items?.length) {
      setError("Your shopping bag is empty.");
      return;
    }

    if (!useManualAddress && selectedAddressId === null) {
      setError("Please select a delivery address.");
      return;
    }

    setSubmitting(true);

    try {
      // The existing Django checkout API accepts the
      // delivery fields, not a saved address ID.
      // We send a snapshot of the selected address.
      const order = await authenticatedRequest(
        "/api/checkout/",
        {
          method: "POST",
          body: JSON.stringify({
            full_name: form.full_name.trim(),
            phone: form.phone.trim(),
            address: form.address.trim(),
            city: form.city.trim(),
            state: form.state.trim(),
            postal_code: form.postal_code.trim(),
            payment_method: "cod",
          }),
        }
      );

      setSuccessOrder(order);
      setCart(null);

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (err) {
      setError(
        err.message || "Unable to place your order."
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } finally {
      setSubmitting(false);
    }
  }

  // ==========================================
  // ORDER SUMMARY CALCULATIONS
  // ==========================================

  const cartItems = cart?.items || [];

  const totalItems = cartItems.reduce(
    (total, item) => total + Number(item.quantity || 0),
    0
  );

  const subtotal = Number(cart?.total_price || 0);
  const deliveryCharge = 0;
  const grandTotal = subtotal + deliveryCharge;

  // ==========================================
  // SUCCESS SCREEN
  // ==========================================

  if (successOrder) {
    return (
      <div className="min-h-screen bg-transparent text-gray-900">
        <CustomerHeader />

        <main className="mx-auto flex min-h-[75vh] max-w-xl flex-col items-center justify-center px-5 py-16 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-50">
            <CheckCircle2
              size={52}
              strokeWidth={1.4}
              className="text-green-700"
            />
          </div>

          <p className="mt-8 text-xs font-semibold text-amber-600">
            Order confirmed
          </p>

          <h1 className="mt-4 font-serif text-4xl sm:text-5xl">
            Thank you for
            <br />
            your order!
          </h1>

          <p className="mt-6 text-sm leading-7 text-gray-600">
            Your order has been placed successfully.
            We're getting everything ready for you.
          </p>

          <div className="mt-9 w-full border border-gray-200 cn-glass p-7 text-left">
            <div className="flex justify-between gap-4 border-b border-gray-200 pb-4">
              <span className="text-sm text-gray-600">
                Order number
              </span>

              <span className="font-semibold">
                #{successOrder.id}
              </span>
            </div>

            <div className="flex justify-between gap-4 border-b border-gray-200 py-4">
              <span className="text-sm text-gray-600">
                Payment method
              </span>

              <span className="text-sm font-medium">
                Cash on Delivery
              </span>
            </div>

            <div className="flex justify-between gap-4 pt-4">
              <span className="font-medium">
                Order total
              </span>

              <span className="text-lg font-semibold">
                ₹{formatPrice(successOrder.total_amount)}
              </span>
            </div>
          </div>

          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              to={`/orders/${successOrder.id}`}
              className="inline-flex items-center justify-center gap-2 cn-gradient-gold px-7 py-4 text-xs font-semibold text-gray-900 transition hover:bg-amber-500"
            >
              Track your order
              <ArrowRight size={17} />
            </Link>

            <Link
              to="/orders"
              className="inline-flex items-center justify-center gap-2 border border-gray-900 px-7 py-4 text-xs font-semibold"
            >
              My Orders
            </Link>
          </div>

          <Link
            to="/"
            className="mt-7 text-xs font-semibold text-gray-600 hover:text-amber-600"
          >
            Continue shopping
          </Link>
        </main>

      <CustomerFooter />
      </div>
    );
  }

  // ==========================================
  // MAIN CHECKOUT PAGE
  // ==========================================

  return (
    <div className="min-h-screen bg-transparent text-gray-900">

      {/* HEADER */}

      <CustomerHeader />

      {/* PAGE TITLE */}

      <section className="border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
          <p className="text-[11px] font-semibold text-amber-600">
            Almost there
          </p>

          <h1 className="mt-4 font-serif text-4xl sm:text-5xl">
            Checkout
          </h1>

          <p className="mt-4 text-sm text-gray-600">
            A few more details, and your order is on its way.
          </p>
        </div>
      </section>

      {/* ERROR MESSAGE */}

      {error && (
        <div className="mx-auto max-w-7xl px-5 pt-8 lg:px-8">
          <div
            role="alert"
            className="flex items-start gap-3 border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600"
          >
            <AlertCircle size={20} className="shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* LOADING */}

      {loading ? (
        <div className="flex min-h-[45vh] items-center justify-center gap-3 text-sm text-gray-600">
          <Loader2 size={22} className="animate-spin" />
          Preparing your checkout...
        </div>
      ) : cartItems.length === 0 ? (
        <div className="mx-auto flex max-w-xl flex-col items-center px-5 py-20 text-center">
          <ShoppingBag
            size={48}
            strokeWidth={1.2}
            className="text-amber-600"
          />

          <h2 className="mt-6 font-serif text-3xl">
            Your shopping bag is empty
          </h2>

          <p className="mt-4 text-sm leading-7 text-gray-600">
            Add some products before proceeding to checkout.
          </p>

          <Link
            to="/"
            className="mt-8 cn-gradient-gold px-7 py-4 text-xs font-semibold text-gray-900"
          >
            Explore products
          </Link>
        </div>
      ) : (
        <form
          onSubmit={handlePlaceOrder}
          className="mx-auto grid max-w-7xl gap-12 px-5 py-12 lg:grid-cols-[1.3fr_0.8fr] lg:px-8"
        >

          {/* LEFT COLUMN */}

          <div>

            {/* DELIVERY INFORMATION HEADER */}

            <div className="flex items-center gap-3 border-b border-gray-200 pb-6">
              <MapPin
                size={23}
                strokeWidth={1.5}
                className="text-amber-600"
              />

              <h2 className="font-serif text-2xl">
                Delivery information
              </h2>
            </div>

            {/* SAVED ADDRESS SECTION */}

            <section className="mt-8">

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-serif text-xl">
                    Choose a delivery address
                  </h3>

                  <p className="mt-2 text-xs leading-6 text-gray-600">
                    Select a saved address or enter a new one.
                  </p>
                </div>

                <Link
                  to="/profile"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-green-700 hover:text-amber-600"
                >
                  <Pencil size={15} />
                  Manage addresses
                </Link>
              </div>

              {addressWarning && (
                <div className="mt-5 flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-4 text-xs leading-6 text-amber-700">
                  <AlertCircle
                    size={17}
                    className="mt-0.5 shrink-0"
                  />
                  {addressWarning}
                </div>
              )}

              {addresses.length > 0 && (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {addresses.map((address) => {
                    const AddressIcon = getAddressIcon(
                      address.label
                    );

                    const isSelected =
                      !useManualAddress &&
                      selectedAddressId === address.id;

                    return (
                      <button
                        key={address.id}
                        type="button"
                        disabled={submitting}
                        onClick={() => selectSavedAddress(address)}
                        aria-pressed={isSelected}
                        className={`relative w-full border p-5 text-left transition disabled:opacity-60 ${
                          isSelected
                            ? "border-green-400 bg-green-50 ring-1 ring-green-400"
                            : "border-gray-200 cn-glass hover:border-amber-400"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <AddressIcon
                              size={19}
                              className="text-green-700"
                            />

                            <span className="text-sm font-semibold">
                              {formatAddressLabel(address.label)}
                            </span>
                          </div>

                          {isSelected ? (
                            <CheckCircle2
                              size={20}
                              className="text-green-700"
                            />
                          ) : (
                            <span className="h-5 w-5 rounded-full border border-gray-300" />
                          )}
                        </div>

                        {address.is_default && (
                          <span className="mt-3 inline-block bg-green-50 px-3 py-1 text-[10px] font-semibold text-green-700">
                            Default
                          </span>
                        )}

                        <p className="mt-4 text-sm font-semibold">
                          {address.full_name}
                        </p>

                        <p className="mt-2 whitespace-pre-line break-words text-xs leading-6 text-gray-600">
                          {address.address}
                        </p>

                        <p className="mt-1 text-xs leading-6 text-gray-600">
                          {address.city}, {address.state} -{" "}
                          {address.postal_code}
                        </p>

                        <p className="mt-2 text-xs text-gray-600">
                          {address.phone}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* MANUAL ADDRESS OPTION */}

              <button
                type="button"
                disabled={submitting}
                onClick={selectManualAddress}
                aria-pressed={useManualAddress}
                className={`mt-4 flex w-full items-center justify-between gap-4 border px-5 py-5 text-left transition disabled:opacity-60 ${
                  useManualAddress
                    ? "border-green-400 bg-green-50 ring-1 ring-green-400"
                    : "border-gray-200 cn-glass hover:border-amber-400"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Plus
                    size={20}
                    className="text-green-700"
                  />

                  <div>
                    <p className="text-sm font-semibold">
                      Use a different address
                    </p>

                    <p className="mt-1 text-xs leading-6 text-gray-600">
                      Enter delivery details for this order.
                    </p>
                  </div>
                </div>

                {useManualAddress && (
                  <CheckCircle2
                    size={20}
                    className="shrink-0 text-green-700"
                  />
                )}
              </button>

              {addresses.length === 0 && (
                <p className="mt-4 text-xs leading-6 text-gray-600">
                  You haven't saved any delivery addresses yet.{" "}
                  <Link
                    to="/profile"
                    className="font-semibold text-green-700 underline"
                  >
                    Save an address in My Profile
                  </Link>
                  , or enter your details below.
                </p>
              )}
            </section>

            {/* DELIVERY DETAILS */}

            <section className="mt-10">

              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4">
                <h3 className="font-serif text-xl">
                  {useManualAddress
                    ? "Enter delivery details"
                    : "Selected delivery details"}
                </h3>

                {!useManualAddress && (
                  <span className="flex items-center gap-2 text-xs font-semibold text-green-700">
                    <CheckCircle2 size={16} />
                    Saved address selected
                  </span>
                )}
              </div>

              {useManualAddress ? (
                <div className="mt-7 grid gap-6 sm:grid-cols-2">

                  <div className="sm:col-span-2">
                    <DeliveryField
                      label="Full name"
                      name="full_name"
                      value={form.full_name}
                      onChange={handleChange}
                      placeholder="Enter your full name"
                      icon={UserRound}
                      maxLength={150}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <DeliveryField
                      label="Mobile number"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="10-digit mobile number"
                      icon={Phone}
                      type="tel"
                      maxLength={20}
                    />
                  </div>

                  <DeliveryField
                    label="Complete delivery address"
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    placeholder="House name/number, street, area, landmark..."
                    multiline
                  />

                  <DeliveryField
                    label="City / Town"
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    placeholder="City or town"
                    maxLength={100}
                  />

                  <DeliveryField
                    label="State"
                    name="state"
                    value={form.state}
                    onChange={handleChange}
                    placeholder="State"
                    maxLength={100}
                  />

                  <div className="sm:col-span-2">
                    <DeliveryField
                      label="PIN code"
                      name="postal_code"
                      value={form.postal_code}
                      onChange={handleChange}
                      placeholder="6-digit PIN code"
                      maxLength={6}
                      pattern="[1-9][0-9]{5}"
                      inputMode="numeric"
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-6 border border-gray-200 cn-glass p-6">
                  <div className="flex items-start gap-3">
                    <MapPin
                      size={20}
                      className="mt-1 shrink-0 text-amber-600"
                    />

                    <div className="min-w-0">
                      <p className="font-semibold">
                        {form.full_name}
                      </p>

                      <p className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-gray-600">
                        {form.address}
                      </p>

                      <p className="mt-1 text-sm leading-7 text-gray-600">
                        {form.city}, {form.state} -{" "}
                        {form.postal_code}
                      </p>

                      <p className="mt-3 text-sm text-gray-600">
                        Phone: {form.phone}
                      </p>
                    </div>
                  </div>

                  <p className="mt-6 border-t border-gray-200 pt-4 text-xs leading-6 text-gray-600">
                    To edit this saved address, visit{" "}
                    <Link
                      to="/profile"
                      className="font-semibold text-green-700 underline"
                    >
                      My Profile
                    </Link>
                    . To deliver to another location for this
                    order, choose "Use a different address".
                  </p>
                </div>
              )}
            </section>

            {/* PAYMENT METHOD */}

            <section className="mt-12">
              <div className="flex items-center gap-3 border-b border-gray-200 pb-6">
                <CreditCard
                  size={23}
                  strokeWidth={1.5}
                  className="text-amber-600"
                />

                <h2 className="font-serif text-2xl">
                  Payment method
                </h2>
              </div>

              <div className="mt-7 flex items-start gap-4 border-2 border-gray-900 cn-glass p-6">
                <input
                  type="radio"
                  name="payment_method"
                  value="cod"
                  checked={form.payment_method === "cod"}
                  onChange={handleChange}
                  className="mt-1 accent-yellow-500"
                />

                <div>
                  <p className="text-sm font-semibold">
                    Cash on Delivery
                  </p>

                  <p className="mt-2 text-xs leading-6 text-gray-600">
                    Pay when your order arrives at your doorstep.
                  </p>
                </div>
              </div>
            </section>

            {/* SECURITY MESSAGE */}

            <div className="mt-8 flex items-start gap-3 bg-green-100 px-5 py-4">
              <ShieldCheck
                size={20}
                className="shrink-0 text-green-700"
              />

              <p className="text-xs leading-6 text-gray-600">
                Your order details are securely processed.
                No online payment is required for Cash on Delivery.
              </p>
            </div>

          </div>

          {/* RIGHT COLUMN: ORDER SUMMARY */}

          <aside>
            <div className="sticky top-8 border border-gray-200 cn-glass p-6 sm:p-8">

              <div className="flex items-center justify-between">
                <h2 className="font-serif text-2xl">
                  Your order
                </h2>

                <span className="text-xs text-gray-600">
                  {totalItems} items
                </span>
              </div>

              {/* CART PRODUCTS */}

              <div className="mt-7 space-y-5 border-b border-gray-200 pb-7">
                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-4"
                  >
                    {getProductImageUrl(item.product_image, item.product_name) ? (
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white">
                        <img
                          src={getProductImageUrl(item.product_image, item.product_name)}
                          alt={item.product_name}
                          className={`h-full w-full object-contain ${
                            isDemoImage(getProductImageUrl(item.product_image, item.product_name)) ? "scale-[1.9]" : "p-1"
                          }`}
                        />
                      </div>
                    ) : (
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center bg-green-100">
                        <ImageOff
                          size={22}
                          className="text-gray-500"
                        />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-base">
                        {item.product_name}
                      </p>

                      <p className="mt-1 text-xs text-gray-600">
                        Quantity: {item.quantity}
                      </p>

                      <p className="mt-2 text-sm font-semibold">
                        ₹{formatPrice(item.subtotal)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* PRICING */}

              <div className="mt-7 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    Subtotal
                  </span>

                  <span>
                    ₹{formatPrice(subtotal)}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    Delivery
                  </span>

                  <span className="text-green-700">
                    Free
                  </span>
                </div>
              </div>

              <div className="mt-7 flex items-center justify-between border-t border-gray-200 pt-6">
                <span className="font-semibold">
                  Total
                </span>

                <span className="text-2xl font-semibold">
                  ₹{formatPrice(grandTotal)}
                </span>
              </div>

              {/* SELECTED ADDRESS SUMMARY */}

              <div className="mt-7 border-t border-gray-200 pt-6">
                <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-gray-600">
                  <MapPin size={15} />
                  Delivering to
                </p>

                <p className="text-sm font-semibold">
                  {form.full_name || "Recipient not entered"}
                </p>

                <p className="mt-2 whitespace-pre-line break-words text-xs leading-6 text-gray-600">
                  {form.address || "Delivery address not entered"}
                </p>

                {(form.city || form.postal_code) && (
                  <p className="mt-1 text-xs leading-6 text-gray-600">
                    {form.city}
                    {form.city && form.state ? ", " : ""}
                    {form.state}
                    {form.postal_code
                      ? ` - ${form.postal_code}`
                      : ""}
                  </p>
                )}
              </div>

              {/* PLACE ORDER BUTTON */}

              <button
                type="submit"
                disabled={submitting}
                className="mt-8 flex w-full items-center justify-center gap-3 cn-gradient-gold px-5 py-4 text-xs font-semibold text-gray-900 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                    Placing order...
                  </>
                ) : (
                  <>
                    Place order
                    <ArrowRight size={17} />
                  </>
                )}
              </button>

              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-600">
                <Truck size={17} />
                Carefully packed and delivered
              </div>

            </div>
          </aside>

        </form>
      )}
    </div>
  );
}
