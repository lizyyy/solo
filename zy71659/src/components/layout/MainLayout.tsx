import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAppStore } from '@/store/useAppStore';

interface MainLayoutProps {
  children: React.ReactNode;
  onRefresh?: () => void;
  onImport?: () => void;
  onExport?: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  onRefresh,
  onImport,
  onExport,
}) => {
  const { anomalies } = useAppStore();
  const pendingAnomalies = anomalies.filter(a => a.status === 'detected').length;

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <Sidebar anomalyCount={pendingAnomalies} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onRefresh={onRefresh} onImport={onImport} onExport={onExport} />
        <main className="flex-1 overflow-auto scrollbar-thin grid-lines">
          {children}
        </main>
      </div>
    </div>
  );
};
