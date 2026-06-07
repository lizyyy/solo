import { useState } from 'react';
import { Search, ChevronDown, ChevronUp, Filter, AlertTriangle, Database, User } from 'lucide-react';
import { useGaitStore } from '../../store/useGaitStore';
import { BONE_GROUP_LABELS, DATA_SOURCE_LABELS, BoneGroup, DataSource } from '../../types';
import StatisticsPanel from './StatisticsPanel';
import ActionLogPanel from './ActionLogPanel';

export default function FilterPanel() {
  const { filters, toggleBoneGroupFilter, toggleDataSourceFilter, setShowAnomalyOnly, setSearchQuery } = useGaitStore();
  const [boneGroupExpanded, setBoneGroupExpanded] = useState(true);
  const [dataSourceExpanded, setDataSourceExpanded] = useState(true);

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Filter size={20} className="text-blue-600" />
          数据筛选
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">搜索点位</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="输入点位名称..."
              value={filters.searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.showAnomalyOnly}
              onChange={(e) => setShowAnomalyOnly(e.target.checked)}
              className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
            />
            <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <AlertTriangle size={14} className="text-orange-500" />
              仅显示异常
            </span>
          </label>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setBoneGroupExpanded(!boneGroupExpanded)}
            className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <User size={16} className="text-gray-500" />
              骨骼部位
            </span>
            {boneGroupExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {boneGroupExpanded && (
            <div className="p-3 space-y-2">
              {Object.entries(BONE_GROUP_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                  <input
                    type="checkbox"
                    checked={filters.boneGroups.includes(key as BoneGroup)}
                    onChange={() => toggleBoneGroupFilter(key as BoneGroup)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">{label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setDataSourceExpanded(!dataSourceExpanded)}
            className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
          >
            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Database size={16} className="text-gray-500" />
              数据来源
            </span>
            {dataSourceExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {dataSourceExpanded && (
            <div className="p-3 space-y-2">
              {Object.entries(DATA_SOURCE_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                  <input
                    type="checkbox"
                    checked={filters.dataSources.includes(key as DataSource)}
                    onChange={() => toggleDataSourceFilter(key as DataSource)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">{label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <StatisticsPanel />
      <ActionLogPanel />
    </div>
  );
}
