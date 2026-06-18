import { useState } from 'react';
import {
  AlertTriangle,
  MapPin,
  Waves,
  CheckCircle,
  Clock,
  X,
  User,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import {
  formatDateTime,
  getAnomalyTypeLabel,
  getSeverityLabel,
  getSeverityColor,
} from '../utils/anomalyUtils';
import type { AnomalyType, AnomalySeverity } from '../types';

const Anomalies = () => {
  const {
    anomalies,
    buoyLogs,
    spatialMarks,
    resolveAnomaly,
    setSelectedLogId,
    setShowLogDetail,
    setSelectedMarkId,
  } = useAppStore();

  const [filterType, setFilterType] = useState<AnomalyType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'resolved' | 'unresolved'>('unresolved');
  const [filterSeverity, setFilterSeverity] = useState<AnomalySeverity | 'all'>('all');
  const [selectedAnomaly, setSelectedAnomaly] = useState<string | null>(null);
  const [resolveInput, setResolveInput] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  const filteredAnomalies = anomalies.filter((a) => {
    if (filterType !== 'all' && a.type !== filterType) return false;
    if (filterStatus === 'resolved' && !a.isResolved) return false;
    if (filterStatus === 'unresolved' && a.isResolved) return false;
    if (filterSeverity !== 'all' && a.severity !== filterSeverity) return false;
    return true;
  });

  const typeStats = {
    latlng_swapped: anomalies.filter((a) => a.type === 'latlng_swapped').length,
    value_outlier: anomalies.filter((a) => a.type === 'value_outlier').length,
    missing_data: anomalies.filter((a) => a.type === 'missing_data').length,
    duplicate_log: anomalies.filter((a) => a.type === 'duplicate_log').length,
  };

  const unresolvedCount = anomalies.filter((a) => !a.isResolved).length;
  const resolvedCount = anomalies.filter((a) => a.isResolved).length;

  const selectedAnomalyData = selectedAnomaly
    ? anomalies.find((a) => a.id === selectedAnomaly)
    : null;

  const getSourceData = (anomaly: typeof anomalies[0]) => {
    if (anomaly.sourceType === 'buoy_log') {
      return buoyLogs.find((l) => l.id === anomaly.sourceId);
    }
    return spatialMarks.find((m) => m.id === anomaly.sourceId);
  };

  const handleViewSource = (anomaly: typeof anomalies[0]) => {
    if (anomaly.sourceType === 'buoy_log') {
      setSelectedLogId(anomaly.sourceId);
      setShowLogDetail(true);
      setSelectedAnomaly(null);
    } else {
      setSelectedMarkId(anomaly.sourceId);
    }
  };

  const handleResolve = () => {
    if (selectedAnomaly && resolveInput.trim()) {
      resolveAnomaly(selectedAnomaly, resolveInput, '老何');
      setIsResolving(false);
      setResolveInput('');
      setSelectedAnomaly(null);
    }
  };

  const startResolve = () => {
    setIsResolving(true);
    if (selectedAnomalyData) {
      setResolveInput('');
    }
  };

  const severityStats = {
    high: anomalies.filter((a) => a.severity === 'high' && !a.isResolved).length,
    medium: anomalies.filter((a) => a.severity === 'medium' && !a.isResolved).length,
    low: anomalies.filter((a) => a.severity === 'low' && !a.isResolved).length,
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-ocean-900">异常中心</h2>
          <p className="text-ocean-600 mt-1 text-sm">检测和处理所有数据异常</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 bg-coral-100 text-coral-700 rounded-lg text-sm font-medium">
            待处理 {unresolvedCount}
          </span>
          <span className="px-3 py-1.5 bg-seagrass-100 text-seagrass-700 rounded-lg text-sm font-medium">
            已处理 {resolvedCount}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-red-500 to-red-700 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">高风险</p>
              <p className="text-3xl font-bold mt-1">{severityStats.high}</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-red-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-coral-500 to-coral-700 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-coral-100 text-sm">中风险</p>
              <p className="text-3xl font-bold mt-1">{severityStats.medium}</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-coral-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-sand-500 to-sand-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sand-100 text-sm">低风险</p>
              <p className="text-3xl font-bold mt-1">{severityStats.low}</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-sand-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-seagrass-500 to-seagrass-700 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-seagrass-100 text-sm">已处理</p>
              <p className="text-3xl font-bold mt-1">{resolvedCount}</p>
            </div>
            <CheckCircle className="w-10 h-10 text-seagrass-200" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="font-semibold text-gray-800 mb-3">异常类型</h3>
            <div className="space-y-2">
              <button
                onClick={() => setFilterType('all')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  filterType === 'all'
                    ? 'bg-ocean-50 text-ocean-700 font-medium'
                    : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                <span>全部类型</span>
                <span className="text-xs">{anomalies.length}</span>
              </button>
              <button
                onClick={() => setFilterType('latlng_swapped')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  filterType === 'latlng_swapped'
                    ? 'bg-coral-50 text-coral-700 font-medium'
                    : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                <span>经纬度反写</span>
                <span className="text-xs">{typeStats.latlng_swapped}</span>
              </button>
              <button
                onClick={() => setFilterType('value_outlier')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  filterType === 'value_outlier'
                    ? 'bg-sand-50 text-sand-700 font-medium'
                    : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                <span>数值异常</span>
                <span className="text-xs">{typeStats.value_outlier}</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="font-semibold text-gray-800 mb-3">状态筛选</h3>
            <div className="space-y-2">
              {(['all', 'unresolved', 'resolved'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    filterStatus === status
                      ? 'bg-ocean-50 text-ocean-700 font-medium'
                      : 'hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  <span>
                    {status === 'all' ? '全部' : status === 'unresolved' ? '未处理' : '已处理'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="font-semibold text-gray-800 mb-3">严重程度</h3>
            <div className="space-y-2">
              {(['all', 'high', 'medium', 'low'] as const).map((sev) => (
                <button
                  key={sev}
                  onClick={() => setFilterSeverity(sev)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    filterSeverity === sev
                      ? 'bg-ocean-50 text-ocean-700 font-medium'
                      : 'hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  <span>
                    {sev === 'all'
                      ? '全部'
                      : sev === 'high'
                      ? '高风险'
                      : sev === 'medium'
                      ? '中风险'
                      : '低风险'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">
                异常列表{' '}
                <span className="text-sm font-normal text-gray-500">
                  ({filteredAnomalies.length} 条)
                </span>
              </h3>
            </div>

            <div className="divide-y divide-gray-100 max-h-[550px] overflow-y-auto">
              {filteredAnomalies.map((anomaly, index) => {
                const source = getSourceData(anomaly);
                const sourceName =
                  anomaly.sourceType === 'buoy_log'
                    ? (source as any)?.buoyId
                    : (source as any)?.name;

                return (
                  <div
                    key={anomaly.id}
                    onClick={() => setSelectedAnomaly(anomaly.id)}
                    className={`p-4 cursor-pointer transition-all hover:bg-gray-50 ${
                      selectedAnomaly === anomaly.id ? 'bg-ocean-50 border-l-4 border-ocean-500' : ''
                    }`}
                    style={{ animation: 'fadeInUp 0.3s ease-out', animationDelay: `${index * 0.03}s` }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            anomaly.isResolved
                              ? 'bg-seagrass-100'
                              : anomaly.severity === 'high'
                              ? 'bg-red-100'
                              : anomaly.severity === 'medium'
                              ? 'bg-coral-100'
                              : 'bg-sand-100'
                          }`}
                        >
                          {anomaly.isResolved ? (
                            <CheckCircle
                              className={`w-5 h-5 ${
                                anomaly.isResolved ? 'text-seagrass-600' : 'text-coral-600'
                              }`}
                            />
                          ) : (
                            <AlertTriangle
                              className={`w-5 h-5 ${
                                anomaly.severity === 'high'
                                  ? 'text-red-600'
                                  : anomaly.severity === 'medium'
                                  ? 'text-coral-600'
                                  : 'text-sand-600'
                              }`}
                            />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-800">
                              {getAnomalyTypeLabel(anomaly.type)}
                            </h4>
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(
                                anomaly.severity
                              )}`}
                            >
                              {getSeverityLabel(anomaly.severity)}风险
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {anomaly.description}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              {anomaly.sourceType === 'buoy_log' ? (
                                <Waves className="w-3 h-3" />
                              ) : (
                                <MapPin className="w-3 h-3" />
                              )}
                              {sourceName || '未知来源'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDateTime(anomaly.detectedAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {anomaly.isResolved ? (
                          <span className="text-xs text-seagrass-600 bg-seagrass-50 px-2 py-1 rounded">
                            已处理
                          </span>
                        ) : (
                          <span className="text-xs text-coral-600 bg-coral-50 px-2 py-1 rounded">
                            待处理
                          </span>
                        )}
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredAnomalies.length === 0 && (
                <div className="py-16 text-center">
                  <div className="w-16 h-16 bg-seagrass-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-seagrass-500" />
                  </div>
                  <p className="text-gray-500">暂无匹配的异常记录</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedAnomaly && selectedAnomalyData && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => {
              setSelectedAnomaly(null);
              setIsResolving(false);
              setResolveInput('');
            }}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
            <div
              className={`p-5 ${
                selectedAnomalyData.severity === 'high'
                  ? 'bg-red-50'
                  : selectedAnomalyData.severity === 'medium'
                  ? 'bg-coral-50'
                  : 'bg-sand-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      selectedAnomalyData.isResolved
                        ? 'bg-seagrass-200'
                        : selectedAnomalyData.severity === 'high'
                        ? 'bg-red-200'
                        : selectedAnomalyData.severity === 'medium'
                        ? 'bg-coral-200'
                        : 'bg-sand-200'
                    }`}
                  >
                    {selectedAnomalyData.isResolved ? (
                      <CheckCircle className="w-5 h-5 text-seagrass-700" />
                    ) : (
                      <AlertTriangle
                        className={`w-5 h-5 ${
                          selectedAnomalyData.severity === 'high'
                            ? 'text-red-700'
                            : selectedAnomalyData.severity === 'medium'
                            ? 'text-coral-700'
                            : 'text-sand-700'
                        }`}
                      />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-800">
                      {getAnomalyTypeLabel(selectedAnomalyData.type)}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {selectedAnomalyData.isResolved ? '已处理' : '待处理'} ·{' '}
                      {getSeverityLabel(selectedAnomalyData.severity)}风险
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedAnomaly(null);
                    setIsResolving(false);
                    setResolveInput('');
                  }}
                  className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">异常描述</p>
                <p className="text-sm text-gray-600">{selectedAnomalyData.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">检测时间</p>
                  <p className="text-sm font-medium text-gray-800 mt-1">
                    {formatDateTime(selectedAnomalyData.detectedAt)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">来源类型</p>
                  <p className="text-sm font-medium text-gray-800 mt-1">
                    {selectedAnomalyData.sourceType === 'buoy_log' ? '浮标日志' : '空间标注'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleViewSource(selectedAnomalyData)}
                className="w-full p-3 bg-ocean-50 hover:bg-ocean-100 rounded-lg text-ocean-700 font-medium transition-colors flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                查看原始数据
                <ArrowRight className="w-4 h-4" />
              </button>

              {selectedAnomalyData.isResolved && selectedAnomalyData.resolvedRemark && (
                <div className="bg-seagrass-50 rounded-lg p-4 border border-seagrass-200">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-seagrass-600" />
                    <p className="text-sm font-medium text-seagrass-800">处理结果</p>
                  </div>
                  <p className="text-sm text-seagrass-700">
                    {selectedAnomalyData.resolvedRemark}
                  </p>
                  <div className="flex items-center gap-2 mt-3 text-xs text-seagrass-600">
                    <User className="w-3 h-3" />
                    <span>处理人: {selectedAnomalyData.resolvedBy}</span>
                    <span>·</span>
                    <span>{formatDateTime(selectedAnomalyData.resolvedAt || '')}</span>
                  </div>
                </div>
              )}

              {!selectedAnomalyData.isResolved && !isResolving && (
                <button
                  onClick={startResolve}
                  className="w-full py-3 bg-seagrass-600 text-white rounded-lg font-medium hover:bg-seagrass-700 transition-colors"
                >
                  标记为已处理
                </button>
              )}

              {!selectedAnomalyData.isResolved && isResolving && (
                <div className="space-y-3">
                  <textarea
                    value={resolveInput}
                    onChange={(e) => setResolveInput(e.target.value)}
                    placeholder="请输入处理说明..."
                    className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-seagrass-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsResolving(false);
                        setResolveInput('');
                      }}
                      className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleResolve}
                      disabled={!resolveInput.trim()}
                      className="flex-1 py-2.5 bg-seagrass-600 text-white rounded-lg font-medium hover:bg-seagrass-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      确认处理
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Anomalies;
