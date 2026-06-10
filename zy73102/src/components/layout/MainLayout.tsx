import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';

export default function MainLayout() {
  return (
    <div className="flex min-h-screen bg-[#F0F4F8]">
      <AppSidebar />
      <main className="flex-1 min-h-screen overflow-auto scrollbar-thin">
        <Outlet />
      </main>
    </div>
  );
}
