import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useTheme } from '@/hooks/useTheme';

export const AppLayout: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div className={`flex min-h-screen bg-neutral-100 ${theme === 'dark' ? 'dark' : ''}`}>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-[1600px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
