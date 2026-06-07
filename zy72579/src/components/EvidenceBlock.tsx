import { useState, ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface EvidenceBlockProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  variant?: 'default' | 'warning';
}

export function EvidenceBlock({ title, icon, children, defaultOpen = true, variant = 'default' }: EvidenceBlockProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const borderClass = variant === 'warning' ? 'border-amber-200' : 'border-slate-200';
  const headerBgClass = variant === 'warning' ? 'bg-amber-50' : 'bg-slate-50';

  return (
    <div className={`border ${borderClass} bg-white`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 flex items-center justify-between ${headerBgClass} hover:bg-opacity-80 transition-colors`}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold text-slate-900 font-serif">{title}</span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      {isOpen && <div className="p-4">{children}</div>}
    </div>
  );
}
