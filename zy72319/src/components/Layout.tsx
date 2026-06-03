import { Outlet } from "react-router-dom"
import Sidebar from "./Sidebar"
import Toast from "./Toast"

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0d0d1f]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
      <Toast />
    </div>
  )
}
