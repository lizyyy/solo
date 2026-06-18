import { useState } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { FileText, Undo2, GitBranch, StickyNote, ChevronDown, ChevronUp, AlertTriangle, ArrowRight, Info } from 'lucide-react';
import type { TraceRecord } from '@/types';
import { RECORD_TYPE_LABELS } from '@/types';
import { generateChangeExplanation, generateWithdrawTrace } from '@/utils/traceEngine';
import { useStore } from '@/store/useStore';

interface TimelineItemProps {
  record: TraceRecord;
  allRecords: TraceRecord[];
  isExpanded: boolean;
  isLast: boolean;
  onToggle: () => void;
}

const recordIcons = {
  create: FileText,
  withdraw: Undo2,
  change: GitBranch,
  note: StickyNote,
};

const recordColors = {
  create: 'border-success-500 bg-success-900/30 text-success-400',
  withdraw: 'border-danger-500 bg-danger-900/30 text-danger-400',
  change: 'border-primary-500 bg-primary-900/30 text-primary-400',
  note: 'border-industrial-500 bg-industrial-700/30 text-industrial-300',
};

export function TimelineItem({ record, allRecords, isExpanded, isLast, onToggle }: TimelineItemProps) {
  const [showExplanation, setShowExplanation] = useState(false);
  const records = useStore((state) => state.records);

  const Icon = recordIcons[record.type];
  const explanation = generateChangeExplanation(record, allRecords);
  const withdrawTrace = record.type === 'withdraw' ? generateWithdrawTrace(record, allRecords) : null;

  const hasChangeOrderIssue = record.type === 'change' && (!record.hasChangeOrder || record.changeOrderLate);

  return (
    <div className="relative pl-10 pb-6 last:pb-0">
      {!isLast && <div className="timeline-line" />}

      <div className="absolute left-0">
        <div className={`timeline-node ${recordColors[record.type]}`}>
          <Icon className="w-3 h-3" />
        </div>
      </div>

      <div
        className={`cursor-pointer transition-all ${
          record.type === 'withdraw' ? 'withdrawn-record rounded-r-lg p-3 -ml-3 pl-10' : ''
        }`}
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-xs font-medium ${
                  record.type === 'create'
                    ? 'text-success-400'
                    : record.type === 'withdraw'
                    ? 'text-danger-400'
                    : record.type === 'change'
                    ? 'text-primary-400'
                    : 'text-industrial-400'
                }`}
              >
                {RECORD_TYPE_LABELS[record.type]}
              </span>
              <span className="text-xs text-industrial-500 font-mono">
                {format(new Date(record.operateTime), 'MM-dd HH:mm', { locale: zhCN })}
              </span>
              <span className="text-xs text-industrial-500">·</span>
              <span className="text-xs text-industrial-400">{record.operator}</span>

              {hasChangeOrderIssue && (
                <span className="flex items-center gap-1 text-xs text-warning-400">
                  <AlertTriangle className="w-3 h-3 animate-pulse" />
                  变更单异常
                </span>
              )}
            </div>

            <p className="text-sm text-industrial-200 mb-1">{record.content}</p>

            {record.type !== 'create' && (
              <div className="flex items-center gap-2 text-xs text-industrial-400 mb-1">
                <span className="line-through text-industrial-600">「{record.previousConclusion}」</span>
                <ArrowRight className="w-3 h-3 text-industrial-600" />
                <span className="text-industrial-300">「{record.newConclusion}」</span>
              </div>
            )}

            {record.changeOrderNo && (
              <div className="flex items-center gap-1 text-xs text-industrial-500 font-mono mb-1">
                <FileText className="w-3 h-3" />
                变更单：{record.changeOrderNo}
                {record.changeOrderLate && (
                  <span className="text-warning-400 ml-1">(晚到)</span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {record.type === 'withdraw' && withdrawTrace?.hasFollowUp && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowExplanation(!showExplanation);
                }}
                className="p-1.5 hover:bg-industrial-700 rounded text-xs text-primary-400 flex items-center gap-1"
              >
                <Info className="w-3.5 h-3.5" />
                追溯
              </button>
            )}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-industrial-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-industrial-500" />
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="mt-3 space-y-2 animate-fade-in">
            {record.reason && (
              <div className="bg-industrial-900/50 rounded p-2 border border-industrial-700">
                <p className="text-xs text-industrial-400 mb-1">变更原因：</p>
                <p className="text-sm text-industrial-200">{record.reason}</p>
              </div>
            )}

            {record.remark && (
              <div className="bg-industrial-900/50 rounded p-2 border border-industrial-700">
                <p className="text-xs text-industrial-400 mb-1">备注：</p>
                <p className="text-sm text-industrial-200">{record.remark}</p>
              </div>
            )}

            <div className="bg-primary-900/20 rounded p-2 border border-primary-700/50">
              <p className="text-xs text-primary-400 mb-1 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                结论变化说明
              </p>
              <p className="text-sm text-primary-200">{explanation.text}</p>
            </div>

            {record.type === 'withdraw' && withdrawTrace && (
              <div className="bg-danger-900/20 rounded p-2 border border-danger-700/50">
                <p className="text-xs text-danger-400 mb-1">撤回追溯链条：</p>
                <div className="text-sm text-danger-200 whitespace-pre-line font-mono text-xs">
                  {withdrawTrace.trace}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <ArrowRight className="w-3 h-3 text-success-400" />
                  <span className="text-industrial-400">最终结论：</span>
                  <span className="text-success-300 font-medium">「{withdrawTrace.finalConclusion}」</span>
                </div>
              </div>
            )}

            {hasChangeOrderIssue && (
              <div className="bg-warning-900/20 rounded p-2 border border-warning-700/50">
                <p className="text-xs text-warning-400 mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  变更单异常提醒
                </p>
                <p className="text-sm text-warning-300">
                  {!record.hasChangeOrder
                    ? '本次变更缺少正式变更单，请尽快补充。'
                    : '变更单晚到，可能影响材料追踪的时效性，请确认是否已落实。'}
                </p>
              </div>
            )}
          </div>
        )}

        {showExplanation && withdrawTrace && (
          <div
            className="absolute left-full ml-2 top-0 z-20 bg-industrial-800 border border-primary-600 rounded-lg p-3 w-72 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs text-primary-400 mb-2 font-medium">撤回→最终结论追溯</p>
            <div className="text-xs text-industrial-200 whitespace-pre-line font-mono">
              {withdrawTrace.trace}
            </div>
            <div className="mt-2 pt-2 border-t border-industrial-700 flex items-center gap-2">
              <ArrowRight className="w-3 h-3 text-success-400 flex-shrink-0" />
              <span className="text-xs text-success-300 font-medium">
                最终：{withdrawTrace.finalConclusion}
              </span>
            </div>
            <button
              onClick={() => setShowExplanation(false)}
              className="absolute -top-2 -right-2 p-1 bg-industrial-700 rounded-full hover:bg-industrial-600"
            >
              <X className="w-3 h-3 text-industrial-400" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function X({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
