import { useState } from 'react';
import type { HandoverNote, Material, FittingResult } from '../types';

interface Props {
  note: HandoverNote;
  materials: Material[];
  fittingResults: Record<string, FittingResult>;
  onStatusChange: (materialId: string, status: Material['status']) => void;
}

const STATUS_LABEL: Record<Material['status'], string> = {
  pending: '待处理',
  processed: '已处理',
  missing: '缺材料',
  reviewed: '已复核',
};

export default function HandoverPanel({ note, materials, fittingResults, onStatusChange }: Props) {
  const [activeTab, setActiveTab] = useState<'status' | 'location' | 'anomaly' | 'export'>('status');

  const byStatus: Record<Material['status'], Material[]> = {
    pending: materials.filter(m => m.status === 'pending'),
    processed: materials.filter(m => m.status === 'processed'),
    missing: materials.filter(m => m.status === 'missing'),
    reviewed: materials.filter(m => m.status === 'reviewed'),
  };

  const needAttention = materials.filter(m => {
    const r = fittingResults[m.id];
    return m.status !== 'reviewed' || r?.boundaryWarning || r?.unstableSort?.unstable;
  });

  const tabs: { key: typeof activeTab; label: string; icon: string; hint?: string }[] = [
    { key: 'status', label: '处理状态总览', icon: '📋', hint: `${needAttention.length}项待跟进` },
    { key: 'location', label: '材料存放位置', icon: '📁' },
    { key: 'anomaly', label: '异常查看指引', icon: '⚠️' },
    { key: 'export', label: '重新导出操作', icon: '📤' },
  ];

  return (
    <div className="space-y-4">
      <div className="card border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50">
        <div className="card-body">
          <div className="flex items-start gap-4">
            <div className="text-5xl">🤝</div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-800 mb-1">交接欢迎面板</h2>
              <p className="text-sm text-slate-600 mb-3">
                欢迎接手「曲线拟合边界复核」工作！以下内容帮你快速上手，<strong className="text-orange-600">不用一个个去问老叶</strong>。
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(STATUS_LABEL).map(([k, label]) => {
                  const count = byStatus[k as Material['status']].length;
                  const colorCls = k === 'reviewed' ? 'bg-green-100 text-green-700'
                    : k === 'missing' ? 'bg-red-100 text-red-700'
                    : k === 'processed' ? 'bg-blue-100 text-blue-700'
                    : 'bg-amber-100 text-amber-700';
                  return (
                    <div key={k} className={`rounded-lg p-3 ${colorCls}`}>
                      <div className="text-2xl font-bold">{count}</div>
                      <div className="text-xs mt-0.5">{label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-slate-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === t.key
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="mr-1.5">{t.icon}</span>
            {t.label}
            {t.hint && <span className="ml-2 tag tag-yellow">{t.hint}</span>}
          </button>
        ))}
      </div>

      {activeTab === 'status' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {(['missing', 'pending', 'processed', 'reviewed'] as const).map(status => (
              <div key={status} className="card">
                <div className="card-header">
                  <h3 className="font-semibold text-slate-800">{STATUS_LABEL[status]} ({byStatus[status].length})</h3>
                </div>
                <div className="card-body space-y-2 max-h-[320px] overflow-auto">
                  {byStatus[status].length === 0 && (
                    <div className="text-sm text-slate-400 text-center py-6">无</div>
                  )}
                  {byStatus[status].map(m => {
                    const r = fittingResults[m.id];
                    const issue = r?.boundaryWarning || r?.unstableSort?.unstable;
                    return (
                      <div key={m.id} className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-slate-800 truncate">{m.currentName}</div>
                            <div className="text-xs text-slate-400">{m.id} · {m.unit} · {m.dataPoints.length}点</div>
                          </div>
                          {issue && <span className="tag tag-red flex-shrink-0">⚠️</span>}
                        </div>
                        {r && (
                          <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-2">
                            <span>R²: <strong className={r.rSquared >= 0.999 ? 'text-green-600' : 'text-amber-600'}>{r.rSquared.toFixed(4)}</strong></span>
                            <span>边界: <strong className={r.boundaryWarning ? 'text-red-600' : 'text-green-600'}>{r.boundarySampleCount}份</strong></span>
                          </div>
                        )}
                        {status !== 'reviewed' && (
                          <button
                            onClick={() => onStatusChange(m.id, 'reviewed')}
                            className="mt-2 text-xs px-2.5 py-1 rounded bg-green-100 hover:bg-green-200 text-green-700"
                          >
                            ✓ 标记已复核
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-slate-800">📝 老叶留言</h3>
            </div>
            <div className="card-body">
              <div className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                {note.remarks}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'location' && (
        <div className="card">
          <div className="card-body">
            <div className="whitespace-pre-wrap text-sm text-slate-700 leading-7">
              {note.materialLocation}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'anomaly' && (
        <div className="card">
          <div className="card-body">
            <div className="whitespace-pre-wrap text-sm text-slate-700 leading-7">
              {note.anomalyLocation}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'export' && (
        <div className="card">
          <div className="card-body">
            <div className="whitespace-pre-wrap text-sm text-slate-700 leading-7">
              {note.reexportGuide}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
