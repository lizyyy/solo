import React, { useEffect, ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAppStore } from '@/store';
import clsx from 'clsx';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { sidebarCollapsed, bonds, refreshAllData } = useAppStore();

  useEffect(() => {
    if (bonds.length === 0) {
      refreshAllData();
    }
  }, [bonds.length, refreshAllData]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div className={clsx(
        'transition-all duration-300',
        sidebarCollapsed ? 'ml-16' : 'ml-64'
      )}>
        <Header />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
