import { useState, useMemo } from 'react';
import { Upload, Search, Filter, AlertTriangle, CheckCircle, Clock, ChevronRight } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { formatDateTime, getSeverityColor } from '../utils/anomalyUtils';
import BuoyLogDetail from '../components/BuoyLogDetail';
import ImportModal from '../components/ImportModal';

const BuoyLogs = () => {
  const { buoyLogs, anomalies, setSelectedLogId, setShowLogDetail, setShowImportModal } =
    useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'confirmed' | 'pending'>('all');
  const [filterBatch, setFilterBatch] = useState<string>('all');
  const [filterAnomaly, setFilterAnomaly] = useState<'all' | 'has' | 'none'>('all');

  const batches = useMemo(() => {
    const set = new Set(buoyLogs.map((l) => l.importBatch));
    return Array.from(set);
  }, [buoyLogs]);

  const filteredLogs = useMemo(() => {
    return buoyLogs.filter((log) => {
      if (searchTerm && !log.buoyId.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (filterStatus === 'confirmed' && !log.isConfirmed) return false;
      if (filterStatus === 'pending' && log.isConfirmed) return false;
      if (filterBatch !== 'all' && log.importBatch !== filterBatch) return false;

      const logAnomalies = anomalies.filter((a) => a.sourceId === log.id && !a.isResolved);
      if (filterAnomaly === 'has' && logAnomalies.length === 0) return false;
      if (filterAnomaly === 'none' && logAnomalies.length > 0) return false;

      return true;
    });
  }, [buoyLogs, searchTerm, filterStatus, filterBatch, filterAnomaly, anomalies]);

  const hasAnomaly = (logId: string) => {
    return anomalies.some((a) => a.sourceId === logId && !a.isResolved);
  };

  const getLogAnomalies = (logId: string) => {
    return anomalies.filter((a) => a.sourceId === logId && !a.isResolved);
  };

  const handleViewDetail = (logId: string) => {
    setSelectedLogId(logId);
    setShowLogDetail(true);
  };

  const getSeverityHighest = (logId: string) => {
    const logAnomalies = getLogAnomalies(logId);
    if (logAnomalies.length === 0) return null;
    if (logAnomalies.some((a) => a.severity === 'high')) return 'high';
    if (logAnomalies.some((a) => a.severity === 'medium')) return 'medium';
    return 'low';
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-ocean-900">浮标日志</h2>
          <p className="text-ocean-600 mt-1 text-sm">管理和查看所有浮标调查数据</p>
        </div>
        <button
          onClick={() => setShowImportModal(true)}
          className="px-5 py-2.5 bg-ocean-600 text-white rounded-lg font-medium hover:bg-ocean-700 transition-colors shadow-sm flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          导入日志
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索浮标编号..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-ocean-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-ocean-500 focus:border-transparent"
            >
              <option value="all">全部状态</option>
              <option value="confirmed">已确认</option>
              <option value="pending">待确认</option>
            </select>

            <select
              value={filterAnomaly}
              onChange={(e) => setFilterAnomaly(e.target.value as any)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-ocean-500 focus:border-transparent"
            >
              <option value="all">全部异常</option>
              <option value="has">有异常</option>
              <option value="none">无异常</option>
            </select>

            <select
              value={filterBatch}
              onChange={(e) => setFilterBatch(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-ocean-500 focus:border-transparent max-w-[180px]"
            >
              <option value="all">全部批次</option>
              {batches.map((batch) => (
                <option key={batch} value={batch}>
                  {batch}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  浮标编号
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  位置
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  覆盖度
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  生物量
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  记录时间
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  导入批次
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLogs.map((log, index) => {
                const hasAbnormal = hasAnomaly(log.id);
                const severity = getSeverityHighest(log.id);

                return (
                  <tr
                    key={log.id}
                    className={`hover:bg-ocean-50/50 transition-colors cursor-pointer ${
                      hasAbnormal ? 'bg-coral-50/30' : ''
                    }`}
                    onClick={() => handleViewDetail(log.id)}
                    style={{ animation: 'fadeInUp 0.3s ease-out', animationDelay: `${index * 0.03}s` }}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-gray-800">{log.buoyId}</span>
                        {hasAbnormal && (
                          <span
                            className={`w-2 h-2 rounded-full ${
                              severity === 'high'
                                ? 'bg-red-500 animate-pulse'
                                : severity === 'medium'
                                ? 'bg-coral-500'
                                : 'bg-yellow-500'
                            }`}
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm text-gray-600">
                        <span
                          className={hasAbnormal && severity === 'high' ? 'text-coral-600 font-medium' : ''}
                        >
                          {log.longitude.toFixed(2)}°E, {log.latitude.toFixed(2)}°N
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-seagrass-500 rounded-full"
                            style={{ width: `${log.seagrassCoverage}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-700">{log.seagrassCoverage}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-700">{log.biomass} g/m²</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {log.isConfirmed ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-seagrass-500" />
                            <span className="text-sm text-seagrass-600">已确认</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-4 h-4 text-sand-500" />
                            <span className="text-sm text-sand-600">待确认</span>
                          </>
                        )}
                      </div>
                      {hasAbnormal && (
                        <div className="mt-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${getSeverityColor(
                              severity || 'low'
                            )}`}
                          >
                            <AlertTriangle className="w-3 h-3" />
                            异常
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-500">{formatDateTime(log.recordTime)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-ocean-600 bg-ocean-50 px-2 py-1 rounded font-mono">
                        {log.importBatch}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button className="text-ocean-600 hover:text-ocean-800 text-sm font-medium flex items-center gap-1 ml-auto">
                        详情
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredLogs.length === 0 && (
          <div className="py-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500">暂无匹配的浮标日志</p>
          </div>
        )}
      </div>

      <BuoyLogDetail />
      <ImportModal />
    </div>
  );
};

export default BuoyLogs;
