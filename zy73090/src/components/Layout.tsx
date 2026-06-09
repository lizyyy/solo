import { NavLink } from 'react-router-dom';
import { Layers, User, CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import type { ToastType } from '@/store/app';

interface LayoutProps {
  children: React.ReactNode;
}

const toastStyles: Record<ToastType, { bg: string; icon: React.ReactNode; border: string }> = {
  success: {
    bg: 'bg-green-500/95 text-white',
    icon: <CheckCircle2 className="h-5 w-5 shrink-0" />,
    border: 'border-green-400',
  },
  error: {
    bg: 'bg-red-500/95 text-white',
    icon: <XCircle className="h-5 w-5 shrink-0" />,
    border: 'border-red-400',
  },
  info: {
    bg: 'bg-blue-500/95 text-white',
    icon: <Info className="h-5 w-5 shrink-0" />,
    border: 'border-blue-400',
  },
  warning: {
    bg: 'bg-orange-500/95 text-white',
    icon: <AlertTriangle className="h-5 w-5 shrink-0" />,
    border: 'border-orange-400',
  },
};

export function Layout({ children }: LayoutProps) {
  const { toast } = useToast();

  return (
    <div className="min-h-screen bg-bg text-slate-100">
      <header className="sticky top-0 z-40 border-b border-bg-border bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-8">
          <div className="flex items-center gap-10">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 shadow-lg shadow-brand-600/30">
                <Layers className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-semibold tracking-tight">机电管综图纸复核</h1>
                <p className="text-[11px] text-slate-400">MEP Drawing Review System</p>
              </div>
            </div>
            <nav className="flex items-center gap-1">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3.5 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-600/15 text-brand-100'
                      : 'text-slate-300 hover:bg-bg-card hover:text-white',
                  )
                }
              >
                任务列表
              </NavLink>
              <NavLink
                to="/guide"
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3.5 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-600/15 text-brand-100'
                      : 'text-slate-300 hover:bg-bg-card hover:text-white',
                  )
                }
              >
                上手文档
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-bg-border bg-bg-card px-3 py-1.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600/20">
                <User className="h-3.5 w-3.5 text-brand-100" />
              </div>
              <span className="text-xs font-medium text-slate-200">建筑师小赵</span>
            </div>
          </div>
        </div>
      </header>

      {toast && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 animate-fade-in-up">
          <div
            className={cn(
              'flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-sm',
              toastStyles[toast.type].bg,
              toastStyles[toast.type].border,
            )}
          >
            {toastStyles[toast.type].icon}
            <span className="text-sm font-medium leading-5">{toast.msg}</span>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-[1400px] px-8 py-8">{children}</main>
    </div>
  );
}
