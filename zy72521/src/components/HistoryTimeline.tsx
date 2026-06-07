import { CheckCircle, AlertTriangle, Link, RefreshCw, User, Cpu, ArrowRight } from 'lucide-react';
import { HistoryEntry, ActionType } from '../types';

const actionIcons: Record<ActionType, React.ReactNode> = {
  import_prompt: <Cpu className="w-4 h-4" />,
  auto_link_kb: <Link className="w-4 h-4" />,
  generate_export: <CheckCircle className="w-4 h-4" />,
  detect_phone_leak: <AlertTriangle className="w-4 h-4" />,
  pending_algorithm_review: <AlertTriangle className="w-4 h-4" />,
  kb_missing: <AlertTriangle className="w-4 h-4" />,
  supplement_kb: <Link className="w-4 h-4" />,
  rerun_export: <RefreshCw className="w-4 h-4" />,
  algorithm_review: <User className="w-4 h-4" />,
  fix_complete: <CheckCircle className="w-4 h-4" />,
  mark_supplemented: <CheckCircle className="w-4 h-4" />,
};

const actionColors: Record<ActionType, string> = {
  import_prompt: 'bg-slate-500',
  auto_link_kb: 'bg-emerald-500',
  generate_export: 'bg-emerald-500',
  detect_phone_leak: 'bg-red-500',
  pending_algorithm_review: 'bg-amber-500',
  kb_missing: 'bg-amber-500',
  supplement_kb: 'bg-blue-500',
  rerun_export: 'bg-blue-500',
  algorithm_review: 'bg-purple-500',
  fix_complete: 'bg-emerald-500',
  mark_supplemented: 'bg-blue-500',
};

interface HistoryTimelineProps {
  history: HistoryEntry[];
}

export function HistoryTimeline({ history }: HistoryTimelineProps) {
  return (
    <div className="space-y-1">
      {history.map((entry, index) => (
        <div key={entry.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white ${actionColors[entry.action]}`}>
              {actionIcons[entry.action]}
            </div>
            {index < history.length - 1 && (
              <div className="w-0.5 flex-1 bg-slate-200 my-1" />
            )}
          </div>
          
          <div className="flex-1 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-slate-800 text-sm">
                {entry.description}
              </span>
            </div>
            
            {entry.oldValue && entry.newValue && (
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                <span className="px-2 py-0.5 bg-slate-100 rounded truncate max-w-[150px]">
                  {entry.oldValue}
                </span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded truncate max-w-[150px]">
                  {entry.newValue}
                </span>
              </div>
            )}
            
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{entry.operator}</span>
              <span>·</span>
              <span>{entry.timestamp}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
