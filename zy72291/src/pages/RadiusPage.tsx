import React, { useState } from 'react';
import { Plus, Database, RefreshCw, CheckCircle, XCircle, Info, Filter } from 'lucide-react';
import { useWindStore } from '../store/useWindStore';
import { WindRoseChart } from '../components/WindRoseChart';
import { formatDateTime, directionToLabel } from '../utils/windUtils';
import type { SafetyRadius, RadiusVersion, WindSpeed } from '../../shared/types';
import { WIND_SPEED_LABELS } from '../../shared/types';

export const RadiusPage: React.FC = () => {
  const { radiusTable, addRadiusEntry, generateReport, currentRole } = useWindStore();
  const [versionFilter, setVersionFilter] = useState<RadiusVersion | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEntry, setNewEntry] = useState<Partial<SafetyRadius>>({
    windDirection: 0,
    windSpeed: 'medium',
    radius: 200,
    version: 'new',
    source: '人工补录',
    effectiveDate: new Date().toISOString().split('T')[0],
  });

  const filteredTable = versionFilter === 'all' 
    ? radiusTable 
    : radiusTable.filter(r => r.version === versionFilter);

  const groupedByDirection = [0, 45, 90, 135, 180, 225, 270, 315].map(dir => ({
    direction: dir,
    label: directionToLabel(dir),
    new: radiusTable.find(r => r.windDirection === dir && r.windSpeed === 'medium' && r.version === 'new'),
    legacy: radiusTable.find(r => r.windDirection === dir && r.windSpeed === 'medium' && r.version === 'legacy'),
  }));

  const handleAddEntry = () => {
    if (newEntry.windDirection !== undefined && newEntry.windSpeed && newEntry.radius !== undefined) {
      const entry: SafetyRadius = {
        id: `R-${Date.now().toString(36).toUpperCase()}`,
        windDirection: newEntry.windDirection,
        windSpeed: newEntry.windSpeed as WindSpeed,
        radius: newEntry.radius,
        version: newEntry.version as RadiusVersion,
        effectiveDate: newEntry.effectiveDate || new Date().toISOString().split('T')[0],
        source: newEntry.source || '人工补录',
      };
      addRadiusEntry(entry);
      generateReport();
      setShowAddModal(false);
    }
  };

  const getDiffClass = (newVal?: number, legacyVal?: number) => {
    if (!newVal || !legacyVal) return '';
    const diff = newVal - legacyVal;
    if (diff > 0) return 'text-emerald-600';
    if (diff < 0) return 'text-red-600';
    return 'text-industrial-500';
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-industrial-800 font-mono">安全半径表</h2>
          <p className="text-sm text-industrial-500 mt-1">管理滑翔伞起降区各风向安全半径标准，支持新旧口径对比和补录</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 bg-white border border-industrial-200 rounded px-3 py-2">
            <Filter size={16} className="text-industrial-400" />
            <select
              value={versionFilter}
              onChange={(e) => setVersionFilter(e.target.value as RadiusVersion | 'all')}
              className="text-sm bg-transparent focus:outline-none text-industrial-700"
            >
              <option value="all">全部口径</option>
              <option value="new">2024新口径</option>
              <option value="legacy">2023旧口径</option>
            </select>
          </div>
          {currentRole === 'engineer' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <Plus size={16} />
              补录数据
            </button>
          )}
        </div>
      </div>

      {/* 说明卡片 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-800 mb-1">安全半径表说明（许工和施工经理交接用）</p>
            <p className="text-blue-700">
              2024新口径（GB 2024）比2023旧口径（GB 2023）平均增加20%安全裕度。
              <strong>LOG-003是从2023旧口径补录的历史数据</strong>，计算时会标注口径差异。
              补录新数据后，安全距离报告会自动更新。
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧 - 风向玫瑰图 */}
        <div className="lg:col-span-1">
          <div className="card-industrial rounded-lg overflow-hidden">
            <div className="p-4 border-b border-industrial-200">
              <h3 className="font-semibold text-industrial-800 flex items-center gap-2">
                <Database size={18} />
                安全半径风向图
              </h3>
              <p className="text-xs text-industrial-500 mt-1">中速风(6-12m/s)工况下对比</p>
            </div>
            <div className="p-2">
              <WindRoseChart radiusTable={radiusTable} height={320} />
            </div>
          </div>
        </div>

        {/* 右侧 - 新旧口径对比表 */}
        <div className="lg:col-span-2">
          <div className="card-industrial rounded-lg overflow-hidden">
            <div className="p-4 border-b border-industrial-200 flex items-center justify-between">
              <h3 className="font-semibold text-industrial-800">新旧口径对比（中速风）</h3>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-industrial-800 rounded"></span>
                  2024新口径
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-blue-500 rounded"></span>
                  2023旧口径
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">风向</th>
                    <th className="table-header text-center">2024新口径 (米)</th>
                    <th className="table-header text-center">2023旧口径 (米)</th>
                    <th className="table-header text-center">差异</th>
                    <th className="table-header">来源</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedByDirection.map((item) => (
                    <tr key={item.direction} className="hover:bg-industrial-50 transition-colors">
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-industrial-400 text-xs">{item.direction}°</span>
                          <span className="font-medium text-industrial-800">{item.label}</span>
                        </div>
                      </td>
                      <td className="table-cell text-center font-mono text-lg font-semibold text-industrial-800">
                        {item.new?.radius || '-'}
                      </td>
                      <td className="table-cell text-center font-mono text-lg text-blue-600">
                        {item.legacy?.radius || '-'}
                      </td>
                      <td className="table-cell text-center">
                        {item.new?.radius && item.legacy?.radius && (
                          <span className={`font-mono font-medium ${getDiffClass(item.new.radius, item.legacy.radius)}`}>
                            {item.new.radius - item.legacy.radius > 0 ? '+' : ''}
                            {item.new.radius - item.legacy.radius} m
                          </span>
                        )}
                      </td>
                      <td className="table-cell text-xs text-industrial-500">
                        {item.new?.source || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 完整数据表 */}
          <div className="card-industrial rounded-lg overflow-hidden mt-6">
            <div className="p-4 border-b border-industrial-200 flex items-center justify-between">
              <h3 className="font-semibold text-industrial-800">完整数据表</h3>
              <span className="text-xs text-industrial-500">
                共 {filteredTable.length} 条记录
              </span>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-white">
                  <tr>
                    <th className="table-header">ID</th>
                    <th className="table-header">风向</th>
                    <th className="table-header">风速</th>
                    <th className="table-header">半径 (米)</th>
                    <th className="table-header">版本</th>
                    <th className="table-header">生效日期</th>
                    <th className="table-header">来源</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTable.map((row) => (
                    <tr key={row.id} className="hover:bg-industrial-50 transition-colors">
                      <td className="table-cell font-mono text-xs text-industrial-500">{row.id}</td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-industrial-400">{row.windDirection}°</span>
                          <span className="text-sm text-industrial-700">{directionToLabel(row.windDirection)}</span>
                        </div>
                      </td>
                      <td className="table-cell text-sm">{WIND_SPEED_LABELS[row.windSpeed]}</td>
                      <td className="table-cell font-mono text-sm font-medium text-industrial-800">{row.radius}</td>
                      <td className="table-cell">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          row.version === 'new' 
                            ? 'bg-industrial-100 text-industrial-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {row.version === 'new' ? '2024新口径' : '2023旧口径'}
                        </span>
                      </td>
                      <td className="table-cell text-sm text-industrial-600">{row.effectiveDate}</td>
                      <td className="table-cell text-xs text-industrial-500">{row.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 补录弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-4 border-b border-industrial-200 flex items-center justify-between">
              <h3 className="font-semibold text-industrial-800 flex items-center gap-2">
                <Plus size={18} className="text-industrial-600" />
                补录安全半径数据
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-industrial-100 rounded transition-colors"
              >
                <XCircle size={20} className="text-industrial-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-industrial-700 mb-1">风向 (度)</label>
                  <select
                    value={newEntry.windDirection}
                    onChange={(e) => setNewEntry({ ...newEntry, windDirection: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-industrial-300 rounded text-sm focus:outline-none focus:border-safety-orange"
                  >
                    {[0, 45, 90, 135, 180, 225, 270, 315].map(d => (
                      <option key={d} value={d}>{d}° - {directionToLabel(d)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-industrial-700 mb-1">风速等级</label>
                  <select
                    value={newEntry.windSpeed}
                    onChange={(e) => setNewEntry({ ...newEntry, windSpeed: e.target.value as WindSpeed })}
                    className="w-full px-3 py-2 border border-industrial-300 rounded text-sm focus:outline-none focus:border-safety-orange"
                  >
                    <option value="low">低速 ({'<'}6m/s)</option>
                    <option value="medium">中速 (6-12m/s)</option>
                    <option value="high">高速 ({'>'}12m/s)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-industrial-700 mb-1">安全半径 (米)</label>
                <input
                  type="number"
                  value={newEntry.radius}
                  onChange={(e) => setNewEntry({ ...newEntry, radius: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-industrial-300 rounded text-sm focus:outline-none focus:border-safety-orange font-mono"
                  placeholder="请输入安全半径"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-industrial-700 mb-1">口径版本</label>
                <select
                  value={newEntry.version}
                  onChange={(e) => setNewEntry({ ...newEntry, version: e.target.value as RadiusVersion })}
                  className="w-full px-3 py-2 border border-industrial-300 rounded text-sm focus:outline-none focus:border-safety-orange"
                >
                  <option value="new">2024新口径 (GB 2024)</option>
                  <option value="legacy">2023旧口径 (GB 2023)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-industrial-700 mb-1">数据来源</label>
                <input
                  type="text"
                  value={newEntry.source}
                  onChange={(e) => setNewEntry({ ...newEntry, source: e.target.value })}
                  className="w-full px-3 py-2 border border-industrial-300 rounded text-sm focus:outline-none focus:border-safety-orange"
                  placeholder="数据来源说明"
                />
              </div>
            </div>
            <div className="p-4 border-t border-industrial-200 flex justify-end gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="btn-industrial text-sm"
              >
                取消
              </button>
              <button
                onClick={handleAddEntry}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <CheckCircle size={14} />
                确认补录
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
