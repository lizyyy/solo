import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface PageContainerProps {
  title: string;
  subtitle?: string;
  breadcrumb?: { label: string; to?: string }[];
  children: ReactNode;
  actions?: ReactNode;
}

export default function PageContainer({
  title,
  subtitle,
  breadcrumb,
  children,
  actions,
}: PageContainerProps) {
  const defaultBreadcrumb = [{ label: '首页', to: '/' }, ...(breadcrumb || [])];

  return (
    <div className="flex-1 min-w-0 overflow-y-auto scrollbar-thin paper-texture">
      <div className="px-4 lg:px-8 py-5 max-w-[1400px] mx-auto">
        <nav className="flex items-center gap-1.5 text-xs text-industrial-400 mb-3 flex-wrap">
          {defaultBreadcrumb.map((bc, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i === 0 ? <Home className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {bc.to && i < defaultBreadcrumb.length - 1 ? (
                <Link to={bc.to} className="hover:text-industrial-600 transition-colors">
                  {bc.label}
                </Link>
              ) : (
                <span className={i === defaultBreadcrumb.length - 1 ? 'text-industrial-600 font-medium' : ''}>
                  {bc.label}
                </span>
              )}
            </span>
          ))}
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
          <div>
            <h1 className="title-font text-2xl font-bold text-industrial-800 leading-tight">{title}</h1>
            {subtitle && <p className="text-sm text-industrial-500 mt-1 max-w-2xl">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>

        <div className="space-y-5 animate-count-up">{children}</div>
      </div>
    </div>
  );
}
