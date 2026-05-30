import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-60 flex-1 p-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
