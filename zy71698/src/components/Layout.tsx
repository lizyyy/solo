import React from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import {
  Home,
  Upload,
  Play,
  History,
  FileText,
  ChevronLeft,
  Film,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const { id: projectId } = useParams<{ id: string }>();
  const { currentProjectId, projects } = useAppStore();
  const activeProjectId = projectId || currentProjectId;
  const currentProject = projects.find(p => p.id === activeProjectId);

  const navItems: NavItem[] = activeProjectId
    ? [
        { path: `/project/${activeProjectId}/upload`, label: '材料上传', icon: <Upload size={18} /> },
        { path: `/project/${activeProjectId}/process`, label: '核对处理', icon: <Play size={18} /> },
        { path: `/project/${activeProjectId}/history`, label: '历史回看', icon: <History size={18} /> },
        { path: `/project/${activeProjectId}/report`, label: '报告导出', icon: <FileText size={18} /> },
      ]
    : [];

  return (
    <div className="flex h-screen bg-bg-primary text-text-primary overflow-hidden">
      <aside className="w-64 bg-bg-secondary border-r border-bg-tertiary flex flex-col">
        <div className="p-4 border-b border-bg-tertiary">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-3 w-full p-2 rounded hover:bg-bg-tertiary transition-colors"
          >
            <div className="w-10 h-10 bg-accent-success rounded flex items-center justify-center">
              <Film className="text-white" size={20} />
            </div>
            <div className="text-left">
              <div className="font-bold text-sm">Cue点核对工具</div>
              {currentProject && (
                <div className="text-xs text-text-muted truncate max-w-[160px]">
                  {currentProject.name}
                </div>
              )}
            </div>
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <button
            onClick={() => navigate('/')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors',
              !activeProjectId ? 'bg-bg-tertiary text-accent-success' : 'hover:bg-bg-tertiary'
            )}
          >
            <Home size={18} />
            <span>项目首页</span>
          </button>

          {activeProjectId && (
            <>
              <div className="px-3 py-2 text-xs text-text-muted uppercase tracking-wider mt-4">
                项目工作区
              </div>
              {navItems.map(item => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors',
                    location.pathname === item.path
                      ? 'bg-bg-tertiary text-accent-success'
                      : 'hover:bg-bg-tertiary'
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </>
          )}
        </nav>

        {activeProjectId && (
          <div className="p-3 border-t border-bg-tertiary">
            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              <ChevronLeft size={16} />
              <span>返回项目列表</span>
            </button>
          </div>
        )}
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-bg-secondary border-b border-bg-tertiary flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            {currentProject && (
              <>
                <h1 className="text-lg font-semibold">{currentProject.name}</h1>
                <span className={cn(
                  'text-xs px-2 py-1 rounded',
                  currentProject.status === 'completed' && 'bg-accent-success/20 text-accent-success',
                  currentProject.status === 'has_issues' && 'bg-accent-error/20 text-accent-error',
                  currentProject.status === 'processing' && 'bg-accent-warning/20 text-accent-warning',
                  !['completed', 'has_issues', 'processing'].includes(currentProject.status) && 'bg-bg-tertiary text-text-muted'
                )}>
                  {currentProject.status === 'draft' && '草稿'}
                  {currentProject.status === 'uploading' && '上传中'}
                  {currentProject.status === 'processing' && '处理中'}
                  {currentProject.status === 'completed' && '已完成'}
                  {currentProject.status === 'has_issues' && '存在问题'}
                </span>
              </>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-auto scrollbar-thin">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
