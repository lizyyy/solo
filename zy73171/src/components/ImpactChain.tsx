import { ArrowDown, ArrowUp, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ImpactNode as ImpactNodeType } from '../types';
import { cn } from '../lib/utils';

interface Props {
  nodes: ImpactNodeType[];
  conclusionChanged: boolean;
}

export default function ImpactChain({ nodes, conclusionChanged }: Props) {
  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
        <CheckCircle2 className="w-10 h-10" />
        <p className="text-sm">本次未触发影响规则，结论未变</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
        <AlertTriangle className={cn('w-4 h-4', conclusionChanged ? 'text-amber-600' : 'text-emerald-600')} />
        <span className="text-sm font-medium text-slate-700">
          结论{conclusionChanged ? '发生变化' : '未变'}，共 {nodes.length} 条影响
        </span>
        {conclusionChanged && <span className="badge badge-amber">请复核</span>}
      </div>
      <div className="relative pl-4">
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-slate-200" />
        {nodes.map((n, idx) => (
          <div key={idx} className="relative pb-4 last:pb-0">
            <div className={cn(
              'absolute -left-0.5 top-1.5 w-3 h-3 border-2',
              n.deltaType === 'increase' ? 'border-amber-600 bg-amber-100' :
              n.deltaType === 'decrease' ? 'border-emerald-600 bg-emerald-100' :
              'border-navy-600 bg-navy-100'
            )} />
            <div className="ml-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs badge badge-navy">{n.rule}</span>
                <span className="font-mono-data text-xs text-slate-500">{n.paramKey}</span>
              </div>
              <p className="text-xs text-slate-600 mt-1">{n.ruleDescription}</p>
              <div className="mt-2 flex items-center gap-2 text-sm font-mono-data flex-wrap">
                <span className="px-2 py-1 bg-slate-100 border border-slate-200">{n.before}</span>
                <span className="text-slate-400">
                  {n.deltaType === 'increase' ? <ArrowUp className="w-3.5 h-3.5 text-amber-600" /> :
                   n.deltaType === 'decrease' ? <ArrowDown className="w-3.5 h-3.5 text-emerald-600" /> :
                   <ArrowRight className="w-3.5 h-3.5 text-navy-600" />}
                </span>
                <span className="px-2 py-1 bg-navy-50 border border-navy-200 text-navy-800 font-semibold">{n.after}</span>
                <span className={cn(
                  'text-xs px-1.5 py-0.5',
                  n.deltaType === 'increase' && 'text-amber-700 bg-amber-50 border border-amber-200',
                  n.deltaType === 'decrease' && 'text-emerald-700 bg-emerald-50 border border-emerald-200',
                  n.deltaType === 'change' && 'text-navy-700 bg-navy-50 border border-navy-200',
                )}>
                  {n.delta}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
