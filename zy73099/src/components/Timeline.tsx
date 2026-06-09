import type { TimelineNode } from '@/types';
import { cn } from '@/lib/utils';
import {
  FileText,
  Edit3,
  PlusCircle,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';

const NODE_STYLE: Record<TimelineNode['type'], {
  icon: typeof FileText;
  dot: string;
  ring: string;
  label: string;
  card: string;
}> = {
  origin: {
    icon: FileText,
    dot: 'bg-blue-500',
    ring: 'ring-blue-200',
    label: '会议纪要',
    card: 'border-blue-100 bg-blue-50/40',
  },
  manual_change: {
    icon: Edit3,
    dot: 'bg-violet-500',
    ring: 'ring-violet-200',
    label: '人工改判',
    card: 'border-violet-100 bg-violet-50/40',
  },
  supplement: {
    icon: PlusCircle,
    dot: 'bg-sky-500',
    ring: 'ring-sky-200',
    label: '补充说明',
    card: 'border-sky-100 bg-sky-50/40',
  },
  confirm: {
    icon: CheckCircle2,
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-200',
    label: '人工确认',
    card: 'border-emerald-100 bg-emerald-50/40',
  },
  revert: {
    icon: RotateCcw,
    dot: 'bg-rose-500',
    ring: 'ring-rose-200',
    label: '撤回退回',
    card: 'border-rose-100 bg-rose-50/40',
  },
  awaiting: {
    icon: AlertTriangle,
    dot: 'bg-orange-500',
    ring: 'ring-orange-200',
    label: '异常卡壳',
    card: 'border-orange-100 bg-orange-50/40',
  },
};

export function Timeline({ nodes }: { nodes: TimelineNode[] }) {
  return (
    <div className="relative pl-1">
      <div className="absolute left-[19px] top-1 bottom-1 w-0.5 bg-gradient-to-b from-blue-200 via-violet-200 to-emerald-200" />
      <ul className="space-y-5">
        {nodes.map((node, idx) => {
          const cfg = NODE_STYLE[node.type];
          const Icon = cfg.icon;
          return (
            <li
              key={node.id}
              className="relative animate-[fadeInUp_0.3s_ease-out]"
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <div
                className={cn(
                  'absolute left-0 top-0.5 z-10 flex h-10 w-10 items-center justify-center rounded-full ring-4',
                  cfg.dot,
                  cfg.ring
                )}
              >
                <Icon className="h-4 w-4 text-white" strokeWidth={2.5} />
              </div>
              <div className="ml-14">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-xs font-semibold uppercase tracking-wider',
                      node.type === 'origin' && 'text-blue-700',
                      node.type === 'manual_change' && 'text-violet-700',
                      node.type === 'supplement' && 'text-sky-700',
                      node.type === 'confirm' && 'text-emerald-700',
                      node.type === 'revert' && 'text-rose-700',
                      node.type === 'awaiting' && 'text-orange-700'
                    )}
                  >
                    {cfg.label}
                  </span>
                  <span className="text-[11px] text-slate-400">{node.timestamp}</span>
                </div>
                <div className="mt-1.5">
                  <div
                    className={cn(
                      'rounded-xl border p-3.5 text-[13.5px] leading-relaxed text-slate-700',
                      cfg.card
                    )}
                  >
                    <div className="font-semibold text-slate-900 mb-1">{node.title}</div>
                    <div className="whitespace-pre-wrap break-words">{node.content}</div>
                  </div>
                </div>
                {node.operator && (
                  <div className="mt-1.5 text-[11px] text-slate-400">操作人：{node.operator}</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
