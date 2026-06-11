import { useState } from 'react';
import { CheckCircle, Clock, AlertTriangle, XCircle, Calendar, Download, Filter } from 'lucide-react';
import type { MaterialChange } from '../types';
import StatusBadge from './StatusBadge';

interface ReviewProps {
  materialChanges: MaterialChange[];
}

type FilterStatus = 'all' | 'confirmed' | 'pending' | 'supplement' | 'returned';

export default function Review({ materialChanges }: ReviewProps) {
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const validChanges = materialChanges.filter((m) => !m.isBadData);

  const filtered = validChanges.filter((item) => {
    if (filter === 'all') return true;
    return item.status === filter;
  });

  const stats = {
    total: validChanges.length,
    confirmed: validChanges.filter((m) => m.status === 'confirmed').length,
    pending: validChanges.filter((m) => m.status === 'pending').length,
    supplement: validChanges.filter((m) => m.status === 'supplement').length,
    returned: validChanges.filter((m) => m.status === 'returned').length,
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((m) => m.id)));
    }
  };

  const categories = [
    { key: 'confirmed', label: '已确认', icon: CheckCircle, color: 'green', count: stats.confirmed },
    { key: 'pending', label: '待确认', icon: Clock, color: 'amber', count: stats.pending },
    { key: 'supplement', label: '待补件', icon: AlertTriangle, color: 'blue', count: stats.supplement },
    { key: 'returned', label: '已退回', icon: XCircle, color: 'red', count: stats.returned },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <Calendar className="text-blue-600" size={24} />
            月底复核
          </h2>
          <p className="text-sm text-slate-500 mt-1">对本月施工变更材料进行分类复核</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {}}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Filter size={16} />
            筛选
          </button>
          <button
            onClick={() => {}}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download size={16} />
            导出复核表
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = filter === cat.key;
          const colorClasses: Record<string, string> = {
            green: 'border-green-200 bg-green-50',
            amber: 'border-amber-200 bg-amber-50',
            blue: 'border-blue-200 bg-blue-50',
            red: 'border-red-200 bg-red-50',
          };
          const iconColors: Record<string, string> = {
            green: 'text-green-600',
            amber: 'text-amber-600',
            blue: 'text-blue-600',
            red: 'text-red-600',
          };

          return (
            <button
              key={cat.key}
              onClick={() => setFilter(isActive ? 'all' : (cat.key as FilterStatus))}
              className={`p-4 rounded-xl border-2 transition-all text-left ${
                isActive
                  ? colorClasses[cat.color]
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  isActive ? iconColors[cat.color] : 'text-slate-400'
                }`}>
                  <Icon size={20} />
                </div>
                <span className={`text-3xl font-bold ${
                  isActive ? iconColors[cat.color] : 'text-slate-800'
                }`}>
                  {cat.count}
                </span>
              </div>
              <p className={`mt-3 text-sm font-medium ${
                isActive ? iconColors[cat.color] : 'text-slate-700'
              }`}>
                {cat.label}
              </p>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedIds.size === filtered.length && filtered.length > 0}
              onChange={selectAll}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-600">
              已选 {selectedIds.size} / {filtered.length} 项
            </span>
            {filter !== 'all' && (
              <span className="text-xs text-slate-400">
                （仅显示{categories.find(c => c.key === filter)?.label}）
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`text-xs px-2.5 py-1 rounded-md ${
                filter === 'all'
                  ? 'bg-slate-100 text-slate-700'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              全部 ({stats.total})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="w-12 px-4 py-3 text-left"></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                  变更名称
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                  状态
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                  材料项
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                  负责人
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                  更新时间
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                  摘要
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className={`hover:bg-slate-50 transition-colors ${
                    selectedIds.has(item.id) ? 'bg-blue-50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-800">{item.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {item.materials.length} 项
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{item.author}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {new Date(item.updatedAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 max-w-xs truncate">
                    {item.pageSummary}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="p-12 text-center text-slate-400">
            <Calendar size={40} className="mx-auto mb-3 opacity-50" />
            <p>暂无符合条件的记录</p>
          </div>
        )}
      </div>
    </div>
  );
}
