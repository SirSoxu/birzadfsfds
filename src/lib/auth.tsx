import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Settings, User } from "../types";
import { api, getToken, setToken } from "./api";
import { bootTelegram } from "./telegram";

type AuthValue = {
  user: User | null;
  settings: Settings | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  loginDemo: (role?: User["role"]) => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const apply = useCallback((payload: { token: string; user: User; settings?: Settings }) => {
    setToken(payload.token);
    setUser(payload.user);
    if (payload.settings) setSettings(payload.settings);
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) return;
    const payload = await api<{ user: User; settings: Settings }>("/api/me");
    setUser(payload.user);
    setSettings(payload.settings);
  }, []);

  const loginDemo = useCallback(
    async (role: User["role"] = "user") => {
      const payload = await api<{ token: string; user: User }>("/api/auth/demo", {
        method: "POST",
        body: { role },
      });
      apply(payload);
      await refresh();
    },
    [apply, refresh],
  );

  useEffect(() => {
    bootTelegram();
    const initData = window.Telegram?.WebApp?.initData;
    (async () => {
      try {
        if (initData) {
          const payload = await api<{ token: string; user: User }>("/api/auth/telegram", {
            method: "POST",
            body: { initData },
          });
          apply(payload);
          await refresh();
        } else if (getToken()) {
          await refresh();
        } else {
          await loginDemo("user");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось войти");
        try {
          await loginDemo("user");
          setError("");
        } catch {
          // keep error
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [apply, loginDemo, refresh]);

  const value = useMemo(
    () => ({ user, settings, loading, error, refresh, loginDemo }),
    [user, settings, loading, error, refresh, loginDemo],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider missing");
  return value;
}
