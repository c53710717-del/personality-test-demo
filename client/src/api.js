const API_URL = import.meta.env.VITE_API_URL || "";
const WS_URL = import.meta.env.VITE_WS_URL || "";

export async function apiRequest(path, method = "GET", body, token) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

export function generatePersonalityTest(body) {
  return apiRequest("/api/personality-tests/generate", "POST", body);
}

export function fetchGeneratedPersonalityTest(id) {
  return apiRequest(`/api/personality-tests/${id}`);
}

export function openSocket(token) {
  const base = WS_URL || API_URL || window.location.origin;
  const wsBase = base.startsWith("ws") ? base : base.replace(/^http/, "ws");
  const url = `${wsBase}/ws?token=${token}`;
  return new WebSocket(url);
}
