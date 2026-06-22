import { useState } from 'react';
import {
  Building2,
  ClipboardList,
  User,
  ChevronDown,
  ChevronUp,
  Edit3,
  FileText,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useWorkbenchStore } from '@/store';
import { ConclusionDisplay, ConclusionColors, type Conclusion, type RecordStatus } from '@/shared/types';
import ReviseModal from './ReviseModal';
import ReconciliationModal from './ReconciliationModal';

const STATUS_LABELS: Record<RecordStatus, { label: string; cls: string; icon: any }> = {
  active: { label: '进行中', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Clock },
  suspended: { label: '已挂起', cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: AlertTriangle },
  pending_confirm: { label: '待确认', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: AlertTriangle },
  confirmed: { label: '已确认', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  archived: { label: '已归档', cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30', icon: ClipboardList },
};

export default function TopBar() {
  const record = useWorkbenchStore((s) => s.record);
  const operator = useWorkbenchStore((s) => s.operator);
  const setOperator = useWorkbenchStore((s) => s.setOperator);
  const showBottomPanel = useWorkbenchStore((s) => s.showBottomPanel);
  const setShowBottomPanel = useWorkbenchStore((s) => s.setShowBottomPanel);
  const setActiveTab = useWorkbenchStore((s) => s.setActiveTab);

  const [showRevise, setShowRevise] = useState(false);
  const [showReconciliation, setShowReconciliation] = useState(false);

  if (!record) return null;

  const statusCfg = STATUS_LABELS[record.status];
  const StatusIcon = statusCfg.icon;
  const pendingCount = record.pending_queue.filter((p) => !p.resolved_at).length;

  return (
    <div className="bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center shadow-lg">
            <Building2 className="text-white" size={22} />
          </div>
          <div>
            <div className="text-white font-bold text-lg leading-tight">
              {record.project_name}
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <span className="font-mono text-xs bg-slate-700/50 px-2 py-0.5 rounded">
                {record.project_code}
              </span>
              <span className="flex items-center gap-1">
                <ClipboardList size={12} />
                {record.structural_element}
              </span>
            </div>
          </div>
        </div>

        <div className={`px-3 py-1.5 rounded-md text-sm border flex items-center gap-1.5 ${statusCfg.cls}`}>
          <StatusIcon size={14} />
          {statusCfg.label}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {record.conclusion && (
          <div className="flex items-center gap-3 bg-slate-700/50 rounded-lg px-4 py-2 border border-slate-600">
            <div className="flex flex-col">
              <span className="text-slate-400 text-xs">当前结论</span>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${ConclusionColors[record.conclusion]}`} />
                <span className="text-white text-sm font-medium">
                  {ConclusionDisplay[record.conclusion]}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-slate-400 text-xs">置信度</span>
              <span className="text-emerald-400 text-sm font-bold">
                {(record.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <button
              onClick={() => setShowRevise(true)}
              className="ml-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-md flex items-center gap-1 transition-colors"
            >
              <Edit3 size={12} />
              改判
            </button>
          </div>
        )}

        <button
          onClick={() => {
            setActiveTab('reconciliation');
            setShowReconciliation(true);
          }}
          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm rounded-lg flex items-center gap-2 transition-colors"
        >
          <FileText size={16} />
          导出对账
          {pendingCount > 0 && (
            <span className="bg-amber-500 text-amber-900 text-xs font-bold px-1.5 py-0.5 rounded-full">
              {pendingCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2 border border-slate-600">
          <User size={16} className="text-slate-400" />
          <input
            type="text"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            className="bg-transparent text-white text-sm outline-none w-32 placeholder-slate-500"
            placeholder="操作人"
          />
        </div>

        <button
          onClick={() => setShowBottomPanel(!showBottomPanel)}
          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg flex items-center gap-1 transition-colors border border-slate-600"
          title={showBottomPanel ? '折叠底部面板' : '展开底部面板'}
        >
          {showBottomPanel ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          底部
        </button>
      </div>

      {showRevise && <ReviseModal onClose={() => setShowRevise(false)} />}
      {showReconciliation && <ReconciliationModal onClose={() => setShowReconciliation(false)} />}
    </div>
  );
}


