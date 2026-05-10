import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';

export function HistoryPage() {
  const { data, exportData, canExport, clearAllData } = useApp();
  const [searchText, setSearchText] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'tasks' | 'lostItems' | 'equipment'>('overview');

  const stats = useMemo(() => {
    const totalTasks = data.cleaningTasks.length;
    const completedTasks = data.cleaningTasks.filter(t =>
      t.status === 'completed' || t.status === 'overdue'
    ).length;
    const avgScore = data.cleaningTasks.length > 0
      ? data.cleaningTasks
          .filter(t => t.qualityScore !== undefined)
          .reduce((sum, t) => sum + (t.qualityScore || 0), 0) /
        data.cleaningTasks.filter(t => t.qualityScore !== undefined).length
      : 0;

    const halls = new Set(data.screenings.map(s => s.hallNumber));
    const totalAudience = data.screenings.reduce((sum, s) => sum + s.audienceCount, 0);

    const lostItemsByStatus = {
      held: data.lostItems.filter(l => l.status === 'held').length,
      claimed: data.lostItems.filter(l => l.status === 'claimed').length,
      disposed: data.lostItems.filter(l => l.status === 'disposed').length,
    };

    const equipmentByStatus = {
      reported: data.equipmentIssues.filter(e => e.status === 'reported').length,
      in_progress: data.equipmentIssues.filter(e => e.status === 'in_progress').length,
      escalated: data.equipmentIssues.filter(e => e.status === 'escalated').length,
      resolved: data.equipmentIssues.filter(e => e.status === 'resolved').length,
    };

    return {
      totalTasks,
      completedTasks,
      avgScore: avgScore.toFixed(1),
      hallsCount: halls.size,
      totalAudience,
      lostItemsByStatus,
      equipmentByStatus,
    };
  }, [data]);

  const filteredTasks = useMemo(() => {
    if (!searchText) return data.cleaningTasks;
    const q = searchText.toLowerCase();
    return data.cleaningTasks.filter(t =>
      t.hallNumber.toLowerCase().includes(q) ||
      t.movieName.toLowerCase().includes(q) ||
      (t.assignedTo && t.assignedTo.toLowerCase().includes(q)) ||
      (t.notes && t.notes.toLowerCase().includes(q))
    );
  }, [data.cleaningTasks, searchText]);

  const filteredLostItems = useMemo(() => {
    if (!searchText) return data.lostItems;
    const q = searchText.toLowerCase();
    return data.lostItems.filter(l =>
      l.hallNumber.toLowerCase().includes(q) ||
      l.itemName.toLowerCase().includes(q) ||
      l.description.toLowerCase().includes(q) ||
      l.foundBy.toLowerCase().includes(q) ||
      (l.claimant && l.claimant.toLowerCase().includes(q))
    );
  }, [data.lostItems, searchText]);

  const filteredEquipment = useMemo(() => {
    if (!searchText) return data.equipmentIssues;
    const q = searchText.toLowerCase();
    return data.equipmentIssues.filter(e =>
      e.hallNumber.toLowerCase().includes(q) ||
      e.equipmentType.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.reportedBy.toLowerCase().includes(q)
    );
  }, [data.equipmentIssues, searchText]);

  const handleClear = () => {
    if (confirm('确定清空所有数据？此操作不可恢复。')) {
      clearAllData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          {[
            { key: 'overview', label: '统计概览' },
            { key: 'tasks', label: '任务明细' },
            { key: 'lostItems', label: '遗失物明细' },
            { key: 'equipment', label: '设备明细' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveSubTab(t.key as any)}
              className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                activeSubTab === t.key
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-3">
          <input
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="搜索影厅、影片、物品..."
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <button
            onClick={exportData}
            disabled={!canExport}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              canExport
                ? 'bg-cyan-500 hover:bg-cyan-600 text-white'
                : 'bg-slate-200 text-slate-500 cursor-not-allowed'
            }`}
          >
            导出 Excel
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
          >
            清空数据
          </button>
        </div>
      </div>

      {activeSubTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">业务统计</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">覆盖影厅数</span>
                <span className="font-semibold text-slate-800">{stats.hallsCount} 个</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">总观众数</span>
                <span className="font-semibold text-slate-800">{stats.totalAudience} 人</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">总清洁任务</span>
                <span className="font-semibold text-slate-800">{stats.totalTasks} 次</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">已完成任务</span>
                <span className="font-semibold text-green-600">{stats.completedTasks} 次</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">平均清洁评分</span>
                <span className="font-semibold text-cyan-600">{stats.avgScore} / 10</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">遗失物统计</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">总遗失物数</span>
                <span className="font-semibold text-slate-800">{data.lostItems.length} 件</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-yellow-600">待认领</span>
                <span className="font-semibold text-yellow-600">{stats.lostItemsByStatus.held} 件</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-green-600">已认领</span>
                <span className="font-semibold text-green-600">{stats.lostItemsByStatus.claimed} 件</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">已处理</span>
                <span className="font-semibold text-slate-600">{stats.lostItemsByStatus.disposed} 件</span>
              </div>
              {data.lostItems.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex h-3 rounded-full overflow-hidden">
                    <div
                      className="bg-yellow-400"
                      style={{ width: `${(stats.lostItemsByStatus.held / data.lostItems.length) * 100}%` }}
                    />
                    <div
                      className="bg-green-400"
                      style={{ width: `${(stats.lostItemsByStatus.claimed / data.lostItems.length) * 100}%` }}
                    />
                    <div
                      className="bg-slate-300"
                      style={{ width: `${(stats.lostItemsByStatus.disposed / data.lostItems.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">设备异常统计</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">总异常数</span>
                <span className="font-semibold text-slate-800">{data.equipmentIssues.length} 项</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-yellow-600">已上报</span>
                <span className="font-semibold text-yellow-600">{stats.equipmentByStatus.reported} 项</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-cyan-600">处理中</span>
                <span className="font-semibold text-cyan-600">{stats.equipmentByStatus.in_progress} 项</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-red-600">已升级</span>
                <span className="font-semibold text-red-600">{stats.equipmentByStatus.escalated} 项</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-green-600">已解决</span>
                <span className="font-semibold text-green-600">{stats.equipmentByStatus.resolved} 项</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'tasks' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">影厅</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">影片</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">责任人</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">散场</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">耗时</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">评分</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map(t => {
                  let duration = '-';
                  if (t.startTime && t.endTime) {
                    const start = new Date(t.startTime.replace(' ', 'T'));
                    const end = new Date(t.endTime.replace(' ', 'T'));
                    const mins = Math.round((end.getTime() - start.getTime()) / 60000);
                    duration = `${mins} 分钟`;
                  }
                  return (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-700">{t.hallNumber}厅</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{t.movieName}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          t.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          t.status === 'in_progress' ? 'bg-cyan-100 text-cyan-700' :
                          t.status === 'completed' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {{
                            pending: '待开始',
                            in_progress: '进行中',
                            completed: '已完成',
                            overdue: '超时',
                          }[t.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{t.assignedTo || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{t.screeningEndTime}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{duration}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {t.qualityScore !== undefined ? `${t.qualityScore}/10` : '-'}
                      </td>
                    </tr>
                  );
                })}
                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      暂无数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'lostItems' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">物品</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">影厅</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">描述</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">发现人</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">发现时间</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">认领人</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLostItems.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{l.itemName}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{l.hallNumber}厅</td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">{l.description || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{l.foundBy}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{l.foundTime}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        l.status === 'held' ? 'bg-yellow-100 text-yellow-700' :
                        l.status === 'claimed' ? 'bg-green-100 text-green-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {{ held: '待认领', claimed: '已认领', disposed: '已处理' }[l.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{l.claimant || '-'}</td>
                  </tr>
                ))}
                {filteredLostItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      暂无数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'equipment' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">设备</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">影厅</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">问题描述</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">优先级</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">上报人</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">上报时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEquipment.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{e.equipmentType}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{e.hallNumber}厅</td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">{e.description}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        e.priority === 'low' ? 'bg-slate-100 text-slate-600' :
                        e.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        e.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {{ low: '低', medium: '中', high: '高', critical: '紧急' }[e.priority]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        e.status === 'reported' ? 'bg-yellow-100 text-yellow-700' :
                        e.status === 'in_progress' ? 'bg-cyan-100 text-cyan-700' :
                        e.status === 'resolved' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {{ reported: '已上报', in_progress: '处理中', resolved: '已解决', escalated: '已升级' }[e.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{e.reportedBy}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{e.reportedTime}</td>
                  </tr>
                ))}
                {filteredEquipment.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      暂无数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
