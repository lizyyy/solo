import { FileText, MessageSquare, User, Calendar, FileCheck, AlertCircle, Users } from 'lucide-react';
import type { ClaimRecord } from '../../types/claim';
import { StatusBadge } from './StatusBadge';
import { useNavigate } from 'react-router-dom';

interface RecordCardProps {
  record: ClaimRecord;
}

export function RecordCard({ record }: RecordCardProps) {
  const navigate = useNavigate();
  const hasManual = !!record.manualJudgment;
  const hasPrompt = !!record.promptVersion;

  return (
    <div
      onClick={() => navigate(`/detail/${record.id}`)}
      className="bg-white rounded-lg border border-gray-200 p-5 cursor-pointer transition-all hover:shadow-md hover:border-gray-300 group"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-mono text-gray-500">{record.id}</span>
            <StatusBadge status={record.status} resultType={record.resultType} />
          </div>
          <h3 className="text-base font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
            {record.userName} · {record.materialType}
          </h3>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <User size={14} className="text-gray-400" />
          <span>用户编号：{record.userId}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar size={14} className="text-gray-400" />
          <span>提交时间：{record.submitTime}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs ${
            hasManual
              ? 'bg-blue-50 text-blue-700 border border-blue-100'
              : 'bg-gray-50 text-gray-400 border border-gray-100'
          }`}
        >
          <FileText size={12} />
          <span>人工改判表</span>
          {hasManual && <FileCheck size={12} className="text-blue-500" />}
        </div>
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs ${
            hasPrompt
              ? 'bg-purple-50 text-purple-700 border border-purple-100'
              : 'bg-gray-50 text-gray-400 border border-gray-100'
          }`}
        >
          <MessageSquare size={12} />
          <span>提示词版本号</span>
          {hasPrompt && <FileCheck size={12} className="text-purple-500" />}
        </div>
        {record.isDuplicateUser && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-amber-50 text-amber-700 border border-amber-100">
            <Users size={12} />
            <span>疑似重复</span>
          </div>
        )}
      </div>

      {record.finalConclusion ? (
        <div className="p-3 bg-gray-50 rounded-md">
          <div className="text-xs text-gray-500 mb-1">最终结论</div>
          <div className="text-sm text-gray-800 font-medium">{record.finalConclusion}</div>
        </div>
      ) : (
        <div className="p-3 bg-amber-50 rounded-md">
          <div className="flex items-center gap-1.5 text-xs text-amber-700">
            <AlertCircle size={12} />
            <span>处理中，尚未形成最终结论</span>
          </div>
        </div>
      )}
    </div>
  );
}
