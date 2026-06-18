import { ArrowLeft, GitCompare, Settings, ChevronRight, Plus, Minus, Edit3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useReportStore } from '@/store/reportStore';
import { compareParams, compareRecords } from '@/utils/versionDiff';
import { mockVersions, getRecordsByVersion } from '@/data/mockData';
import { SourceBadge, SedimentLevelBadge } from '@/components/Badges';
import { formatDepth } from '@/utils/sediment';
import { formatLatLng } from '@/utils/coordinate';
import { useState } from 'react';

export default function ComparePage() {
  const navigate = useNavigate();
  const { compareVersionIds, setCompareVersionIds } = useReportStore();

  const [oldVersionId, newVersionId] = compareVersionIds;
  const [selectedOld, setSelectedOld] = useState(oldVersionId);
  const [selectedNew, setSelectedNew] = useState(newVersionId);

  const oldVersion = mockVersions.find((v) => v.id === selectedOld);
  const newVersion = mockVersions.find((v) => v.id === selectedNew);

  const paramDiffs =
    oldVersion && newVersion ? compareParams(oldVersion.params, newVersion.params) : [];
  const changedParamCount = paramDiffs.filter((d) => d.changed).length;

  const oldRecords = oldVersion ? getRecordsByVersion(selectedOld) : [];
  const newRecords = newVersion ? getRecordsByVersion(selectedNew) : [];
  const recordDiffs = compareRecords(oldRecords, newRecords);

  const handleSwap = () => {
    const tmp = selectedOld;
    setSelectedOld(selectedNew);
    setSelectedNew(tmp);
  };

  const applySelection = () => {
    setCompareVersionIds([selectedOld, selectedNew]);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-ocean-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-ocean-200 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
            返回汇总
          </button>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <GitCompare size={20} />
            版本对比
          </h1>
          <div className="w-20"></div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">旧版本</label>
              <select
                value={selectedOld}
                onChange={(e) => setSelectedOld(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
              >
                {mockVersions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSwap}
              className="p-2 mt-6 text-gray-500 hover:text-ocean-600 hover:bg-ocean-50 rounded transition-colors"
              title="交换版本"
            >
              <GitCompare size={20} />
            </button>

            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">新版本</label>
              <select
                value={selectedNew}
                onChange={(e) => setSelectedNew(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
              >
                {mockVersions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={applySelection}
              className="mt-6 px-4 py-2 bg-ocean-600 text-white text-sm rounded hover:bg-ocean-700 transition-colors"
            >
              应用对比
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Settings size={16} className="text-ocean-600" />
                参数差异
                {changedParamCount > 0 && (
                  <span className="text-xs bg-warning-100 text-warning-700 px-2 py-0.5 rounded-full">
                    {changedParamCount} 处变更
                  </span>
                )}
              </h3>
            </div>

            <div className="divide-y divide-gray-100">
              {paramDiffs.map((diff) => (
                <div
                  key={diff.key}
                  className={`px-4 py-3 ${diff.changed ? 'bg-warning-50/50' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{diff.label}</span>
                    {diff.changed && (
                      <Edit3 size={14} className="text-warning-600" />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <p className="text-xs text-gray-500">旧值</p>
                      <p className={`text-sm font-mono ${diff.changed ? 'text-red-600 line-through' : 'text-gray-600'}`}>
                        {String(diff.oldValue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">新值</p>
                      <p className={`text-sm font-mono ${diff.changed ? 'text-green-600 font-medium' : 'text-gray-600'}`}>
                        {String(diff.newValue)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <GitCompare size={16} className="text-ocean-600" />
                数据变化概览
              </h3>
            </div>

            <div className="p-4 grid grid-cols-3 gap-3">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <Plus size={18} className="mx-auto text-green-600 mb-1" />
                <p className="text-2xl font-bold text-green-700">
                  {recordDiffs.filter((d) => d.type === 'added').length}
                </p>
                <p className="text-xs text-green-600">新增记录</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center">
                <Edit3 size={18} className="mx-auto text-yellow-600 mb-1" />
                <p className="text-2xl font-bold text-yellow-700">
                  {recordDiffs.filter((d) => d.type === 'modified').length}
                </p>
                <p className="text-xs text-yellow-600">修改记录</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <Minus size={18} className="mx-auto text-red-600 mb-1" />
                <p className="text-2xl font-bold text-red-700">
                  {recordDiffs.filter((d) => d.type === 'removed').length}
                </p>
                <p className="text-xs text-red-600">删除记录</p>
              </div>
            </div>

            <div className="border-t border-gray-200 p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">关键参数变化</h4>
              {changedParamCount > 0 ? (
                <div className="space-y-2">
                  {paramDiffs
                    .filter((d) => d.changed)
                    .map((diff) => (
                      <div
                        key={diff.key}
                        className="text-sm flex items-center gap-2 bg-warning-50 rounded px-3 py-2"
                      >
                        <ChevronRight size={14} className="text-warning-600" />
                        <span className="text-gray-700">{diff.label}:</span>
                        <span className="text-red-600 line-through">
                          {String(diff.oldValue)}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="text-green-600 font-medium">
                          {String(diff.newValue)}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">参数无变化</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="font-semibold text-gray-800">数据记录变更详情</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">状态</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">记录ID</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">来源</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">经纬度</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">淤积深度</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">等级</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recordDiffs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      两个版本数据完全一致
                    </td>
                  </tr>
                ) : (
                  recordDiffs.map((diff) => {
                    const record = diff.newRecord || diff.oldRecord;
                    if (!record) return null;

                    const bgColor = {
                      added: 'bg-green-50/50',
                      removed: 'bg-red-50/50',
                      modified: 'bg-yellow-50/50',
                    }[diff.type];

                    const statusLabel = {
                      added: '新增',
                      removed: '删除',
                      modified: '修改',
                    }[diff.type];

                    const statusColor = {
                      added: 'bg-green-100 text-green-700',
                      removed: 'bg-red-100 text-red-700',
                      modified: 'bg-yellow-100 text-yellow-700',
                    }[diff.type];

                    return (
                      <tr key={diff.recordId} className={bgColor}>
                        <td className="px-4 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-mono text-gray-700">
                          {record.id}
                        </td>
                        <td className="px-4 py-2">
                          <SourceBadge source={record.source} />
                        </td>
                        <td className="px-4 py-2 font-mono text-gray-600">
                          {formatLatLng(record.latitude, record.longitude, 'decimal')}
                        </td>
                        <td className="px-4 py-2">
                          {diff.type === 'modified' ? (
                            <div className="space-y-0.5">
                              <span className="text-red-500 line-through text-xs">
                                {formatDepth(diff.oldRecord?.sedimentDepth || 0)}
                              </span>
                              <span className="text-green-600 font-medium">
                                {formatDepth(diff.newRecord?.sedimentDepth || 0)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-700">
                              {formatDepth(record.sedimentDepth)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <SedimentLevelBadge level={record.sedimentLevel} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
