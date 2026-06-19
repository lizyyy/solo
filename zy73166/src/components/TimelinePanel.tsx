import { useState } from 'react';
import type { TimelineEvent, ExportRecord, FilterCriteria } from '../types';

interface Props {
  events: TimelineEvent[];
  exports: ExportRecord[];
}

const TYPE_STYLES: Record<TimelineEvent['type'], { color: string; icon: string; label: string }> = {
  import: { color: 'bg-blue-500', icon: '📥', label: '导入' },
  filter: { color: 'bg-purple-500', icon: '🔍', label: '筛选' },
  fit: { color: 'bg-primary-500', icon: '📈', label: '拟合' },
  review: { color: 'bg-green-500', icon: '✅', label: '复核' },
  export: { color: 'bg-emerald-500', icon: '📤', label: '导出' },
  handover: { color: 'bg-orange-500', icon: '🤝', label: '交接' },
  rename: { color: 'bg-amber-500', icon: '✏️', label: '改名' },
  status_change: { color: 'bg-pink-500', icon: '🔄', label: '状态变更' },
};

export default function TimelinePanel({ events, exports }: Props) {
  const [filter, setFilter] = useState<'all' | TimelineEvent['type']>('all');
  const [view, setView] = useState<'events' | 'filters' | 'exports'>('events');

  const filtered = filter === 'all' ? events : events.filter(e => e.type === filter);

  const exportEvents = events.filter(e => e.type === 'export');
  const filterEvents = events.filter(e => e.type === 'filter');

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <div>
            <h2 className="font-semibold text-slate-800">历史时间线</h2>
            <p className="text-xs text-slate-500 mt-0.5">所有操作留痕，筛选口径和导出均有快照</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-slate-100 rounded-lg p-1">
              {(['events', 'filters', 'exports'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    view === v ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {v === 'events' ? '全部事件' : v === 'filters' ? '筛选口径快照' : '导出记录'}
                  <span className="ml-1 text-slate-400">
                    ({v === 'events' ? events.length : v === 'filters' ? filterEvents.length : exportEvents.length})
                  </span>
                </button>
              ))}
            </div>
            {view === 'events' && (
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                className="text-xs px-2 py-1.5 border border-slate-300 rounded-lg bg-white"
              >
                <option value="all">全部类型</option>
                {Object.entries(TYPE_STYLES).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="card-body">
          {view === 'events' && (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
              <div className="space-y-4">
                {filtered.map(e => {
                  const style = TYPE_STYLES[e.type];
                  return (
                    <div key={e.id} className="relative pl-10">
                      <div className={`absolute left-0 top-1 w-8 h-8 rounded-full ${style.color} flex items-center justify-center text-white text-sm shadow-md`}>
                        {style.icon}
                      </div>
                      <div className="card p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className={`tag ${e.type === 'review' || e.type === 'export' ? 'tag-green' : e.type === 'status_change' && e.description.includes('缺') ? 'tag-red' : 'tag-blue'}`}>
                              {style.label}
                            </span>
                            <span className="font-medium text-slate-800 text-sm">{e.description}</span>
                          </div>
                          <span className="text-xs text-slate-400 whitespace-nowrap">
                            {new Date(e.timestamp).toLocaleString('zh-CN')}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mb-2">操作人: <strong className="text-slate-600">{e.operator}</strong></div>

                        {e.filterSnapshot && (
                          <details className="text-xs mt-2">
                            <summary className="cursor-pointer text-primary-600 hover:underline select-none">
                              📋 查看筛选口径快照
                            </summary>
                            <FilterSnapshotView f={e.filterSnapshot} />
                          </details>
                        )}

                        {e.detail && (
                          <details className="text-xs mt-2">
                            <summary className="cursor-pointer text-slate-500 hover:text-slate-700 select-none">
                              查看详情
                            </summary>
                            <pre className="mt-2 p-3 bg-slate-50 rounded-lg text-slate-600 overflow-x-auto border border-slate-200">
                              {JSON.stringify(e.detail, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="text-center py-12 text-slate-400">暂无事件</div>
                )}
              </div>
            </div>
          )}

          {view === 'filters' && (
            <div className="grid gap-3 md:grid-cols-2">
              {filterEvents.map(e => e.filterSnapshot && (
                <div key={e.id} className="border-2 border-purple-200 rounded-xl p-4 bg-purple-50/30">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-slate-800">{e.filterSnapshot.name}</h3>
                      <p className="text-xs text-slate-500">创建人: {e.filterSnapshot.createdBy}</p>
                    </div>
                    <span className="tag tag-purple" style={{ borderColor: '#c4b5fd', backgroundColor: '#ede9fe', color: '#6d28d9' }}>快照 #{e.filterSnapshot.id}</span>
                  </div>
                  <FilterSnapshotView f={e.filterSnapshot} />
                  <div className="mt-3 pt-3 border-t border-purple-200 text-xs text-slate-500">
                    创建时间: {new Date(e.filterSnapshot.createdAt).toLocaleString('zh-CN')}
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === 'exports' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-y border-slate-200">
                  <tr>
                    <th className="th">文件名</th>
                    <th className="th">导出时间</th>
                    <th className="th">操作人</th>
                    <th className="th">数据哈希</th>
                    <th className="th">关联筛选口径</th>
                    <th className="th">屏幕快照</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {exports.map(exp => (
                    <tr key={exp.id} className="hover:bg-slate-50">
                      <td className="td font-mono text-xs text-primary-600">{exp.fileName}</td>
                      <td className="td text-xs text-slate-500">{new Date(exp.timestamp).toLocaleString('zh-CN')}</td>
                      <td className="td">{exp.operator}</td>
                      <td className="td">
                        <code className="px-2 py-1 bg-slate-100 rounded text-xs font-mono">{exp.dataHash}</code>
                      </td>
                      <td className="td text-xs">
                        <span className="tag tag-blue">{exp.filterCriteriaId}</span>
                      </td>
                      <td className="td">
                        <details className="text-xs">
                          <summary className="cursor-pointer text-primary-600 hover:underline">查看快照</summary>
                          <div className="mt-2 p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
                            <div>材料数: <strong>{exp.onScreenSnapshot.materialCount}</strong></div>
                            <div>总数据点: <strong>{exp.onScreenSnapshot.totalPoints}</strong></div>
                            <div>R²值:
                              <ul className="mt-1 ml-4 space-y-0.5">
                                {Object.entries(exp.onScreenSnapshot.rSquaredValues).map(([k, v]) => (
                                  <li key={k} className="font-mono text-xs">{k}: {v.toFixed(6)}</li>
                                ))}
                              </ul>
                            </div>
                            {exp.onScreenSnapshot.boundaryWarnings.length > 0 && (
                              <div className="text-red-600">边界警告: {exp.onScreenSnapshot.boundaryWarnings.join('；')}</div>
                            )}
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))}
                  {exports.length === 0 && (
                    <tr>
                      <td colSpan={6} className="td text-center py-8 text-slate-400">暂无导出记录</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSnapshotView({ f }: { f: FilterCriteria }) {
  return (
    <div className="mt-2 p-3 bg-white rounded-lg border border-purple-200 space-y-2 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-50 px-2 py-1 rounded">
          <span className="text-slate-500">边界阈值：</span>
          <strong>{f.boundaryThreshold}</strong>
        </div>
        <div className="bg-slate-50 px-2 py-1 rounded">
          <span className="text-slate-500">边界最少量：</span>
          <strong>{f.boundarySampleMinCount}</strong>
        </div>
        <div className="bg-slate-50 px-2 py-1 rounded">
          <span className="text-slate-500">拟合度：</span>
          <strong>{f.fittingDegree === 1 ? '线性' : `${f.fittingDegree}次多项式`}</strong>
        </div>
        <div className="bg-slate-50 px-2 py-1 rounded">
          <span className="text-slate-500">排除离群：</span>
          <strong>{f.excludeOutliers ? '是' : '否'}</strong>
        </div>
      </div>
      <div>
        <span className="text-slate-500">包含材料 ({f.materialIds.length})：</span>
        <div className="mt-1 flex flex-wrap gap-1">
          {f.materialIds.map(id => (
            <span key={id} className="tag tag-gray">{id}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
