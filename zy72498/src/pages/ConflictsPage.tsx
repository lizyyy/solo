import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Camera,
  Bus,
  FileWarning,
  Users
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import type { ConflictType, ConflictRecord } from '@/types';

const CONFLICT_TYPE_LABELS: Record<ConflictType, string> = {
  'photo-bus-mismatch': '照片与公交数据矛盾',
  'community-name-ambiguity': '小区名称歧义',
  'data-inconsistency': '数据不一致'
};

const CONFLICT_TYPE_ICONS: Record<ConflictType, typeof Camera> = {
  'photo-bus-mismatch': FileWarning,
  'community-name-ambiguity': Users,
  'data-inconsistency': AlertTriangle
};

export default function ConflictsPage() {
  const { conflicts, resolveConflict } = useAppStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'pending' | 'confirmed' | 'rejected'>('all');
  const [handlerNote, setHandlerNote] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const filteredConflicts = conflicts.filter(c => {
    if (filterType === 'all') return true;
    return c.status === filterType;
  });

  const pendingCount = conflicts.filter(c => c.status === 'pending').length;
  const confirmedCount = conflicts.filter(c => c.status === 'confirmed').length;
  const rejectedCount = conflicts.filter(c => c.status === 'rejected').length;

  const handleResolve = (id: string, status: 'confirmed' | 'rejected') => {
    resolveConflict(id, status, handlerNote || undefined);
    setResolvingId(null);
    setHandlerNote('');
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">冲突检测中心</h2>
        <p className="text-slate-500 mt-1">查看并处理数据中的冲突和异常，不自动拍板，交由人工确认</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div
          className={`p-4 rounded-lg cursor-pointer transition-all ${
            filterType === 'all' ? 'bg-sky-600 text-white' : 'bg-white border border-slate-200 hover:border-sky-300'
          }`}
          onClick={() => setFilterType('all')}
        >
          <div className={`text-2xl font-bold ${filterType === 'all' ? 'text-white' : 'text-slate-800'}`}>
            {conflicts.length}
          </div>
          <div className={`text-sm ${filterType === 'all' ? 'text-sky-100' : 'text-slate-500'}`}>
            全部冲突
          </div>
        </div>
        <div
          className={`p-4 rounded-lg cursor-pointer transition-all ${
            filterType === 'pending' ? 'bg-amber-500 text-white' : 'bg-white border border-slate-200 hover:border-amber-300'
          }`}
          onClick={() => setFilterType('pending')}
        >
          <div className={`text-2xl font-bold ${filterType === 'pending' ? 'text-white' : 'text-amber-600'}`}>
            {pendingCount}
          </div>
          <div className={`text-sm ${filterType === 'pending' ? 'text-amber-100' : 'text-slate-500'}`}>
            待处理
          </div>
        </div>
        <div
          className={`p-4 rounded-lg cursor-pointer transition-all ${
            filterType === 'confirmed' ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200 hover:border-emerald-300'
          }`}
          onClick={() => setFilterType('confirmed')}
        >
          <div className={`text-2xl font-bold ${filterType === 'confirmed' ? 'text-white' : 'text-emerald-600'}`}>
            {confirmedCount}
          </div>
          <div className={`text-sm ${filterType === 'confirmed' ? 'text-emerald-100' : 'text-slate-500'}`}>
            已确认
          </div>
        </div>
        <div
          className={`p-4 rounded-lg cursor-pointer transition-all ${
            filterType === 'rejected' ? 'bg-red-500 text-white' : 'bg-white border border-slate-200 hover:border-red-300'
          }`}
          onClick={() => setFilterType('rejected')}
        >
          <div className={`text-2xl font-bold ${filterType === 'rejected' ? 'text-white' : 'text-red-600'}`}>
            {rejectedCount}
          </div>
          <div className={`text-sm ${filterType === 'rejected' ? 'text-red-100' : 'text-slate-500'}`}>
            已驳回
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredConflicts.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <CheckCircle size={48} className="mx-auto text-emerald-500 mb-4" />
            <p className="text-slate-600 text-lg">暂无{filterType === 'all' ? '' : filterType === 'pending' ? '待处理的' : filterType === 'confirmed' ? '已确认的' : '已驳回的'}冲突</p>
            <p className="text-slate-400 text-sm mt-2">数据看起来很干净</p>
          </div>
        ) : (
          filteredConflicts.map((conflict) => (
            <ConflictCard
              key={conflict.id}
              conflict={conflict}
              isExpanded={expandedId === conflict.id}
              onToggle={() => setExpandedId(expandedId === conflict.id ? null : conflict.id)}
              isResolving={resolvingId === conflict.id}
              onStartResolve={() => setResolvingId(conflict.id)}
              onCancelResolve={() => {
                setResolvingId(null);
                setHandlerNote('');
              }}
              handlerNote={handlerNote}
              onNoteChange={setHandlerNote}
              onResolve={(status) => handleResolve(conflict.id, status)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface ConflictCardProps {
  conflict: ConflictRecord;
  isExpanded: boolean;
  onToggle: () => void;
  isResolving: boolean;
  onStartResolve: () => void;
  onCancelResolve: () => void;
  handlerNote: string;
  onNoteChange: (note: string) => void;
  onResolve: (status: 'confirmed' | 'rejected') => void;
}

function ConflictCard({
  conflict,
  isExpanded,
  onToggle,
  isResolving,
  onStartResolve,
  onCancelResolve,
  handlerNote,
  onNoteChange,
  onResolve
}: ConflictCardProps) {
  const TypeIcon = CONFLICT_TYPE_ICONS[conflict.type];

  const statusConfig = {
    pending: { label: '待处理', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
    confirmed: { label: '已确认', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
    rejected: { label: '已驳回', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' }
  }[conflict.status];

  const severityConfig = {
    warning: { label: '警告', dot: 'bg-amber-500' },
    error: { label: '错误', dot: 'bg-red-500' }
  }[conflict.severity];

  return (
    <div
      className={`bg-white rounded-lg border transition-all ${
        conflict.status === 'pending' ? 'border-amber-300 shadow-sm' : 'border-slate-200'
      }`}
    >
      <div
        className="p-4 cursor-pointer flex items-center justify-between"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              conflict.status === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
            }`}
          >
            <TypeIcon size={20} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <span className="font-medium text-slate-800">{conflict.description}</span>
              <span className={`w-2 h-2 rounded-full ${severityConfig.dot}`} title={severityConfig.label} />
            </div>
            <div className="text-sm text-slate-500 mt-1 flex items-center gap-3">
              <span>{CONFLICT_TYPE_LABELS[conflict.type]}</span>
              {conflict.relatedCommunity && (
                <span>涉及小区：{conflict.relatedCommunity}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 text-sm rounded-full ${statusConfig.bg} ${statusConfig.text}`}>
            {statusConfig.label}
          </span>
          {conflict.handledAt && (
            <span className="text-sm text-slate-400">{conflict.handledAt}</span>
          )}
          {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-slate-100 p-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                <Camera size={16} className="text-sky-500" />
                证据 A：{conflict.evidenceA.source}
              </div>
              <pre className="text-xs text-slate-600 bg-white p-3 rounded border border-slate-200 overflow-x-auto">
                {JSON.stringify(conflict.evidenceA.data, null, 2)}
              </pre>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                <Bus size={16} className="text-emerald-500" />
                证据 B：{conflict.evidenceB.source}
              </div>
              <pre className="text-xs text-slate-600 bg-white p-3 rounded border border-slate-200 overflow-x-auto">
                {JSON.stringify(conflict.evidenceB.data, null, 2)}
              </pre>
            </div>
          </div>

          {conflict.handlerNote && (
            <div className="mb-4 p-3 bg-sky-50 rounded-lg">
              <div className="text-sm font-medium text-sky-700">处理备注</div>
              <div className="text-sm text-sky-600 mt-1">{conflict.handlerNote}</div>
            </div>
          )}

          {conflict.status === 'pending' && (
            <div>
              {!isResolving ? (
                <div className="flex justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartResolve();
                    }}
                    className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
                  >
                    处理此冲突
                  </button>
                </div>
              ) : (
                <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">处理备注（可选）</label>
                    <textarea
                      value={handlerNote}
                      onChange={(e) => onNoteChange(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                      rows={2}
                      placeholder="请说明确认或驳回的原因..."
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={onCancelResolve}
                      className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => onResolve('rejected')}
                      className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg"
                    >
                      <XCircle size={16} />
                      驳回（数据有误）
                    </button>
                    <button
                      onClick={() => onResolve('confirmed')}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg"
                    >
                      <CheckCircle size={16} />
                      确认（冲突属实）
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {conflict.status !== 'pending' && conflict.handledBy && (
            <div className="text-sm text-slate-500 flex justify-end">
              处理人：{conflict.handledBy}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
