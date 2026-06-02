import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useAppStore } from "../store/app.store";

export default function Layout() {
  const { toasts, removeToast } = useAppStore();

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar />
      <main className="ml-60 flex-1 min-h-screen p-6">
        <Outlet />
      </main>

      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`px-4 py-3 rounded-sm shadow-lg text-sm font-medium text-white cursor-pointer transition-all ${
                t.type === "success" ? "bg-resolved" : "bg-conflict"
              }`}
              onClick={() => removeToast(t.id)}
            >
              {t.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
