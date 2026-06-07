import { create } from "zustand";
import { API_BASE, setUnauthorizedHandler } from "@/lib/api";

interface User {
  id: number;
  email: string;
  username: string;
  display_name: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
}

// The JWT now lives in an httpOnly cookie set by the backend — it is never read by
// JS. Every request uses credentials: "include" so the cookie rides along.

async function postAuth(path: string, body: object): Promise<User> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = "Request failed";
    try {
      detail = (await res.json()).detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  const data = await res.json();
  return data.user as User;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  login: async (email, password) => {
    const user = await postAuth("/api/auth/login", { email, password });
    set({ user });
  },

  signup: async (email, username, password) => {
    const user = await postAuth("/api/auth/signup", { email, username, password });
    set({ user });
  },

  logout: async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
    } catch {
      /* clear local state regardless */
    }
    set({ user: null });
  },

  loadUser: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
      if (res.ok) {
        set({ user: await res.json(), isLoading: false });
      } else {
        set({ user: null, isLoading: false });
      }
    } catch {
      set({ user: null, isLoading: false });
    }
  },
}));

// A 401 from any API call clears the session so the app redirects to /login.
setUnauthorizedHandler(() => {
  useAuthStore.setState({ user: null });
});
