import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";

export default function Layout() {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="ml-64 flex-1 bg-[var(--color-ivory)] overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
