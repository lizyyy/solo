import { ChevronRight } from 'lucide-react';
import type { TraceLink } from '@/utils/types';
import { useHallStore } from '@/store/useHallStore';

interface TraceBreadcrumbProps {
  traceChain: TraceLink[];
}

export default function TraceBreadcrumb({ traceChain }: TraceBreadcrumbProps) {
  const setFocusTarget = useHallStore((s) => s.setFocusTarget);
  const selection = useHallStore((s) => s.selection);

  const handleSelect = (link: TraceLink) => {
    setFocusTarget({ type: link.entity, id: link.id });
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {traceChain.map((link, index) => (
        <div key={link.id} className="flex items-center gap-1">
          <button
            onClick={() => handleSelect(link)}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${
              selection.id === link.id
                ? 'text-hall-amber bg-hall-amber/10 font-medium'
                : 'text-hall-textDim hover:text-hall-text hover:bg-hall-panel'
            }`}
          >
            {link.label}
          </button>
          {index < traceChain.length - 1 && (
            <ChevronRight className="w-3 h-3 text-hall-muted" />
          )}
        </div>
      ))}
    </div>
  );
}
