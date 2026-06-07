import { Clock, FileText } from 'lucide-react';
import { CopyrightRecord } from '../types';
import { StatusBadge } from './StatusBadge';

interface RecordCardProps {
  record: CopyrightRecord;
  isSelected: boolean;
  onClick: () => void;
}

export function RecordCard({ record, isSelected, onClick }: RecordCardProps) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md ${
        isSelected
          ? 'border-slate-700 bg-slate-50 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <h3 className="font-medium text-slate-800 truncate">{record.materialName}</h3>
        </div>
        <StatusBadge status={record.status} />
      </div>
      
      <div className="flex items-center gap-4 text-sm text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-mono">
            {record.promptVersion}
          </span>
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {record.updatedAt.split(' ')[0]}
        </span>
      </div>
      
      {record.hasPhoneLeak && (
        <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700 font-medium">
            ⚠️ 手机号在导出里漏遮，需算法同事复核
          </p>
        </div>
      )}
      
      {!record.knowledgeBaseLink && (
        <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md">
          <p className="text-sm text-amber-700 font-medium">
            ⚠️ 缺少知识库引用链接，请补录
          </p>
        </div>
      )}
    </div>
  );
}
