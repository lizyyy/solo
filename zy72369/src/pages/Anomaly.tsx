import { useState } from 'react';
import { useStore } from '@/store';
import type { ConflictStatus } from '@/types';
import { AlertTriangle, ChevronDown, ChevronUp, CheckCircle, XCircle, RotateCcw } from 'lucide-react';

export default function Anomaly() {
  const conflicts = useStore(s => s.conflicts);
  const records = useStore(s => s.records);
  const nameplates = useStore(s => s.nameplates);
  const currentUser = useStore(s => s.currentUser);
  const resolveConflict = useStore(s => s.resolveConflict);
  const reviewRecord = useStore(s => s.reviewRecord);

  const [expandedConflict, setExpandedConflict] = useState<string | null>(null);
  const [reviewingRecordId, setReviewingRecordId] = useState<string | null>(null);
  const [reviewConclusion, setReviewConclusion] = useState('');

  const pendingConflicts = conflicts.filter(c => c.status === 'pending');
  const pendingReviewRecords = records.filter(r => r.status === 'pending_review');
  const isEngineer = currentUser?.role === 'equipment_engineer';
  const isLabTeacher = currentUser?.role === 'lab_teacher';

  const handleResolve = (conflictId: string, status: ConflictStatus) => {
    resolveConflict(conflictId, status, currentUser?.name || '未知');
  };

  const handleReview = () => {
    if (!reviewingRecordId || !reviewConclusion.trim()) return;
    reviewRecord(reviewingRecordId, reviewConclusion.trim(), currentUser?.name || '未知');
    setReviewingRecordId(null);
    setReviewConclusion('');
  };

  const statusLabel = (s: ConflictStatus) => {
    switch (s) {
      case 'pending': return { text: '待裁决', cls: 'bg-orange-50 text-orange-700' };
      case 'confirmed_nameplate': return { text: '确认铭牌', cls: 'bg-green-50 text-green-700' };
      case 'confirmed_screenshot': return { text: '确认截图', cls: 'bg-blue-50 text-blue-700' };
      case 'rejected': return { text: '已驳回', cls: 'bg-red-50 text-red-700' };
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-900">异常工况表</h2>

      {/* Conflict Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-[#E36414]" />
          <h3 className="font-semibold text-gray-800">冲突检测</h3>
          {pendingConflicts.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-[#E36414] text-white text-xs rounded-full">{pendingConflicts.length}</span>
          )}
        </div>

        {conflicts.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">暂无冲突条目</p>
        ) : (
          <div className="space-y-3">
            {conflicts.map(c => {
              const expanded = expandedConflict === c.id;
              const sl = statusLabel(c.status);
              const record = records.find(r => r.id === c.recordId);
              const np = record ? nameplates.find(n => n.id === record.nameplateId) : null;

              return (
                <div key={c.id} className={`border rounded-lg ${c.status === 'pending' ? 'border-[#E36414]/30 bg-orange-50/30' : 'border-gray-100'}`}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${sl.cls}`}>{sl.text}</span>
                    <span className="text-sm text-gray-700 font-mono">{np?.equipmentCode || c.recordId.slice(0, 8)}</span>
                    <span className="text-xs text-gray-400 flex-1">铭牌: {c.nameplateValue} vs 截图: {c.screenshotValue}</span>
                    <button onClick={() => setExpandedConflict(expanded ? null : c.id)} className="text-gray-400 hover:text-gray-600">
                      {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                  {expanded && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div className="grid grid-cols-2 gap-4 mt-3">
                        <div className="p-3 bg-[#0F4C5C]/5 rounded-lg">
                          <p className="text-xs font-medium text-[#0F4C5C] mb-1">铭牌参数</p>
                          <p className="text-sm text-gray-800">{c.nameplateValue}</p>
                          <p className="text-xs text-gray-400 mt-1">{c.nameplateEvidence}</p>
                        </div>
                        <div className="p-3 bg-[#E36414]/5 rounded-lg">
                          <p className="text-xs font-medium text-[#E36414] mb-1">截图备注</p>
                          <p className="text-sm text-gray-800">{c.screenshotValue}</p>
                          <p className="text-xs text-gray-400 mt-1">{c.screenshotEvidence}</p>
                        </div>
                      </div>
                      {c.status === 'pending' && isEngineer && (
                        <div className="flex gap-2 mt-4">
                          <button onClick={() => handleResolve(c.id, 'confirmed_nameplate')} className="flex items-center gap-1 px-3 py-1.5 bg-[#0F4C5C] text-white rounded-lg text-xs font-medium hover:bg-[#0d3f4d]">
                            <CheckCircle size={12} /> 确认铭牌
                          </button>
                          <button onClick={() => handleResolve(c.id, 'confirmed_screenshot')} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                            <CheckCircle size={12} /> 确认截图
                          </button>
                          <button onClick={() => handleResolve(c.id, 'rejected')} className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600">
                            <XCircle size={12} /> 驳回
                          </button>
                        </div>
                      )}
                      {c.status !== 'pending' && (
                        <p className="text-xs text-gray-400 mt-3">由 {c.resolvedBy} 于 {c.resolvedAt ? new Date(c.resolvedAt).toLocaleString('zh-CN') : ''} 裁决</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <RotateCcw size={18} className="text-[#FBBF24]" />
          <h3 className="font-semibold text-gray-800">待复核记录</h3>
          {pendingReviewRecords.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-[#FBBF24] text-gray-800 text-xs rounded-full">{pendingReviewRecords.length}</span>
          )}
        </div>

        {pendingReviewRecords.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">暂无待复核记录</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500 text-xs">
                  <th className="py-2 px-3 text-left font-medium">设备</th>
                  <th className="py-2 px-3 text-left font-medium">弯曲半径</th>
                  <th className="py-2 px-3 text-left font-medium">方向</th>
                  <th className="py-2 px-3 text-left font-medium">损耗值</th>
                  <th className="py-2 px-3 text-left font-medium">录入人</th>
                  <th className="py-2 px-3 text-left font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {pendingReviewRecords.map(r => {
                  const np = nameplates.find(n => n.id === r.nameplateId);
                  return (
                    <tr key={r.id} className="border-b border-gray-50 bg-yellow-50/30 border-l-2 border-l-[#FBBF24]">
                      <td className="py-2 px-3">{np?.equipmentCode || r.nameplateId.slice(0, 8)}</td>
                      <td className="py-2 px-3">{r.bendRadius}mm</td>
                      <td className="py-2 px-3 text-[#E36414] font-medium">{r.direction}</td>
                      <td className="py-2 px-3">{r.lossValue}dB</td>
                      <td className="py-2 px-3">{r.operator}</td>
                      <td className="py-2 px-3">
                        {isLabTeacher ? (
                          <button onClick={() => setReviewingRecordId(r.id)} className="px-2 py-1 bg-[#0F4C5C] text-white rounded text-[10px] font-medium hover:bg-[#0d3f4d]">
                            复核
                          </button>
                        ) : (
                          <span className="text-gray-400">需实验老师复核</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {reviewingRecordId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setReviewingRecordId(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800 mb-4">实验老师复核</h3>
            {(() => {
              const r = records.find(rec => rec.id === reviewingRecordId);
              if (!r) return null;
              const np = nameplates.find(n => n.id === r.nameplateId);
              return (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm space-y-1">
                  <p>设备: <span className="font-mono">{np?.equipmentCode || '-'}</span></p>
                  <p>弯曲半径: <span className="font-mono">{r.bendRadius}mm</span></p>
                  <p>方向: <span className="font-mono text-[#E36414]">{r.direction}</span></p>
                  <p>损耗值: <span className="font-mono">{r.lossValue}dB</span></p>
                </div>
              );
            })()}
            <textarea
              value={reviewConclusion}
              onChange={e => setReviewConclusion(e.target.value)}
              placeholder="请填写复核结论，如：确认方向为负方向（-）"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-4 h-24 resize-none focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setReviewingRecordId(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={handleReview} disabled={!reviewConclusion.trim()} className="px-4 py-2 bg-[#0F4C5C] text-white rounded-lg text-sm font-medium hover:bg-[#0d3f4d] disabled:opacity-40 disabled:cursor-not-allowed">确认复核</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
