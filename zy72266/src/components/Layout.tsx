import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import LoginOverlay from "@/components/LoginOverlay";

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      <LoginOverlay />
      <Sidebar />
      <main className="flex-1 overflow-auto" style={{ backgroundColor: "var(--color-bg)" }}>
        <Outlet />
      </main>
    </div>
  );
}
