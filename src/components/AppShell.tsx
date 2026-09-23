import { Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { BottomNav } from "./BottomNav";

export function AppShell() {
  const { loading, error, user } = useAuth();

  return (
    <div className="min-h-dvh bg-night text-ice">
      <div className="mx-auto flex h-dvh max-w-[480px] flex-col overflow-hidden bg-navy shadow-[0_0_80px_rgba(16,50,110,0.28)]">
        <main className="flex-1 overflow-y-auto px-4 pt-[max(12px,env(safe-area-inset-top))] pb-4">
          {loading || !user ? (
            <p className="pt-10 text-center text-sm text-mute">Открываем биржу…</p>
          ) : error ? (
            <p className="pt-10 text-center text-sm text-danger">{error}</p>
          ) : (
            <Outlet />
          )}
        </main>
        {user ? <BottomNav /> : null}
      </div>
    </div>
  );
}
