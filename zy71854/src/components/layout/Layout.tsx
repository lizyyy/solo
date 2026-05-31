import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAppStore } from '@/store';

export const Layout: React.FC = () => {
  const { initializeWithMockData, scripts, parts, notes, knowledgePoints } = useAppStore();

  useEffect(() => {
    if (scripts.length === 0 && parts.length === 0 && notes.length === 0 && knowledgePoints.length === 0) {
      const useMock = window.confirm('检测到暂无数据，是否加载演示数据进行体验？\n\n（包含演示脚本、零件清单、知识点和操作历史）');
      if (useMock) {
        initializeWithMockData();
      }
    }
  }, [scripts.length, parts.length, notes.length, knowledgePoints.length, initializeWithMockData]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 min-h-screen overflow-y-auto scrollbar-thin">
        <div className="p-8 animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
