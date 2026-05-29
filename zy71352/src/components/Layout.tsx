import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Toast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import { LoadingOverlay } from './LoadingOverlay';
import { useUIStore } from '../store/uiStore';
import { cn } from '../lib/utils';

export function Layout() {
  const { sidebarOpen } = useUIStore();

  return (
    <div className="min-h-screen bg-stone-50">
      <Sidebar />
      <main
        className={cn(
        'min-h-screen transition-all duration-300',
        sidebarOpen ? 'md:ml-64' : 'md:ml-16'
      )}
      >
        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
      <Toast />
      <ConfirmDialog />
      <LoadingOverlay />
    </div>
  );
}
