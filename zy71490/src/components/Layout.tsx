import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#0E0E1A] text-[#FAF5EF]">
      <Sidebar />
      <main className="ml-[220px] min-h-screen transition-all duration-300">
        <Outlet />
      </main>
    </div>
  );
}
