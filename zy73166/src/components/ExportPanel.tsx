import { useState } from 'react';
import type { ExportRecord } from '../types';
import { computeDataHash } from '../utils/fitting';

interface Snapshot {
  materialCount: number;
  totalPoints: number;
  rSquaredValues: Record<string, number>;
  boundaryWarnings: string[];
}

interface Props {
  exports: ExportRecord[];
  screenSnapshot: Snapshot;
  currentHash: string;
}

export default function ExportPanel({ exports, screenSnapshot, currentHash }: Props) {
  const [verifyTarget, setVerifyTarget] = useState<ExportRecord | null>(null);

  const verify = (exp: ExportRecord) => {
    const liveHash = currentHash;
    const matched = exp.dataHash === liveHash;
    const snapshotMatch = JSON.stringify(exp.onScreenSnapshot) === JSON.stringify(screenSnapshot);
    return { hashMatched: matched, snapshotMatched: snapshotMatch, liveHash };
  };

  const recent = exports.slice(0, 3);

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="font-semibold text-slate-800">📤 导出记录 & 一致性校验</h2>
          <p className="text-xs text-slate-500 mt-0.5">导出文件自动绑定屏幕数字快照，可随时校验是否分家</p>
        </div>
      </div>

      <div className="card-body space-y-4">
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <div className="text-xs text-slate-500 mb-2 flex items-center gap-2">
            <span>🔒 当前屏幕数据快照哈希</span>
            <code className="px-2 py-0.5 bg-white rounded text-primary-600 font-mono text-xs border border-slate-300">{currentHash}</code>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-white p-2 rounded border border-slate-200">
              <div className="text-slate-500">材料数</div>
              <div className="font-bold text-base text-slate-800 mt-0.5">{screenSnapshot.materialCount}</div>
            </div>
            <div className="bg-white p-2 rounded border border-slate-200">
              <div className="text-slate-500">总数据点</div>
              <div className="font-bold text-base text-slate-800 mt-0.5">{screenSnapshot.totalPoints}</div>
            </div>
            <div className="bg-white p-2 rounded border border-slate-200">
              <div className="text-slate-500">边界警告</div>
              <div className={`font-bold text-base mt-0.5 ${screenSnapshot.boundaryWarnings.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {screenSnapshot.boundaryWarnings.length} 条
              </div>
            </div>
          </div>
          {screenSnapshot.boundaryWarnings.length > 0 && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
              {screenSnapshot.boundaryWarnings.join('；')}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-700 mb-2">最近导出 ({recent.length})</h3>
          <div className="space-y-2">
            {recent.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
                暂无导出记录 · 点击右上角"导出报告"按钮开始
              </div>
            )}
            {recent.map(exp => {
              const v = verify(exp);
              return (
                <div key={exp.id} className="p-3 rounded-lg border border-slate-200 bg-white hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-medium text-primary-600 truncate">{exp.fileName}</span>
                        {v.hashMatched
                          ? <span className="tag tag-green">✓ 与当前屏幕一致</span>
                          : <span className="tag tag-red">✗ 屏幕数字已变更</span>}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {new Date(exp.timestamp).toLocaleString('zh-CN')} · {exp.operator}
                      </div>
                    </div>
                    <button
                      onClick={() => setVerifyTarget(verifyTarget?.id === exp.id ? null : exp)}
                      className="text-xs px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                    >
                      {verifyTarget?.id === exp.id ? '收起详情' : '🔍 校验详情'}
                    </button>
                  </div>

                  {verifyTarget?.id === exp.id && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-slate-500 mb-1">导出时哈希</div>
                          <code className="block px-2 py-1 bg-white rounded border font-mono">{exp.dataHash}</code>
                        </div>
                        <div>
                          <div className="text-slate-500 mb-1">当前屏幕哈希</div>
                          <code className="block px-2 py-1 bg-white rounded border font-mono">{v.liveHash}</code>
                        </div>
                      </div>
                      <div className={`p-2 rounded ${v.hashMatched ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                        {v.hashMatched
                          ? '✅ 导出数据与当前屏幕完全一致，数字没有分家。'
                          : '⚠️ 当前屏幕上的数据（材料筛选、参数设置）与导出时不同。如需重导，请确认筛选口径是否一致。'}
                      </div>
                      <div>
                        <div className="text-slate-500 mb-1">材料数/数据点</div>
                        <div className="bg-white rounded border p-2 space-y-0.5">
                          <div>材料：{exp.onScreenSnapshot.materialCount} → 当前 {screenSnapshot.materialCount}</div>
                          <div>数据点：{exp.onScreenSnapshot.totalPoints} → 当前 {screenSnapshot.totalPoints}</div>
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 mb-1">各材料 R² 对比</div>
                        <div className="bg-white rounded border p-2 space-y-1 max-h-32 overflow-auto">
                          {Object.entries(exp.onScreenSnapshot.rSquaredValues).map(([id, oldR2]) => {
                            const curR2 = screenSnapshot.rSquaredValues[id];
                            const diff = curR2 !== undefined ? Math.abs(curR2 - oldR2) : null;
                            return (
                              <div key={id} className="flex items-center gap-2 text-xs">
                                <span className="font-mono w-16">{id}</span>
                                <span className="font-mono">{oldR2.toFixed(6)}</span>
                                <span className="text-slate-400">→</span>
                                <span className="font-mono">{curR2?.toFixed(6) ?? '—'}</span>
                                {diff !== null && diff > 1e-6 && (
                                  <span className={`tag ${diff > 0.001 ? 'tag-red' : 'tag-yellow'}`}>
                                    {diff > 0 ? '+' : ''}{diff.toFixed(6)}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-xs text-slate-400 pt-3 border-t border-slate-100">
          💡 导出文件的第 1 个 Sheet 附带"数据校验"页，包含哈希值，在 Excel 中打开即可核对。
        </div>
      </div>
    </div>
  );
}
