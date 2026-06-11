import { ShortageRecord, ChangeLog } from '@/types';
import { ChangeTimeline } from './ChangeTimeline';
import { FileText, Hash, Calendar, User, AlertTriangle } from 'lucide-react';

interface EvidencePanelProps {
  record: ShortageRecord;
  logs: ChangeLog[];
  showRollback?: boolean;
}

export function EvidencePanel({ record, logs, showRollback = false }: EvidencePanelProps) {
  return (
    <div className="space-y-6">
      <div className="bg-stone-50 rounded-lg p-4 border border-stone-200">
        <h4 className="text-sm font-semibold text-stone-800 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-600" />
          合同页原始证据（不可修改）
        </h4>
        <div className="bg-white rounded p-3 border border-stone-200 font-mono text-sm">
          <div className="flex items-start gap-3">
            <span className="text-amber-600 font-bold min-w-[60px]">
              第{record.originalLineNumber}行
            </span>
            <span className="text-stone-700">{record.originalContent}</span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-stone-600">
          <div className="flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5" />
            原始行号: {record.originalLineNumber}
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            导入时间: {new Date(record.createdAt).toLocaleString('zh-CN')}
          </div>
        </div>
      </div>

      {record.isBoundaryCase && (
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <h4 className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            边界场景标记
          </h4>
          <p className="text-sm text-red-700">{record.boundaryType}</p>
          <p className="text-xs text-red-600 mt-2">
            此记录涉及边界规则，需巡演统筹人工复核，不可自动确认
          </p>
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold text-stone-800 mb-3 flex items-center gap-2">
          <User className="w-4 h-4 text-amber-600" />
          人工改动历史（证据链）
        </h4>
        <ChangeTimeline
          logs={logs}
          compact
          recordId={showRollback ? record.id : undefined}
        />
      </div>
    </div>
  );
}
