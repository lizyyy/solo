import { useState } from 'react';
import type { Material, FittingResult } from '../types';

interface Props {
  materials: Material[];
  allMaterials: Material[];
  fittingResults: Record<string, FittingResult>;
  selectedMaterialId: string | null;
  onSelect: (id: string) => void;
  onRename: (materialId: string, newName: string, reason: string) => void;
  onStatusChange: (materialId: string, status: Material['status']) => void;
  onTraceDraft: (material: Material) => void;
}

const STATUS_MAP: Record<Material['status'], { label: string; cls: string; dot: string }> = {
  pending: { label: '待处理', cls: 'tag-yellow', dot: 'bg-amber-500' },
  processed: { label: '已处理', cls: 'tag-blue', dot: 'bg-blue-500' },
  missing: { label: '缺材料', cls: 'tag-red', dot: 'bg-red-500' },
  reviewed: { label: '已复核', cls: 'tag-green', dot: 'bg-green-500' },
};

export default function MaterialsPanel({
  materials, fittingResults, selectedMaterialId, onSelect, onRename, onStatusChange, onTraceDraft,
}: Props) {
  const [renameModal, setRenameModal] = useState<Material | null>(null);
  const [newName, setNewName] = useState('');
  const [renameReason, setRenameReason] = useState('');

  const openRename = (m: Material) => {
    setRenameModal(m);
    setNewName(m.currentName);
    setRenameReason('');
  };

  const confirmRename = () => {
    if (renameModal && newName.trim()) {
      onRename(renameModal.id, newName.trim(), renameReason.trim() || '用户操作');
      setRenameModal(null);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="font-semibold text-slate-800">材料列表</h2>
          <p className="text-xs text-slate-500 mt-0.5">共 {materials.length} 条，点击查看拟合曲线</p>
        </div>
      </div>

      <div className="divide-y divide-slate-100 max-h-[calc(100vh-380px)] overflow-auto">
        {materials.map(m => {
          const r = fittingResults[m.id];
          const selected = m.id === selectedMaterialId;
          const unstable = r?.unstableSort?.unstable || m.sortNote?.includes('⚠️');
          const renamed = m.nameHistory.length > 2;
          return (
            <div
              key={m.id}
              onClick={() => onSelect(m.id)}
              className={`p-4 cursor-pointer transition-colors ${
                selected ? 'bg-primary-50 border-l-4 border-l-primary-500' : 'hover:bg-slate-50 border-l-4 border-l-transparent'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-slate-800 truncate">{m.currentName}</span>
                    {renamed && <span className="tag tag-yellow" title="名称有变更历史">📝改名过</span>}
                    {unstable && <span className="tag tag-red" title="排序不稳定">⚠️排序</span>}
                    {r?.boundaryWarning && <span className="tag tag-red">边界样本不足</span>}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                    <span>{m.id}</span>
                    <span>·</span>
                    <span>单位: <strong className="text-slate-700">{m.unit}</strong></span>
                    <span>·</span>
                    <span>数据点: {m.dataPoints.length}</span>
                    {r && (
                      <>
                        <span>·</span>
                        <span>R²: <strong className={r.rSquared >= 0.999 ? 'text-green-600' : r.rSquared >= 0.99 ? 'text-amber-600' : 'text-red-600'}>
                          {r.rSquared.toFixed(6)}
                        </strong></span>
                      </>
                    )}
                  </div>
                </div>
                <span className={`tag ${STATUS_MAP[m.status].cls}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_MAP[m.status].dot} mr-1.5`} />
                  {STATUS_MAP[m.status].label}
                </span>
              </div>

              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                <button
                  onClick={(e) => { e.stopPropagation(); openRename(m); }}
                  className="text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                >
                  ✏️ 改名
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onTraceDraft(m); }}
                  className="text-xs px-2.5 py-1 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 transition-colors"
                >
                  📜 溯源草稿
                </button>
                {m.status !== 'reviewed' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onStatusChange(m.id, 'reviewed'); }}
                    className="text-xs px-2.5 py-1 rounded-md bg-green-50 hover:bg-green-100 text-green-700 transition-colors"
                  >
                    ✅ 标记复核
                  </button>
                )}
                {m.status !== 'missing' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onStatusChange(m.id, 'missing'); }}
                    className="text-xs px-2.5 py-1 rounded-md bg-red-50 hover:bg-red-100 text-red-700 transition-colors"
                  >
                    🚩 标缺材料
                  </button>
                )}
              </div>

              {m.nameHistory.length > 0 && (
                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer text-slate-500 hover:text-slate-700 select-none">
                    名称历史 ({m.nameHistory.length} 条)
                  </summary>
                  <div className="mt-2 space-y-1 pl-3 border-l-2 border-slate-200">
                    {m.nameHistory.map((h, idx) => (
                      <div key={h.id} className="py-1">
                        <div className="text-slate-600">
                          {idx === m.nameHistory.length - 1 && <span className="tag tag-green mr-1">当前</span>}
                          <strong>{h.name}</strong>
                        </div>
                        <div className="text-slate-400 mt-0.5">
                          {new Date(h.timestamp).toLocaleString('zh-CN')} · {h.operator}
                          {h.reason && <span className="ml-2 italic">— {h.reason}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>

      {renameModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setRenameModal(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-800 mb-4">材料改名</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">当前名称</label>
                <div className="text-sm text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">{renameModal.currentName}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">新名称 <span className="text-red-500">*</span></label>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="input"
                  placeholder="请输入新名称"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">改名原因</label>
                <textarea
                  value={renameReason}
                  onChange={e => setRenameReason(e.target.value)}
                  className="input min-h-[72px]"
                  placeholder="例如：统一命名规范 / 纠正拼写 / 交接临时标记..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setRenameModal(null)} className="btn-secondary">取消</button>
              <button onClick={confirmRename} className="btn-primary">确认改名（记录历史）</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
