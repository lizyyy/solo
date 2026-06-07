
import { useState } from 'react';
import {
  Map,
  Clock,
  AlertTriangle,
  RefreshCw,
  Download,
  Eye,
  CheckCircle,
  ChevronDown,
} from 'lucide-react';
import { HeatmapCanvas } from '../components/HeatmapCanvas';
import { useAppStore } from '../store/appStore';

const statusColors = {
  draft: 'bg-gray-100 text-gray-700',
  pending_review: 'bg-orange-100 text-orange-700',
  confirmed: 'bg-green-100 text-green-700',
};

const statusLabels = {
  draft: '草稿',
  pending_review: '待复核',
  confirmed: '已确认',
};

export default function Heatmap() {
  const {
    heatmapData,
    currentProject,
    selectedHeatmapVersion,
    setSelectedHeatmapVersion,
    recalculateHeatmap,
    addOperationLog,
  } = useAppStore();

  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const [timeRange, setTimeRange] = useState<'all' | 'day' | 'night'>('all');

  const projectHeatmaps = heatmapData.filter((h) => h.projectId === currentProject?.id);
  const selectedHeatmap = projectHeatmaps.find((h) => h.id === selectedHeatmapVersion) || projectHeatmaps[0];

  const filteredData = selectedHeatmap?.data.filter((point) => {
    if (timeRange === 'all') return true;
    const hour = parseInt(point.time.split(' ')[1]?.split(':')[0] || '0');
    if (timeRange === 'day') return hour >= 6 && hour < 22;
    return hour >= 22 || hour < 6;
  }) || [];

  const handleRecalculate = () => {
    recalculateHeatmap();
  };

  const handleExport = () => {
    addOperationLog('导出热力图', `导出版本${selectedHeatmap?.version}的热力图数据`);
    alert('热力图数据已导出（演示）');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">热力图</h1>
          <p className="text-gray-500 mt-1">基于公交刷卡数据的区域人口热力分布</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRecalculate}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            重算热力图
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-[#f59e0b] text-white rounded-lg hover:bg-[#d97706] transition-colors"
          >
            <Download className="w-4 h-4" />
            导出
          </button>
        </div>
      </div>

      {selectedHeatmap?.hasLowSampling && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-orange-800">检测到夜间采样不足</p>
            <p className="text-sm text-orange-600">
              {selectedHeatmap.lowSamplingAreas?.join('、')}
              区域夜间(22:00-06:00)采样量偏低，热力图可能不准确，已标记为待复核状态
            </p>
          </div>
          <span className="px-3 py-1 bg-orange-500 text-white text-sm rounded-full">
            待街道规划员复核
          </span>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Map className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">热力点数量</p>
              <p className="text-xl font-bold text-gray-800">{filteredData.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Eye className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">当前版本</p>
              <p className="text-xl font-bold text-gray-800">{selectedHeatmap?.version || '-'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">历史版本</p>
              <p className="text-xl font-bold text-gray-800">{projectHeatmaps.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">状态</p>
              <p className="text-sm font-medium mt-1">
                <span className={`px-2 py-1 rounded ${statusColors[selectedHeatmap?.status || 'draft']}`}>
                  {statusLabels[selectedHeatmap?.status || 'draft']}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">热力分布</h2>
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 rounded-lg p-1">
                {(['all', 'day', 'night'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      timeRange === range
                        ? 'bg-white text-gray-800 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {range === 'all' ? '全部' : range === 'day' ? '日间' : '夜间'}
                  </button>
                ))}
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowVersionDropdown(!showVersionDropdown)}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <span className="text-sm">{selectedHeatmap?.version}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showVersionDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                    {projectHeatmaps.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => {
                          setSelectedHeatmapVersion(h.id);
                          setShowVersionDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 text-sm flex items-center justify-between"
                      >
                        <span>{h.version}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${statusColors[h.status]}`}>
                          {statusLabels[h.status]}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            {selectedHeatmap ? (
              <HeatmapCanvas
                data={filteredData}
                width={700}
                height={500}
                highlightAreas={selectedHeatmap.lowSamplingAreas || []}
              />
            ) : (
              <div className="w-[700px] h-[500px] flex items-center justify-center bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-gray-500">暂无热力图数据</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500"></div>
              <span className="text-sm text-gray-600">低密度</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-600">中低密度</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
              <span className="text-sm text-gray-600">中高密度</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500"></div>
              <span className="text-sm text-gray-600">高密度</span>
            </div>
            <div className="flex items-center gap-2 border-l border-gray-200 pl-6">
              <div className="w-4 h-4 border-2 border-red-500 border-dashed rounded"></div>
              <span className="text-sm text-gray-600">采样不足区域</span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">版本历史</h3>
            <div className="space-y-3">
              {projectHeatmaps.slice().reverse().map((h) => (
                <div
                  key={h.id}
                  onClick={() => setSelectedHeatmapVersion(h.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    h.id === selectedHeatmapVersion
                      ? 'bg-[#f59e0b]/10 border border-[#f59e0b]/30'
                      : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-800">{h.version}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${statusColors[h.status]}`}>
                      {statusLabels[h.status]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{h.createdAt}</p>
                  {h.hasLowSampling && (
                    <p className="text-xs text-orange-600 mt-1">⚠️ 存在采样不足区域</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">区域统计</h3>
            <div className="space-y-3">
              {['城西小区A区', '城西小区B区', '拆迁区东片', '人民广场'].map((area) => {
                const areaPoints = filteredData.filter((p) => p.areaName === area);
                const avgValue = areaPoints.length > 0
                  ? Math.round(areaPoints.reduce((sum, p) => sum + p.value, 0) / areaPoints.length)
                  : 0;
                const isLow = selectedHeatmap?.lowSamplingAreas?.includes(area);
                return (
                  <div key={area} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700">{area}</span>
                      {isLow && (
                        <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                          采样不足
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 via-green-500 to-red-500 rounded-full"
                          style={{ width: `${Math.min(avgValue, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600 w-8 text-right">{avgValue}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
