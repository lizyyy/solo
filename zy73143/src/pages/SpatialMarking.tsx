import { useState } from 'react';
import {
  MapPin,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  X,
  FileText,
  Waves,
  Calendar,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { formatDateTime } from '../utils/anomalyUtils';

const SpatialMarking = () => {
  const {
    spatialMarks,
    buoyLogs,
    anomalies,
    selectedMarkId,
    setSelectedMarkId,
    setShowLogDetail,
    setSelectedLogId,
  } = useAppStore();

  const [showOnlyAbnormal, setShowOnlyAbnormal] = useState(false);
  const [showMarkDetail, setShowMarkDetail] = useState(false);

  const displayMarks = showOnlyAbnormal
    ? spatialMarks.filter((m) => m.status === 'abnormal')
    : spatialMarks;

  const selectedMark = selectedMarkId ? spatialMarks.find((m) => m.id === selectedMarkId) : null;

  const getMarkPosition = (mark: typeof spatialMarks[0]) => {
    const minLng = 118.75;
    const maxLng = 118.85;
    const minLat = 32.02;
    const maxLat = 32.10;

    const x = ((mark.longitude - minLng) / (maxLng - minLng)) * 100;
    const y = ((maxLat - mark.latitude) / (maxLat - minLat)) * 100;

    return { x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) };
  };

  const handleMarkClick = (markId: string) => {
    setSelectedMarkId(markId);
    setShowMarkDetail(true);
  };

  const handleViewLog = (logId: string) => {
    setSelectedLogId(logId);
    setShowLogDetail(true);
    setShowMarkDetail(false);
  };

  const getMarkAnomalies = (markId: string) => {
    return anomalies.filter((a) => a.sourceType === 'spatial_mark' && a.sourceId === markId && !a.isResolved);
  };

  const getMarkTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      core_zone: '核心区',
      transition_zone: '过渡带',
      nearshore_zone: '近岸带',
    };
    return labels[type] || type;
  };

  const getMarkTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      core_zone: 'bg-seagrass-500',
      transition_zone: 'bg-ocean-500',
      nearshore_zone: 'bg-sand-500',
    };
    return colors[type] || 'bg-gray-500';
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-ocean-900">空间标注</h2>
          <p className="text-ocean-600 mt-1 text-sm">海草床分布点位标注与管理</p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:bg-gray-50"
            onClick={() => setShowOnlyAbnormal(!showOnlyAbnormal)}
          >
            {showOnlyAbnormal ? (
              <ToggleRight className="w-5 h-5 text-coral-500" />
            ) : (
              <ToggleLeft className="w-5 h-5 text-gray-400" />
            )}
            <span className={`text-sm font-medium ${showOnlyAbnormal ? 'text-coral-600' : 'text-gray-600'}`}>
              只看异常
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="relative h-[500px] bg-gradient-to-br from-ocean-100 via-ocean-50 to-seagrass-50 overflow-hidden">
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(14, 165, 233, 0.1)" strokeWidth="0.3" />
                  </pattern>
                </defs>
                <rect width="100" height="100" fill="url(#grid)" />

                <path
                  d="M 0 80 Q 20 75, 30 78 T 50 72 T 70 75 T 100 70 L 100 100 L 0 100 Z"
                  fill="rgba(34, 197, 94, 0.15)"
                  stroke="rgba(34, 197, 94, 0.3)"
                  strokeWidth="0.5"
                />
                <path
                  d="M 0 90 Q 30 85, 45 88 T 70 82 T 100 85 L 100 100 L 0 100 Z"
                  fill="rgba(34, 197, 94, 0.25)"
                  stroke="rgba(34, 197, 94, 0.4)"
                  strokeWidth="0.5"
                />

                <path
                  d="M 10 55 Q 15 50, 25 52 T 40 48 T 55 50 T 70 45 T 85 48 T 100 42"
                  fill="none"
                  stroke="rgba(14, 165, 233, 0.4)"
                  strokeWidth="0.3"
                  strokeDasharray="2 2"
                />
                <path
                  d="M 5 70 Q 20 65, 35 68 T 60 62 T 80 65 T 100 60"
                  fill="none"
                  stroke="rgba(14, 165, 233, 0.3)"
                  strokeWidth="0.3"
                  strokeDasharray="2 2"
                />
              </svg>

              <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm">
                <p className="text-xs font-medium text-gray-600">海图 · 比例尺 1:10000</p>
                <p className="text-xs text-gray-400 mt-0.5">118.75°E - 118.85°E, 32.02°N - 32.10°N</p>
              </div>

              {displayMarks.map((mark, index) => {
                const pos = getMarkPosition(mark);
                const markAnomalies = getMarkAnomalies(mark.id);
                const hasAnomaly = mark.status === 'abnormal' || markAnomalies.length > 0;
                const isSelected = selectedMarkId === mark.id;

                return (
                  <div
                    key={mark.id}
                    className={`absolute transform -translate-x-1/2 -translate-y-full cursor-pointer transition-all duration-300 ${
                      isSelected ? 'z-20 scale-110' : 'z-10 hover:scale-105'
                    }`}
                    style={{
                      left: `${pos.x}%`,
                      top: `${pos.y}%`,
                      animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`,
                    }}
                    onClick={() => handleMarkClick(mark.id)}
                  >
                    {hasAnomaly && (
                      <div className="absolute -top-2 -right-2 w-4 h-4 bg-coral-500 rounded-full flex items-center justify-center animate-pulse z-10">
                        <AlertTriangle className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                    <div
                      className={`relative ${
                        hasAnomaly ? 'animate-bounce' : ''
                      }`}
                      style={{ animationDuration: '2s' }}
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 border-white ${
                          hasAnomaly
                            ? 'bg-gradient-to-br from-coral-400 to-coral-600'
                            : `bg-gradient-to-br ${
                                mark.type === 'core_zone'
                                  ? 'from-seagrass-400 to-seagrass-600'
                                  : mark.type === 'transition_zone'
                                  ? 'from-ocean-400 to-ocean-600'
                                  : 'from-sand-400 to-sand-600'
                              }`
                        }`}
                      >
                        <MapPin className="w-5 h-5 text-white" />
                      </div>
                      <div
                        className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-inherit rotate-45"
                        style={{
                          clipPath: 'polygon(0 0, 100% 0, 100% 100%)',
                        }}
                      />
                    </div>
                    <div
                      className={`absolute top-full left-1/2 transform -translate-x-1/2 mt-1 whitespace-nowrap px-2 py-1 rounded text-xs font-medium ${
                        isSelected
                          ? 'bg-gray-800 text-white'
                          : 'bg-white/90 text-gray-700 shadow-sm'
                      }`}
                    >
                      {mark.name}
                    </div>
                  </div>
                );
              })}

              <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-sm">
                <p className="text-xs font-medium text-gray-600 mb-2">图例</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-seagrass-500"></div>
                    <span className="text-xs text-gray-600">核心区</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-ocean-500"></div>
                    <span className="text-xs text-gray-600">过渡带</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-sand-500"></div>
                    <span className="text-xs text-gray-600">近岸带</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-coral-500 animate-pulse"></div>
                    <span className="text-xs text-gray-600">异常点位</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="font-semibold text-gray-800 mb-3">标注点位</h3>
            <div className="space-y-2">
              {spatialMarks.map((mark) => {
                const hasAnomaly = mark.status === 'abnormal';
                return (
                  <div
                    key={mark.id}
                    onClick={() => handleMarkClick(mark.id)}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      selectedMarkId === mark.id
                        ? 'bg-ocean-50 border border-ocean-200'
                        : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getMarkTypeColor(mark.type)}`} />
                      <span className="font-medium text-sm text-gray-800">{mark.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">{getMarkTypeLabel(mark.type)}</span>
                      {hasAnomaly && (
                        <span className="text-xs text-coral-600 bg-coral-50 px-1.5 py-0.5 rounded">
                          异常
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-gradient-to-br from-ocean-50 to-seagrass-50 rounded-xl p-4 border border-ocean-100">
            <h3 className="font-semibold text-ocean-900 mb-2 text-sm">统计概览</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/70 rounded-lg p-3">
                <p className="text-2xl font-bold text-ocean-700">{spatialMarks.length}</p>
                <p className="text-xs text-ocean-600 mt-0.5">总点位</p>
              </div>
              <div className="bg-white/70 rounded-lg p-3">
                <p className="text-2xl font-bold text-coral-600">
                  {spatialMarks.filter((m) => m.status === 'abnormal').length}
                </p>
                <p className="text-xs text-coral-600 mt-0.5">异常点</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showMarkDetail && selectedMark && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setShowMarkDetail(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
            <div className={`p-5 ${selectedMark.status === 'abnormal' ? 'bg-coral-50' : 'bg-seagrass-50'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin
                      className={`w-5 h-5 ${
                        selectedMark.status === 'abnormal' ? 'text-coral-600' : 'text-seagrass-600'
                      }`}
                    />
                    <h3 className="font-bold text-lg text-gray-800">{selectedMark.name}</h3>
                  </div>
                  <p className="text-sm text-gray-500">
                    {getMarkTypeLabel(selectedMark.type)} · {' '}
                    {selectedMark.status === 'abnormal' ? (
                      <span className="text-coral-600 font-medium">异常点位</span>
                    ) : (
                      <span className="text-seagrass-600 font-medium">正常点位</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setShowMarkDetail(false)}
                  className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">经度</p>
                  <p className="text-lg font-semibold text-gray-800">
                    {selectedMark.longitude.toFixed(4)}°E
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">纬度</p>
                  <p className="text-lg font-semibold text-gray-800">
                    {selectedMark.latitude.toFixed(4)}°N
                  </p>
                </div>
              </div>

              <div className="bg-ocean-50 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <FileText className="w-5 h-5 text-ocean-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-ocean-900 mb-1">计算口径</p>
                    <p className="text-sm text-ocean-700">{selectedMark.calculationMethod}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Waves className="w-4 h-4 text-ocean-500" />
                  关联浮标日志
                </h4>
                <div className="space-y-2">
                  {selectedMark.buoyLogIds.map((logId) => {
                    const log = buoyLogs.find((l) => l.id === logId);
                    if (!log) return null;
                    return (
                      <div
                        key={logId}
                        onClick={() => handleViewLog(logId)}
                        className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-ocean-300 hover:bg-ocean-50/30 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-mono text-sm font-medium text-gray-800">
                              {log.buoyId}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              覆盖度 {log.seagrassCoverage}% · 生物量 {log.biomass}g/m²
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400">
                              {formatDateTime(log.recordTime)}
                            </p>
                            <p className="text-xs text-ocean-600 mt-0.5">查看详情 →</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedMark.remark && (
                <div className="bg-coral-50 border border-coral-100 rounded-lg p-4">
                  <p className="text-sm font-medium text-coral-800 mb-1">备注</p>
                  <p className="text-sm text-coral-700 whitespace-pre-wrap">
                    {selectedMark.remark}
                  </p>
                </div>
              )}

              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>创建于 {formatDateTime(selectedMark.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SpatialMarking;
