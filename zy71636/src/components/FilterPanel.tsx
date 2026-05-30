import { useState } from 'react';
import {
  Filter,
  Calendar,
  AlertTriangle,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { cn } from '../lib/utils';

export function FilterPanel() {
  const filters = useAppStore((state) => state.filters);
  const setFilters = useAppStore((state) => state.setFilters);
  const visibleLayers = useAppStore((state) => state.view.visibleLayers);
  const toggleLayer = useAppStore((state) => state.toggleLayer);

  const [expandedSections, setExpandedSections] = useState({
    dataTypes: true,
    timeRange: true,
    severity: true,
    sensorStatus: true,
    boundary: true,
    layers: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleDataTypeToggle = (type: 'crack' | 'sensor' | 'stress') => {
    const newTypes = filters.dataTypes.includes(type)
      ? filters.dataTypes.filter((t) => t !== type)
      : [...filters.dataTypes, type];
    setFilters({ dataTypes: newTypes });
  };

  const handleSeverityToggle = (severity: string) => {
    const newLevels = filters.severityLevel.includes(severity)
      ? filters.severityLevel.filter((s) => s !== severity)
      : [...filters.severityLevel, severity];
    setFilters({ severityLevel: newLevels });
  };

  const handleSensorStatusToggle = (status: string) => {
    const newStatus = filters.sensorStatus.includes(status)
      ? filters.sensorStatus.filter((s) => s !== status)
      : [...filters.sensorStatus, status];
    setFilters({ sensorStatus: newStatus });
  };

  const dataTypeOptions = [
    { value: 'crack', label: '裂缝数据', color: 'bg-red-500' },
    { value: 'sensor', label: '传感器数据', color: 'bg-blue-500' },
    { value: 'stress', label: '应力云图', color: 'bg-purple-500' },
  ];

  const severityOptions = [
    { value: 'critical', label: '危急', color: 'bg-red-500' },
    { value: 'warning', label: '预警', color: 'bg-orange-500' },
    { value: 'normal', label: '正常', color: 'bg-green-500' },
  ];

  const sensorStatusOptions = [
    { value: 'normal', label: '正常', color: 'bg-green-500' },
    { value: 'warning', label: '预警', color: 'bg-orange-500' },
    { value: 'alarm', label: '告警', color: 'bg-red-500' },
    { value: 'offline', label: '离线', color: 'bg-gray-500' },
  ];

  const layerOptions = [
    { value: 'dam', label: '坝体模型' },
    { value: 'cracks', label: '裂缝标注' },
    { value: 'sensors', label: '传感器' },
    { value: 'stress', label: '应力点' },
  ];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  return (
    <div className="w-72 bg-slate-900 border-r border-slate-700 h-full overflow-y-auto">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-2 text-white font-semibold">
          <Filter size={18} />
          <span>筛选条件</span>
        </div>
      </div>

      <div className="p-3 space-y-2">
        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('dataTypes')}
            className="w-full flex items-center justify-between p-3 text-white hover:bg-slate-700 transition-colors"
          >
            <span className="text-sm font-medium">数据类型</span>
            {expandedSections.dataTypes ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expandedSections.dataTypes && (
            <div className="px-3 pb-3 space-y-2">
              {dataTypeOptions.map(({ value, label, color }) => (
                <label
                  key={value}
                  className="flex items-center gap-2 cursor-pointer hover:bg-slate-700 p-2 rounded transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={filters.dataTypes.includes(value as any)}
                    onChange={() => handleDataTypeToggle(value as any)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <span className={`w-2 h-2 rounded-full ${color}`} />
                  <span className="text-sm text-slate-300">{label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('timeRange')}
            className="w-full flex items-center justify-between p-3 text-white hover:bg-slate-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-slate-400" />
              <span className="text-sm font-medium">时间范围</span>
            </div>
            {expandedSections.timeRange ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expandedSections.timeRange && (
            <div className="px-3 pb-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400">开始日期</label>
                  <input
                    type="date"
                    value={filters.timeRange[0].split('T')[0]}
                    onChange={(e) =>
                      setFilters({
                        timeRange: [new Date(e.target.value).toISOString(), filters.timeRange[1]],
                      })
                    }
                    className="w-full mt-1 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">结束日期</label>
                  <input
                    type="date"
                    value={filters.timeRange[1].split('T')[0]}
                    onChange={(e) =>
                      setFilters({
                        timeRange: [filters.timeRange[0], new Date(e.target.value).toISOString()],
                      })
                    }
                    className="w-full mt-1 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="text-xs text-slate-500">
                {formatDate(filters.timeRange[0])} - {formatDate(filters.timeRange[1])}
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('severity')}
            className="w-full flex items-center justify-between p-3 text-white hover:bg-slate-700 transition-colors"
          >
            <span className="text-sm font-medium">异常等级</span>
            {expandedSections.severity ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expandedSections.severity && (
            <div className="px-3 pb-3 space-y-2">
              {severityOptions.map(({ value, label, color }) => (
                <label
                  key={value}
                  className="flex items-center gap-2 cursor-pointer hover:bg-slate-700 p-2 rounded transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={filters.severityLevel.includes(value)}
                    onChange={() => handleSeverityToggle(value)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <span className={`w-2 h-2 rounded-full ${color}`} />
                  <span className="text-sm text-slate-300">{label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('sensorStatus')}
            className="w-full flex items-center justify-between p-3 text-white hover:bg-slate-700 transition-colors"
          >
            <span className="text-sm font-medium">传感器状态</span>
            {expandedSections.sensorStatus ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expandedSections.sensorStatus && (
            <div className="px-3 pb-3 space-y-2">
              {sensorStatusOptions.map(({ value, label, color }) => (
                <label
                  key={value}
                  className="flex items-center gap-2 cursor-pointer hover:bg-slate-700 p-2 rounded transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={filters.sensorStatus.includes(value)}
                    onChange={() => handleSensorStatusToggle(value)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <span className={`w-2 h-2 rounded-full ${color}`} />
                  <span className="text-sm text-slate-300">{label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('boundary')}
            className="w-full flex items-center justify-between p-3 text-white hover:bg-slate-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-yellow-500" />
              <span className="text-sm font-medium">边界问题数据</span>
            </div>
            {expandedSections.boundary ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expandedSections.boundary && (
            <div className="px-3 pb-3">
              <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-700 p-2 rounded transition-colors">
                <input
                  type="checkbox"
                  checked={filters.showBoundaryIssues}
                  onChange={(e) => setFilters({ showBoundaryIssues: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                />
                <span className="text-sm text-slate-300">显示边界问题数据</span>
              </label>
              <p className="text-xs text-slate-500 mt-1 px-2">
                包含坐标系偏移、重复记录、数据断点等
              </p>
            </div>
          )}
        </div>

        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('layers')}
            className="w-full flex items-center justify-between p-3 text-white hover:bg-slate-700 transition-colors"
          >
            <span className="text-sm font-medium">图层控制</span>
            {expandedSections.layers ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expandedSections.layers && (
            <div className="px-3 pb-3 space-y-2">
              {layerOptions.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => toggleLayer(value as any)}
                  className={cn(
                    'w-full flex items-center justify-between p-2 rounded transition-colors',
                    visibleLayers[value as keyof typeof visibleLayers]
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-500 hover:bg-slate-700 hover:text-slate-300'
                  )}
                >
                  <span className="text-sm">{label}</span>
                  {visibleLayers[value as keyof typeof visibleLayers] ? (
                    <Eye size={16} className="text-blue-400" />
                  ) : (
                    <EyeOff size={16} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
