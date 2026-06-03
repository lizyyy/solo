import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/Sidebar'

export default function Layout() {
  return (
    <div className="min-h-screen bg-base-900 flex">
      <Sidebar />
      <main className="ml-56 flex-1 min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}
