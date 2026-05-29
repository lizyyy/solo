import { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import type { AuditStep } from '../types';

interface AuditTraceTimelineProps {
  steps: AuditStep[];
}

export function AuditTraceTimeline({ steps }: AuditTraceTimelineProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(steps[0]?.id || null);

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-[#43A047]" />;
      case 'failed':
        return <AlertTriangle className="w-5 h-5 text-[#E53935]" />;
      case 'running':
        return <Clock className="w-5 h-5 text-[#FB8C00] animate-pulse" />;
      default:
        return <Clock className="w-5 h-5 text-slate-500" />;
    }
  };

  const formatTime = (time?: string) => {
    if (!time) return '-';
    return new Date(time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatJSON = (data: any) => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <div className="space-y-2">
      {steps.map((step, index) => {
        const isExpanded = expandedStep === step.id;
        const isLast = index === steps.length - 1;

        return (
          <div key={step.id} className="relative">
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center flex-shrink-0">
                  {getStepIcon(step.status)}
                </div>
                {!isLast && <div className="w-0.5 flex-1 bg-slate-700 my-2" />}
              </div>

              <div className="flex-1 pb-4">
                <button
                  onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                  className="w-full flex items-center justify-between p-4 bg-slate-800/50 rounded-xl hover:bg-slate-800 transition-colors border border-slate-700/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{step.name}</span>
                    <span className="text-xs text-slate-400">
                      {formatTime(step.startTime)} - {formatTime(step.endTime)}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="mt-2 p-4 bg-slate-800/30 rounded-xl border border-slate-700/30 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm font-medium text-cyan-400">输入数据</span>
                      </div>
                      <pre className="text-xs bg-slate-900/50 p-3 rounded-lg overflow-auto max-h-40 text-slate-300 font-mono">
                        {formatJSON(step.input)}
                      </pre>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-[#43A047]" />
                        <span className="text-sm font-medium text-[#43A047]">输出结果</span>
                      </div>
                      <pre className="text-xs bg-slate-900/50 p-3 rounded-lg overflow-auto max-h-40 text-slate-300 font-mono">
                        {formatJSON(step.output)}
                      </pre>
                    </div>
                    {step.error && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-[#E53935]" />
                          <span className="text-sm font-medium text-[#E53935]">错误信息</span>
                        </div>
                        <p className="text-sm text-[#E53935]">{step.error}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
