const API_URL = import.meta.env.VITE_API_URL || "";
const WS_URL = import.meta.env.VITE_WS_URL || "";

function getRequestCandidates(path) {
  const candidates = [];

  if (API_URL) {
    candidates.push(`${API_URL}${path}`);

    if (API_URL.includes("localhost")) {
      candidates.push(`${API_URL.replace("localhost", "127.0.0.1")}${path}`);
    } else if (API_URL.includes("127.0.0.1")) {
      candidates.push(`${API_URL.replace("127.0.0.1", "localhost")}${path}`);
    }
  }

  if (path.startsWith("/")) {
    candidates.push(path);
  }

  return [...new Set(candidates.filter(Boolean))];
}

export async function apiRequest(path, method = "GET", body, token) {
  let res = null;
  let lastError = null;
  const candidates = getRequestCandidates(path);

  for (const url of candidates) {
    try {
      res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: body ? JSON.stringify(body) : undefined
      });
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!res) {
    const isLocalApi = API_URL.includes("localhost") || API_URL.includes("127.0.0.1") || !API_URL;
    const hint = isLocalApi
      ? "当前连不上本地后端。请确认 `npm run dev` 正在同时启动前后端；如果你配置了 `VITE_API_URL`，也可以先删掉它，让前端改走同源 `/api` 代理。"
      : "当前连不上服务端，请检查网络或稍后重试。";
    throw new Error(lastError?.message ? `${hint}` : hint);
  }

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
