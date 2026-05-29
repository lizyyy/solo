import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import ToastContainer from '@/components/ui/ToastContainer'

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#0F1419] text-[#c8d6e5] font-['Noto_Sans_SC']">
      <Sidebar />
      <main className="ml-56 min-h-screen">
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  )
}
