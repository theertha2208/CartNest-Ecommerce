
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  UserRound,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Save,
  LoaderCircle,
  AlertCircle,
  House,
  BriefcaseBusiness,
  Navigation,
  Star,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import CustomerHeader, { CustomerFooter } from "../components/CustomerHeader";

const API_BASE = "http://127.0.0.1:8000";

const EMPTY_ADDRESS = {
  label: "home",
  full_name: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  postal_code: "",
  is_default: false,
};

// ==========================================
// API HELPERS
// ==========================================

function getErrorMessage(data, fallback) {
  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (Array.isArray(data?.non_field_errors)) {
    return data.non_field_errors.join(" ");
  }

  if (data && typeof data === "object") {
    for (const [field, value] of Object.entries(data)) {
      const message = Array.isArray(value)
        ? value.join(" ")
        : typeof value === "string"
        ? value
        : "";

      if (message) {
        return `${field.replaceAll("_", " ")}: ${message}`;
      }
    }
  }

  return fallback;
}

async function authenticatedRequest(
  endpoint,
  method = "GET",
  body = null
) {
  let accessToken = sessionStorage.getItem("accessToken");

  if (!accessToken) {
    throw new Error("Please sign in to manage your account.");
  }

  const sendRequest = (token) =>
    fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      ...(body !== null
        ? { body: JSON.stringify(body) }
        : {}),
    });

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
        const refreshData = await refreshResponse.json();

        accessToken = refreshData.access;
        sessionStorage.setItem("accessToken", accessToken);

        if (refreshData.refresh) {
          sessionStorage.setItem(
            "refreshToken",
            refreshData.refresh
          );
        }

        response = await sendRequest(accessToken);
      }
    }
  }

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        "Your session has expired. Please sign in again."
      );
    }

    throw new Error(
      getErrorMessage(data, "Something went wrong.")
    );
  }

  return data;
}

// ==========================================
// SMALL COMPONENTS
// ==========================================

function FormField({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  disabled = false,
  multiline = false,
}) {
  const commonProps = {
    id: name,
    name,
    value: value ?? "",
    onChange,
    placeholder,
    required,
    disabled,
    className:
      "mt-2 w-full rounded-sm border border-gray-200 cn-glass px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-yellow-500 focus:ring-1 focus:ring-yellow-400 disabled:opacity-60",
  };

  return (
    <div>
      <label
        htmlFor={name}
        className="text-xs font-semibold text-gray-600"
      >
        {label}
        {required && (
          <span className="ml-1 text-amber-600">*</span>
        )}
      </label>

      {multiline ? (
        <textarea
          {...commonProps}
          rows={3}
        />
      ) : (
        <input
          {...commonProps}
          type={type}
        />
      )}
    </div>
  );
}

function AddressIcon({ label, size = 20 }) {
  if (label === "home") {
    return <House size={size} />;
  }

  if (label === "work") {
    return <BriefcaseBusiness size={size} />;
  }

  return <Navigation size={size} />;
}

function formatAddressLabel(label) {
  if (!label) return "Other";

  return label.charAt(0).toUpperCase() + label.slice(1);
}

// ==========================================
// CUSTOMER PROFILE PAGE
// ==========================================

export default function CustomerProfile() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  });

  const [addresses, setAddresses] = useState([]);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressForm, setAddressForm] = useState({
    ...EMPTY_ADDRESS,
  });

  const [savingAddress, setSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [addressSuccess, setAddressSuccess] = useState("");
  const [busyAddressId, setBusyAddressId] = useState(null);

  // ========================================
  // LOAD PROFILE AND ADDRESSES
  // ========================================

  async function loadAccount() {
    setLoading(true);
    setPageError("");

    try {
      const [profileData, addressData] = await Promise.all([
        authenticatedRequest("/api/profile/"),
        authenticatedRequest("/api/addresses/"),
      ]);

      setProfile(profileData);

      setProfileForm({
        first_name: profileData.first_name || "",
        last_name: profileData.last_name || "",
        email: profileData.email || "",
        phone: profileData.phone || "",
      });

      const addressList = Array.isArray(addressData)
        ? addressData
        : Array.isArray(addressData?.results)
        ? addressData.results
        : [];

      setAddresses(addressList);
    } catch (error) {
      console.error("Customer account error:", error);
      setPageError(
        error.message || "Unable to load your account."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccount();
  }, []);

  // ========================================
  // PROFILE FORM
  // ========================================

  function handleProfileChange(event) {
    const { name, value } = event.target;

    setProfileForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setProfileError("");
    setProfileSuccess("");
  }

  async function handleSaveProfile(event) {
    event.preventDefault();

    setSavingProfile(true);
    setProfileError("");
    setProfileSuccess("");

    try {
      const updatedProfile = await authenticatedRequest(
        "/api/profile/",
        "PATCH",
        profileForm
      );

      setProfile(updatedProfile);

      setProfileForm({
        first_name: updatedProfile.first_name || "",
        last_name: updatedProfile.last_name || "",
        email: updatedProfile.email || "",
        phone: updatedProfile.phone || "",
      });

      setEditingProfile(false);
      setProfileSuccess("Your profile has been updated.");
    } catch (error) {
      setProfileError(
        error.message || "Unable to update your profile."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  function cancelProfileEditing() {
    setProfileForm({
      first_name: profile?.first_name || "",
      last_name: profile?.last_name || "",
      email: profile?.email || "",
      phone: profile?.phone || "",
    });

    setEditingProfile(false);
    setProfileError("");
  }

  // ========================================
  // ADDRESS FORM
  // ========================================

  function handleAddressChange(event) {
    const { name, value, type, checked } = event.target;

    setAddressForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));

    setAddressError("");
    setAddressSuccess("");
  }

  function openNewAddressForm() {
    setEditingAddressId(null);

    setAddressForm({
      ...EMPTY_ADDRESS,
      full_name: [
        profile?.first_name,
        profile?.last_name,
      ]
        .filter(Boolean)
        .join(" "),
      phone: profile?.phone || "",
      is_default: addresses.length === 0,
    });

    setAddressError("");
    setAddressSuccess("");
    setShowAddressForm(true);
  }

  function openEditAddressForm(address) {
    setEditingAddressId(address.id);

    setAddressForm({
      label: address.label || "home",
      full_name: address.full_name || "",
      phone: address.phone || "",
      address: address.address || "",
      city: address.city || "",
      state: address.state || "",
      postal_code: address.postal_code || "",
      is_default: Boolean(address.is_default),
    });

    setAddressError("");
    setAddressSuccess("");
    setShowAddressForm(true);
  }

  function closeAddressForm() {
    setShowAddressForm(false);
    setEditingAddressId(null);
    setAddressForm({ ...EMPTY_ADDRESS });
    setAddressError("");
  }

  async function reloadAddresses() {
    const data = await authenticatedRequest(
      "/api/addresses/"
    );

    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.results)
      ? data.results
      : [];

    setAddresses(list);
  }

  async function handleSaveAddress(event) {
    event.preventDefault();

    setSavingAddress(true);
    setAddressError("");
    setAddressSuccess("");

    try {
      const isEditing = editingAddressId !== null;

      const endpoint = isEditing
        ? `/api/addresses/${editingAddressId}/`
        : "/api/addresses/";

      await authenticatedRequest(
        endpoint,
        isEditing ? "PATCH" : "POST",
        addressForm
      );

      await reloadAddresses();

      closeAddressForm();

      setAddressSuccess(
        isEditing
          ? "Delivery address updated successfully."
          : "New delivery address saved successfully."
      );
    } catch (error) {
      setAddressError(
        error.message || "Unable to save this address."
      );
    } finally {
      setSavingAddress(false);
    }
  }

  // ========================================
  // SET DEFAULT ADDRESS
  // ========================================

  async function handleSetDefault(addressId) {
    setBusyAddressId(addressId);
    setAddressError("");
    setAddressSuccess("");

    try {
      await authenticatedRequest(
        `/api/addresses/${addressId}/set-default/`,
        "PATCH"
      );

      await reloadAddresses();

      setAddressSuccess(
        "Your default delivery address has been updated."
      );
    } catch (error) {
      setAddressError(
        error.message || "Unable to set default address."
      );
    } finally {
      setBusyAddressId(null);
    }
  }

  // ========================================
  // DELETE ADDRESS
  // ========================================

  async function handleDeleteAddress(address) {
    const confirmed = window.confirm(
      `Are you sure you want to delete this ${formatAddressLabel(
        address.label
      )} address?`
    );

    if (!confirmed) return;

    setBusyAddressId(address.id);
    setAddressError("");
    setAddressSuccess("");

    try {
      await authenticatedRequest(
        `/api/addresses/${address.id}/`,
        "DELETE"
      );

      await reloadAddresses();

      setAddressSuccess(
        "Delivery address deleted successfully."
      );
    } catch (error) {
      setAddressError(
        error.message || "Unable to delete this address."
      );
    } finally {
      setBusyAddressId(null);
    }
  }

  const displayName =
    [profile?.first_name, profile?.last_name]
      .filter(Boolean)
      .join(" ") ||
    profile?.username ||
    "CartNest customer";

  // ========================================
  // PAGE UI
  // ========================================

  return (
    <div className="min-h-screen bg-transparent text-gray-900">

      {/* HEADER */}

      <CustomerHeader />

      <main className="mx-auto max-w-6xl px-5 py-12 sm:py-16">

        {/* PAGE HEADING */}

        <div className="mb-10">
          <p className="text-[11px] font-semibold text-amber-600">
            Your CartNest account
          </p>

          <h1 className="mt-4 font-serif text-4xl text-gray-900 sm:text-5xl">
            My Account
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-7 text-gray-600">
            Manage your personal information and keep your
            favourite delivery destinations close at hand.
          </p>
        </div>

        {/* LOADING */}

        {loading && (
          <div className="flex min-h-80 flex-col items-center justify-center gap-4">
            <LoaderCircle
              size={32}
              className="animate-spin text-amber-600"
            />

            <p className="text-sm text-gray-600">
              Loading your account...
            </p>
          </div>
        )}

        {/* PAGE ERROR */}

        {!loading && pageError && (
          <div className="border border-red-200 cn-glass px-6 py-12 text-center">
            <AlertCircle
              size={35}
              className="mx-auto text-red-600"
            />

            <h2 className="mt-5 font-serif text-2xl">
              Couldn't load your account
            </h2>

            <p className="mt-3 text-sm text-red-600">
              {pageError}
            </p>

            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={loadAccount}
                className="cn-gradient-gold px-6 py-3 text-xs font-semibold text-gray-900"
              >
                Try again
              </button>

              <button
                type="button"
                onClick={() => navigate("/login")}
                className="border border-gray-200 px-6 py-3 text-xs font-semibold"
              >
                Sign in
              </button>
            </div>
          </div>
        )}

        {!loading && !pageError && profile && (
          <div className="space-y-10">

            {/* PROFILE CARD */}

            <section className="overflow-hidden border border-gray-200 cn-glass">

              <div className="flex flex-col justify-between gap-5 border-b border-gray-200 cn-glass px-6 py-7 sm:flex-row sm:items-center sm:px-8">

                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700">
                    <UserRound size={27} strokeWidth={1.5} />
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold text-amber-600">
                      Personal information
                    </p>

                    <h2 className="mt-1 font-serif text-2xl text-gray-900">
                      {displayName}
                    </h2>

                    <p className="mt-1 text-xs text-gray-500">
                      @{profile.username}
                    </p>
                  </div>
                </div>

                {!editingProfile && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProfile(true);
                      setProfileSuccess("");
                    }}
                    className="inline-flex items-center justify-center gap-2 border border-gray-200 px-5 py-3 text-xs font-semibold text-gray-900 transition hover:bg-gray-100 hover:text-gray-900"
                  >
                    <Pencil size={15} />
                    Edit profile
                  </button>
                )}
              </div>

              <div className="px-6 py-8 sm:px-8">

                {profileSuccess && (
                  <div className="mb-6 flex items-center gap-2 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    <Check size={17} />
                    {profileSuccess}
                  </div>
                )}

                {profileError && (
                  <div className="mb-6 flex items-center gap-2 bg-red-50 px-4 py-3 text-sm text-red-600">
                    <AlertCircle size={17} />
                    {profileError}
                  </div>
                )}

                {editingProfile ? (
                  <form onSubmit={handleSaveProfile}>

                    <div className="grid gap-6 sm:grid-cols-2">

                      <FormField
                        label="First name"
                        name="first_name"
                        value={profileForm.first_name}
                        onChange={handleProfileChange}
                        placeholder="Your first name"
                      />

                      <FormField
                        label="Last name"
                        name="last_name"
                        value={profileForm.last_name}
                        onChange={handleProfileChange}
                        placeholder="Your last name"
                      />

                      <FormField
                        label="Email address"
                        name="email"
                        type="email"
                        value={profileForm.email}
                        onChange={handleProfileChange}
                        placeholder="you@example.com"
                        required
                      />

                      <FormField
                        label="Mobile number"
                        name="phone"
                        type="tel"
                        value={profileForm.phone}
                        onChange={handleProfileChange}
                        placeholder="10-digit mobile number"
                      />

                    </div>

                    <div className="mt-8 flex flex-wrap gap-3">

                      <button
                        type="submit"
                        disabled={savingProfile}
                        className="inline-flex items-center gap-2 cn-gradient-gold px-7 py-3 text-xs font-semibold text-gray-900 transition hover:bg-amber-500 disabled:opacity-60"
                      >
                        {savingProfile ? (
                          <LoaderCircle
                            size={16}
                            className="animate-spin"
                          />
                        ) : (
                          <Save size={16} />
                        )}
                        Save changes
                      </button>

                      <button
                        type="button"
                        onClick={cancelProfileEditing}
                        disabled={savingProfile}
                        className="inline-flex items-center gap-2 border border-gray-200 px-7 py-3 text-xs font-semibold"
                      >
                        <X size={16} />
                        Cancel
                      </button>

                    </div>
                  </form>
                ) : (
                  <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2">

                    {[
                      ["First name", profile.first_name],
                      ["Last name", profile.last_name],
                      ["Email address", profile.email],
                      ["Mobile number", profile.phone],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-[11px] text-gray-500">
                          {label}
                        </p>

                        <p className="mt-2 break-words text-sm font-medium text-gray-900">
                          {value || "Not provided"}
                        </p>
                      </div>
                    ))}

                  </div>
                )}

                <div className="mt-8 flex items-start gap-3 border-t border-gray-200 pt-6 text-xs leading-6 text-gray-600">
                  <ShieldCheck
                    size={19}
                    className="mt-0.5 shrink-0 text-green-700"
                  />
                  Your account information is only available
                  when you're signed in.
                </div>

              </div>
            </section>

            {/* ADDRESS SECTION */}

            <section>

              <div className="mb-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">

                <div>
                  <p className="text-[11px] font-semibold text-amber-600">
                    Delivery preferences
                  </p>

                  <h2 className="mt-3 font-serif text-3xl text-gray-900">
                    Saved Addresses
                  </h2>

                  <p className="mt-3 text-sm leading-7 text-gray-600">
                    Save your addresses for a quicker checkout.
                  </p>
                </div>

                {!showAddressForm && (
                  <button
                    type="button"
                    onClick={openNewAddressForm}
                    className="inline-flex items-center justify-center gap-2 cn-gradient-gold px-6 py-3.5 text-xs font-semibold text-gray-900 transition hover:bg-amber-500"
                  >
                    <Plus size={17} />
                    Add new address
                  </button>
                )}
              </div>

              {addressSuccess && (
                <div className="mb-6 flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
                  <Check size={18} />
                  {addressSuccess}
                </div>
              )}

              {addressError && !showAddressForm && (
                <div className="mb-6 flex items-center gap-2 border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
                  <AlertCircle size={18} />
                  {addressError}
                </div>
              )}

              {/* ADD / EDIT ADDRESS FORM */}

              {showAddressForm && (
                <div className="mb-8 border border-gray-200 cn-glass">

                  <div className="flex items-center justify-between border-b border-gray-200 cn-glass px-6 py-5 sm:px-8">

                    <h3 className="font-serif text-2xl text-gray-900">
                      {editingAddressId !== null
                        ? "Edit Delivery Address"
                        : "Add Delivery Address"}
                    </h3>

                    <button
                      type="button"
                      onClick={closeAddressForm}
                      disabled={savingAddress}
                      className="text-gray-600 hover:text-gray-900"
                      aria-label="Close address form"
                    >
                      <X size={20} />
                    </button>

                  </div>

                  <form
                    onSubmit={handleSaveAddress}
                    className="px-6 py-8 sm:px-8"
                  >

                    <div className="mb-7">
                      <p className="mb-3 text-xs font-semibold text-gray-600">
                        Address type
                      </p>

                      <div className="flex flex-wrap gap-3">

                        {[
                          { value: "home", label: "Home" },
                          { value: "work", label: "Work" },
                          { value: "other", label: "Other" },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() =>
                              setAddressForm((previous) => ({
                                ...previous,
                                label: option.value,
                              }))
                            }
                            className={`inline-flex items-center gap-2 border px-5 py-3 text-xs font-semibold transition ${
                              addressForm.label === option.value
                                ? "border-gray-900 cn-gradient-gold text-gray-900"
                                : "border-gray-200 cn-glass text-gray-600 hover:border-amber-400"
                            }`}
                          >
                            <AddressIcon
                              label={option.value}
                              size={16}
                            />
                            {option.label}
                          </button>
                        ))}

                      </div>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2">

                      <FormField
                        label="Recipient full name"
                        name="full_name"
                        value={addressForm.full_name}
                        onChange={handleAddressChange}
                        placeholder="Full name"
                        required
                      />

                      <FormField
                        label="Mobile number"
                        name="phone"
                        type="tel"
                        value={addressForm.phone}
                        onChange={handleAddressChange}
                        placeholder="10-digit mobile number"
                        required
                      />

                      <div className="sm:col-span-2">
                        <FormField
                          label="House / Street / Area"
                          name="address"
                          value={addressForm.address}
                          onChange={handleAddressChange}
                          placeholder="House number, street, landmark, area"
                          multiline
                          required
                        />
                      </div>

                      <FormField
                        label="City"
                        name="city"
                        value={addressForm.city}
                        onChange={handleAddressChange}
                        placeholder="City"
                        required
                      />

                      <FormField
                        label="State"
                        name="state"
                        value={addressForm.state}
                        onChange={handleAddressChange}
                        placeholder="State"
                        required
                      />

                      <FormField
                        label="PIN code"
                        name="postal_code"
                        value={addressForm.postal_code}
                        onChange={handleAddressChange}
                        placeholder="6-digit PIN code"
                        required
                      />

                    </div>

                    <label className="mt-7 flex cursor-pointer items-center gap-3 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        name="is_default"
                        checked={addressForm.is_default}
                        onChange={handleAddressChange}
                        className="h-4 w-4 accent-yellow-500"
                      />
                      Set as my default delivery address
                    </label>

                    {addressError && (
                      <div className="mt-6 flex items-start gap-2 bg-red-50 px-4 py-3 text-sm text-red-600">
                        <AlertCircle
                          size={18}
                          className="mt-0.5 shrink-0"
                        />
                        {addressError}
                      </div>
                    )}

                    <div className="mt-8 flex flex-wrap gap-3">

                      <button
                        type="submit"
                        disabled={savingAddress}
                        className="inline-flex items-center gap-2 cn-gradient-gold px-7 py-3.5 text-xs font-semibold text-gray-900 transition hover:bg-amber-500 disabled:opacity-60"
                      >
                        {savingAddress ? (
                          <LoaderCircle
                            size={17}
                            className="animate-spin"
                          />
                        ) : (
                          <Save size={17} />
                        )}
                        {editingAddressId !== null
                          ? "Update address"
                          : "Save address"}
                      </button>

                      <button
                        type="button"
                        onClick={closeAddressForm}
                        disabled={savingAddress}
                        className="border border-gray-200 px-7 py-3.5 text-xs font-semibold"
                      >
                        Cancel
                      </button>

                    </div>

                  </form>
                </div>
              )}

              {/* EMPTY ADDRESSES */}

              {addresses.length === 0 && !showAddressForm && (
                <div className="border border-gray-200 cn-glass px-6 py-16 text-center">

                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-50">
                    <MapPin
                      size={34}
                      strokeWidth={1.4}
                      className="text-green-700"
                    />
                  </div>

                  <h3 className="mt-6 font-serif text-2xl text-gray-900">
                    No saved addresses yet
                  </h3>

                  <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-gray-600">
                    Add your first delivery address to make
                    future checkouts easier.
                  </p>

                  <button
                    type="button"
                    onClick={openNewAddressForm}
                    className="mt-7 inline-flex items-center gap-2 cn-gradient-gold px-7 py-3.5 text-xs font-semibold text-gray-900"
                  >
                    <Plus size={17} />
                    Add your first address
                  </button>

                </div>
              )}

              {/* SAVED ADDRESS CARDS */}

              {addresses.length > 0 && (
                <div className="grid gap-5 md:grid-cols-2">

                  {addresses.map((address) => (
                    <article
                      key={address.id}
                      className={`border cn-glass ${
                        address.is_default
                          ? "border-gray-400"
                          : "border-gray-200"
                      }`}
                    >

                      <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-6 py-5">

                        <div className="flex items-center gap-3">

                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-700">
                            <AddressIcon
                              label={address.label}
                              size={19}
                            />
                          </div>

                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {formatAddressLabel(address.label)}
                            </h3>

                            {address.is_default && (
                              <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-green-700">
                                <Star size={12} />
                                Default address
                              </span>
                            )}
                          </div>

                        </div>

                        <MapPin
                          size={17}
                          className="text-amber-600"
                        />

                      </div>

                      <div className="px-6 py-6">

                        <p className="font-semibold text-gray-900">
                          {address.full_name}
                        </p>

                        <p className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-gray-600">
                          {address.address}
                        </p>

                        <p className="mt-1 text-sm leading-7 text-gray-600">
                          {address.city}, {address.state} -{" "}
                          {address.postal_code}
                        </p>

                        <p className="mt-3 text-sm text-gray-600">
                          Phone: {address.phone}
                        </p>

                      </div>

                      <div className="flex flex-wrap items-center gap-4 border-t border-gray-200 cn-glass px-6 py-5">

                        <button
                          type="button"
                          onClick={() =>
                            openEditAddressForm(address)
                          }
                          disabled={busyAddressId !== null}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-900 hover:text-amber-600 disabled:opacity-50"
                        >
                          <Pencil size={14} />
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteAddress(address)
                          }
                          disabled={busyAddressId !== null}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-600 disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>

                        {!address.is_default && (
                          <button
                            type="button"
                            onClick={() =>
                              handleSetDefault(address.id)
                            }
                            disabled={busyAddressId !== null}
                            className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-gray-900 disabled:opacity-50"
                          >
                            {busyAddressId === address.id ? (
                              <RefreshCw
                                size={14}
                                className="animate-spin"
                              />
                            ) : (
                              <Check size={14} />
                            )}
                            Set default
                          </button>
                        )}

                      </div>

                    </article>
                  ))}

                </div>
              )}

            </section>

            {/* ACCOUNT SHORTCUT */}

            <div className="flex flex-col justify-between gap-5 border border-gray-200 bg-green-100 px-7 py-7 sm:flex-row sm:items-center">

              <div>
                <h3 className="font-serif text-xl text-gray-900">
                  Looking for your orders?
                </h3>

                <p className="mt-2 text-sm text-gray-600">
                  View your purchases and track their progress.
                </p>
              </div>

              <Link
                to="/orders"
                className="inline-flex items-center justify-center gap-2 cn-gradient-gold px-6 py-3 text-xs font-semibold text-gray-900 transition hover:bg-amber-500"
              >
                View my orders
              </Link>

            </div>

          </div>
        )}

      </main>

      <CustomerFooter />

    </div>
  );
}
