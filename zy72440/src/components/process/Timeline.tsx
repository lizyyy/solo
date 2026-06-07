import { Upload, Users, FileCheck, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import type { OperationLog, ProcessStep } from '@/types';

interface TimelineProps {
  logs: OperationLog[];
}

const stepIcons: Record<ProcessStep | 'system', React.ElementType> = {
  import: Upload,
  review_jietlong: Users,
  update_verification: FileCheck,
  system: CheckCircle2
};

const actionColors: Record<string, string> = {
  '导入留言': 'bg-blue-500',
  '地区校验': 'bg-slate-500',
  '补看接龙': 'bg-purple-500',
  '生成核销单': 'bg-emerald-500',
  '标记补录返工': 'bg-amber-500',
  '人工修正': 'bg-orange-500',
  '重跑校验': 'bg-teal-500',
  '复核补充地区': 'bg-indigo-500'
};

export function Timeline({ logs }: TimelineProps) {
  return (
    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
        <RefreshCw className="w-5 h-5 text-blue-600" />
        操作历史
      </h3>
      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200" />
        <div className="space-y-6">
          {logs.map((log, index) => {
            const Icon = stepIcons[log.step] || stepIcons.system;
            const colorClass = actionColors[log.action] || 'bg-slate-500';
            const isLast = index === logs.length - 1;
            
            return (
              <div key={log.id} className="relative pl-14">
                <div 
                  className={`absolute left-0 w-10 h-10 rounded-full ${colorClass} text-white flex items-center justify-center shadow-md`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className={`bg-slate-50 rounded-lg p-4 ${isLast ? 'ring-2 ring-blue-200' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-slate-800">{log.action}</span>
                    <span className="text-xs text-slate-500 font-mono">{log.timestamp}</span>
                  </div>
                  <p className="text-sm text-slate-600">{log.description}</p>
                  <p className="text-xs text-slate-400 mt-2">操作人：{log.operator}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
