import { X, MapPin, Calendar, User, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { formatDateTime, getAnomalyTypeLabel, getSeverityColor } from '../utils/anomalyUtils';
import { useState } from 'react';

const BuoyLogDetail = () => {
  const {
    selectedLogId,
    showLogDetail,
    setShowLogDetail,
    getLogById,
    getAnomaliesBySourceId,
    getChangesBySourceId,
    confirmBuoyLog,
    updateBuoyLog,
  } = useAppStore();

  const [remarkInput, setRemarkInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const log = selectedLogId ? getLogById(selectedLogId) : null;
  const anomalies = selectedLogId ? getAnomaliesBySourceId(selectedLogId) : [];
  const changes = selectedLogId ? getChangesBySourceId('buoy_log', selectedLogId) : [];

  const unresolvedAnomalies = anomalies.filter((a) => !a.isResolved);

  const handleClose = () => {
    setShowLogDetail(false);
    setIsEditing(false);
    setRemarkInput('');
  };

  const handleConfirm = () => {
    if (log) {
      const remark = remarkInput.trim() || log.remark;
      confirmBuoyLog(log.id, '老何', remark);
      setIsEditing(false);
    }
  };

  const handleEditRemark = () => {
    if (log) {
      setRemarkInput(log.remark);
      setIsEditing(true);
    }
  };

  const handleSaveRemark = () => {
    if (log) {
      updateBuoyLog(log.id, { remark: remarkInput });
      setIsEditing(false);
    }
  };

  if (!log) return null;

  return (
    <>
      {showLogDetail && (
        <div
          className="fixed inset-0 bg-black/30 z-40 transition-opacity"
          onClick={handleClose}
        />
      )}
      <div
        className={`fixed right-0 top-0 h-full w-[480px] bg-white z-50 shadow-2xl transform transition-transform duration-300 ${
          showLogDetail ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-ocean-50 to-white">
            <div>
              <h3 className="font-bold text-lg text-gray-800">浮标日志详情</h3>
              <p className="text-sm text-gray-500 mt-0.5">{log.buoyId}</p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {unresolvedAnomalies.length > 0 && (
              <div className="bg-coral-50 border border-coral-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-coral-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-coral-800">存在未处理异常</p>
                    <ul className="mt-2 space-y-2">
                      {unresolvedAnomalies.map((a) => (
                        <li
                          key={a.id}
                          className="text-sm text-coral-700 bg-white/50 rounded px-3 py-2"
                        >
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-medium mr-2 ${getSeverityColor(
                              a.severity
                            )}`}
                          >
                            {a.severity === 'high' ? '高风险' : a.severity === 'medium' ? '中风险' : '低风险'}
                          </span>
                          {getAnomalyTypeLabel(a.type)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-seagrass-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {log.isConfirmed ? (
                    <CheckCircle className="w-5 h-5 text-seagrass-600" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-sand-400" />
                  )}
                  <span
                    className={`font-medium ${
                      log.isConfirmed ? 'text-seagrass-700' : 'text-sand-700'
                    }`}
                  >
                    {log.isConfirmed ? '已人工确认' : '待确认'}
                  </span>
                </div>
                {log.confirmedAt && (
                  <span className="text-xs text-seagrass-600">
                    确认人: {log.confirmer}
                  </span>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-ocean-500" />
                位置信息
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">经度</p>
                  <p className={`text-lg font-semibold ${
                    anomalies.some(a => a.type === 'latlng_swapped') ? 'text-coral-600' : 'text-gray-800'
                  }`}>
                    {log.longitude.toFixed(4)}°E
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">纬度</p>
                  <p className={`text-lg font-semibold ${
                    anomalies.some(a => a.type === 'latlng_swapped') ? 'text-coral-600' : 'text-gray-800'
                  }`}>
                    {log.latitude.toFixed(4)}°N
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-seagrass-500" />
                调查数据
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">水温</p>
                  <p className="text-lg font-semibold text-gray-800">
                    {log.temperature}°C
                  </p>
                </div>
                <div className="bg-seagrass-50 rounded-lg p-3">
                  <p className="text-xs text-seagrass-600">覆盖度</p>
                  <p className="text-lg font-semibold text-seagrass-700">
                    {log.seagrassCoverage}%
                  </p>
                </div>
                <div className="bg-ocean-50 rounded-lg p-3">
                  <p className="text-xs text-ocean-600">生物量</p>
                  <p className="text-lg font-semibold text-ocean-700">
                    {log.biomass} g/m²
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sand-500" />
                记录信息
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">记录时间</span>
                  <span className="text-gray-800">{formatDateTime(log.recordTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">导入批次</span>
                  <span className="text-ocean-600 font-mono text-xs">{log.importBatch}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">创建时间</span>
                  <span className="text-gray-700">{formatDateTime(log.createdAt)}</span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-coral-500" />
                  人工备注
                </h4>
                {!isEditing && (
                  <button
                    onClick={handleEditRemark}
                    className="text-xs text-ocean-600 hover:text-ocean-800"
                  >
                    编辑
                  </button>
                )}
              </div>
              {isEditing ? (
                <div>
                  <textarea
                    value={remarkInput}
                    onChange={(e) => setRemarkInput(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-ocean-500 focus:border-transparent resize-none"
                    rows={3}
                    placeholder="输入备注..."
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleSaveRemark}
                      className="px-3 py-1.5 bg-ocean-600 text-white text-xs rounded-lg hover:bg-ocean-700"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-coral-50 border border-coral-100 rounded-lg p-3">
                  {log.remark ? (
                    <p className="text-sm text-coral-800 whitespace-pre-wrap">{log.remark}</p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">暂无备注</p>
                  )}
                </div>
              )}
            </div>

            {changes.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">变更历史</h4>
                <div className="space-y-2">
                  {changes.slice(0, 5).map((change) => (
                    <div
                      key={change.id}
                      className="bg-gray-50 rounded-lg p-3 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700">{change.action}</span>
                        <span className="text-xs text-gray-400">
                          {formatDateTime(change.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        操作人: {change.operator}
                      </p>
                      {change.remark && (
                        <p className="text-xs text-gray-600 mt-1">{change.remark}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!log.isConfirmed && (
            <div className="p-5 border-t border-gray-100 bg-gray-50">
              <button
                onClick={handleConfirm}
                className="w-full py-3 bg-seagrass-600 text-white rounded-lg font-medium hover:bg-seagrass-700 transition-colors shadow-sm"
              >
                确认数据有效
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default BuoyLogDetail;
