import axios from "axios";

export const apiClient = axios.create({
  baseURL: "/backend",
});

export function setApiToken(token: string | null) {
  if (token) {
    apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common["Authorization"];
  }
}

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (
      err.response?.status === 401 &&
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/auth/")
    ) {
      fetch("/api/auth/session", { method: "DELETE" }).finally(() => {
        window.location.href = "/auth/login";
      });
    }
    return Promise.reject(err);
  }
);
