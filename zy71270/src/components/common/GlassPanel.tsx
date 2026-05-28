import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface GlassPanelProps {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}

export default function GlassPanel({
  title,
  children,
  collapsible = false,
  defaultCollapsed = false,
  className,
  icon,
  actions,
}: GlassPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div
      className={cn(
        'glass rounded-lg overflow-hidden',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between px-4 py-3 border-b border-warehouse-border/50',
          collapsible && 'cursor-pointer select-none'
        )}
        onClick={collapsible ? () => setCollapsed(!collapsed) : undefined}
      >
        <div className="flex items-center gap-2">
          {collapsible && (
            collapsed ? (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )
          )}
          {icon && <span className="text-accent-blue">{icon}</span>}
          <h3 className="text-sm font-semibold text-slate-200 tracking-wide">
            {title}
          </h3>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {!collapsed && (
        <div className="p-4 animate-slide-in">
          {children}
        </div>
      )}
    </div>
  );
}
