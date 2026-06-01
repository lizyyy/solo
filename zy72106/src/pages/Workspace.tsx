import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { anomalyRules } from '@/data/sampleData';
import { detectAnomalies, groupIssuesByRecord } from '@/utils/calculations/anomalyDetection';
import { locateEarthquake } from '@/utils/calculations/location';
import { AlertTriangle, Play, Save, RotateCcw, CheckCircle, XCircle, Info } from 'lucide-react';

export function Workspace() {
  const {
    sensorRecords,
    calculationParams,
    setCalculationParams,
    resetCalculationParams,
    setCurrentResult,
    isCalculating,
    setIsCalculating,
    setValidationIssues,
    validationIssues,
    addManualCorrection,
    createSnapshot,
    setCurrentPage,
  } = useAppStore();

  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotNotes, setSnapshotNotes] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);

  useEffect(() => {
    if (sensorRecords.length > 0) {
      const issues = detectAnomalies(sensorRecords, anomalyRules);
      setValidationIssues(issues);
    }
  }, [sensorRecords, setValidationIssues]);

  const handleCalculate = () => {
    setIsCalculating(true);
    
    setTimeout(() => {
      try {
        const result = locateEarthquake(sensorRecords, calculationParams);
        
        const extremeIds = validationIssues
          .filter((i) => i.severity === 'error')
          .map((i) => i.recordId);
        const reviewIds = validationIssues
          .filter((i) => i.severity === 'warning')
          .map((i) => i.recordId);
        
        result.extremeValues = [...new Set(extremeIds)];
        result.needsReview = [...new Set(reviewIds)];
        
        setCurrentResult(result);
        setIsCalculating(false);
        setCurrentPage('results');
      } catch (error) {
        console.error('计算失败:', error);
        setIsCalculating(false);
      }
    }, 1500);
  };

  const handleSaveSnapshot = () => {
    if (snapshotName) {
      createSnapshot(snapshotName, '当前用户', snapshotNotes);
      setShowSaveModal(false);
      setSnapshotName('');
      setSnapshotNotes('');
    }
  };

  const issuesByRecord = groupIssuesByRecord(validationIssues);
  const errorCount = validationIssues.filter((i) => i.severity === 'error').length;
  const warningCount = validationIssues.filter((i) => i.severity === 'warning').length;
  const infoCount = validationIssues.filter((i) => i.severity === 'info').length;

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <XCircle size={16} className="text-red-400" />;
      case 'warning':
        return <AlertTriangle size={16} className="text-amber-400" />;
      default:
        return <Info size={16} className="text-blue-400" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold text-white">传感器记录 ({sensorRecords.length}条)</h3>
              <div className="flex items-center gap-2">
                {errorCount > 0 && (
                  <span className="badge badge-danger">{errorCount} 错误</span>
                )}
                {warningCount > 0 && (
                  <span className="badge badge-warning">{warningCount} 警告</span>
                )}
                {infoCount > 0 && (
                  <span className="badge badge-info">{infoCount} 提示</span>
                )}
              </div>
            </div>
            <div className="card-body">
              {sensorRecords.length === 0 ? (
                <p className="text-slate-400 text-center py-8">
                  请先在数据导入页面上传数据
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>台站</th>
                        <th>P波到时</th>
                        <th>S波到时</th>
                        <th>振幅</th>
                        <th>质量</th>
                        <th>来源</th>
                        <th>状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sensorRecords.map((record) => {
                        const issues = issuesByRecord.get(record.id) || [];
                        const hasError = issues.some((i) => i.severity === 'error');
                        const hasWarning = issues.some((i) => i.severity === 'warning');

                        return (
                          <tr
                            key={record.id}
                            className={
                              hasError
                                ? 'bg-red-900/20'
                                : hasWarning
                                ? 'bg-amber-900/20'
                                : ''
                            }
                          >
                            <td className="font-medium text-white">
                              {record.stationName}
                            </td>
                            <td className="font-mono">
                              {record.pWaveArrival !== null
                                ? record.pWaveArrival.toFixed(2)
                                : <span className="text-slate-500">-</span>}
                            </td>
                            <td className="font-mono">
                              {record.sWaveArrival !== null
                                ? record.sWaveArrival.toFixed(2)
                                : <span className="text-slate-500">-</span>}
                            </td>
                            <td className="font-mono">
                              {record.amplitude !== null
                                ? record.amplitude.toLocaleString()
                                : <span className="text-slate-500">-</span>}
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  record.quality === 'good'
                                    ? 'badge-success'
                                    : record.quality === 'fair'
                                    ? 'badge-warning'
                                    : 'badge-danger'
                                }`}
                              >
                                {record.quality}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  record.source === 'sensor'
                                    ? 'badge-info'
                                    : record.source === 'manual'
                                    ? 'badge-warning'
                                    : 'bg-slate-700 text-slate-300 border border-slate-600'
                                }`}
                              >
                                {record.source === 'sensor'
                                  ? '传感器'
                                  : record.source === 'manual'
                                  ? '人工'
                                  : '旧数据'}
                              </span>
                            </td>
                            <td>
                              {hasError ? (
                                <span className="text-red-400 flex items-center gap-1">
                                  <XCircle size={14} /> 异常
                                </span>
                              ) : hasWarning ? (
                                <span className="text-amber-400 flex items-center gap-1">
                                  <AlertTriangle size={14} /> 待确认
                                </span>
                              ) : (
                                <span className="text-green-400 flex items-center gap-1">
                                  <CheckCircle size={14} /> 正常
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {validationIssues.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-white">数据校验问题</h3>
              </div>
              <div className="card-body">
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {validationIssues.map((issue, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg flex items-start gap-3 ${
                        issue.severity === 'error'
                          ? 'bg-red-900/30 border border-red-800'
                          : issue.severity === 'warning'
                          ? 'bg-amber-900/30 border border-amber-800'
                          : 'bg-blue-900/30 border border-blue-800'
                      }`}
                    >
                      {getSeverityIcon(issue.severity)}
                      <div className="flex-1">
                        <p className="text-sm text-white">
                          {
                            sensorRecords.find((r) => r.id === issue.recordId)
                              ?.stationName
                          }
                          : {issue.message}
                        </p>
                        {issue.field && (
                          <p className="text-xs text-slate-400 mt-1">
                            字段: {issue.field} | 类型: {issue.type}
                          </p>
                        )}
                      </div>
                      {issue.severity !== 'info' && (
                        <button
                          className="text-xs text-primary-400 hover:text-primary-300"
                          onClick={() =>
                            addManualCorrection({
                              recordId: issue.recordId,
                              field: issue.field || '',
                              oldValue: '',
                              newValue: '',
                              reason: issue.message,
                            })
                          }
                        >
                          标记修正
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold text-white">计算参数</h3>
              <button
                onClick={resetCalculationParams}
                className="text-sm text-slate-400 hover:text-white flex items-center gap-1"
              >
                <RotateCcw size={14} /> 重置
              </button>
            </div>
            <div className="card-body space-y-4">
              <div>
                <label className="input-label">P波速度 (km/s)</label>
                <input
                  type="number"
                  className="input"
                  value={calculationParams.pWaveVelocity}
                  onChange={(e) =>
                    setCalculationParams({
                      pWaveVelocity: parseFloat(e.target.value),
                    })
                  }
                  step="0.1"
                />
              </div>
              <div>
                <label className="input-label">S波速度 (km/s)</label>
                <input
                  type="number"
                  className="input"
                  value={calculationParams.sWaveVelocity}
                  onChange={(e) =>
                    setCalculationParams({
                      sWaveVelocity: parseFloat(e.target.value),
                    })
                  }
                  step="0.1"
                />
              </div>
              <div>
                <label className="input-label">波速比 (Vp/Vs)</label>
                <input
                  type="number"
                  className="input"
                  value={calculationParams.velocityRatio}
                  onChange={(e) =>
                    setCalculationParams({
                      velocityRatio: parseFloat(e.target.value),
                    })
                  }
                  step="0.01"
                />
              </div>
              <div>
                <label className="input-label">时间差阈值 (秒)</label>
                <input
                  type="number"
                  className="input"
                  value={calculationParams.timeThreshold}
                  onChange={(e) =>
                    setCalculationParams({
                      timeThreshold: parseFloat(e.target.value),
                    })
                  }
                  step="1"
                />
              </div>
              <div>
                <label className="input-label">定位方法</label>
                <select
                  className="input"
                  value={calculationParams.locationMethod}
                  onChange={(e) =>
                    setCalculationParams({
                      locationMethod: e.target.value as any,
                    })
                  }
                >
                  <option value="geiger">Geiger 方法</option>
                  <option value="homogeneous">均匀介质</option>
                  <option value="layered">层状介质</option>
                </select>
              </div>
              <div>
                <label className="input-label">最大迭代次数</label>
                <input
                  type="number"
                  className="input"
                  value={calculationParams.maxIterations}
                  onChange={(e) =>
                    setCalculationParams({
                      maxIterations: parseInt(e.target.value),
                    })
                  }
                  min="1"
                />
              </div>
              <div>
                <label className="input-label">收敛阈值</label>
                <input
                  type="number"
                  className="input"
                  value={calculationParams.convergenceThreshold}
                  onChange={(e) =>
                    setCalculationParams({
                      convergenceThreshold: parseFloat(e.target.value),
                    })
                  }
                  step="0.001"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleCalculate}
              disabled={isCalculating || sensorRecords.length < 3}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Play size={18} />
              {isCalculating ? '计算中...' : '执行定位计算'}
            </button>
            <button
              onClick={() => setShowSaveModal(true)}
              disabled={sensorRecords.length === 0}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <Save size={18} />
              保存当前快照
            </button>
          </div>
        </div>
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card w-full max-w-md mx-4">
            <div className="card-header">
              <h3 className="font-semibold text-white">保存计算快照</h3>
            </div>
            <div className="card-body space-y-4">
              <div>
                <label className="input-label">快照名称</label>
                <input
                  type="text"
                  className="input"
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                  placeholder="例如：2024-01-15 地震定位分析"
                />
              </div>
              <div>
                <label className="input-label">备注 (可选)</label>
                <textarea
                  className="input min-h-[80px]"
                  value={snapshotNotes}
                  onChange={(e) => setSnapshotNotes(e.target.value)}
                  placeholder="记录本次计算的特殊说明..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="btn-secondary flex-1"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveSnapshot}
                  disabled={!snapshotName}
                  className="btn-primary flex-1"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
