
const API = "http://127.0.0.1:8000/api";

export async function adminRequest(path, options = {}) {
  let token = sessionStorage.getItem("accessToken");

  const make = (t) =>
    fetch(`${API}${path}`, {
      ...options,
      headers: {
        ...(options.body
          ? { "Content-Type": "application/json" }
          : {}),
        ...options.headers,
        Authorization: `Bearer ${t}`,
      },
    });

  let res = await make(token);

  if (
    res.status === 401 &&
    sessionStorage.getItem("refreshToken")
  ) {
    const refresh = await fetch(`${API}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refresh: sessionStorage.getItem("refreshToken"),
      }),
    });

    if (refresh.ok) {
      token = (await refresh.json()).access;
      sessionStorage.setItem("accessToken", token);
      res = await make(token);
    }
  }

  if (!res.ok) {
    let message = `Request failed (HTTP ${res.status})`;

    try {
      const data = await res.json();
      message = data.detail || JSON.stringify(data);
    } catch {}

    throw new Error(message);
  }

  if (res.status === 204) return null;

  return res.json();
}

export const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(Number(value || 0));

export const dateLabel = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";
