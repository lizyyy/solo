import type { ReactNode } from 'react';
import { Header } from './Header';
import { useShotStore } from '@/store/useShotStore';
import { useEffect } from 'react';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { shots, isHydrated, initializeMockData } = useShotStore();

  useEffect(() => {
    if (isHydrated && shots.length === 0) {
      initializeMockData();
    }
  }, [isHydrated, shots.length, initializeMockData]);

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-film-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-film-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-film-text-secondary">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-film-bg">
      <Header />
      <main className="min-h-[calc(100vh-73px)]">
        {children}
      </main>
    </div>
  );
}
