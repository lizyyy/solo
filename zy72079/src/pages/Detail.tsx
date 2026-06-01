import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { StatusBadge } from '../components/StatusBadge';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { useState } from 'react';

const anomalyTypeLabels: Record<string, string> = {
  empty_value: '空值',
  duplicate: '重复记录',
  unit_mismatch: '单位不匹配',
  outlier: '异常值',
  boundary: '边界值',
};

const severityLabels: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

export default function Detail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { records, confirmRecord, rejectRecord } = useStore();
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const record = records.find(r => r.id === id);

  if (!record) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">记录不存在</p>
          <button onClick={() => navigate('/')} className="btn-primary">
            返回列表
          </button>
        </div>
      </div>
    );
  }

  const handleConfirm = () => {
    confirmRecord(record.id);
  };

  const handleReject = () => {
    if (rejectReason.trim()) {
      rejectRecord(record.id, rejectReason);
      setShowRejectModal(false);
      setRejectReason('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900 font-display">
                  {record.recordNo} - 估算详情
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <StatusBadge status={record.status} />
                  <span className="text-sm text-slate-500">参数版本: {record.parameterVersion}</span>
                </div>
              </div>
            </div>
            {record.status === 'pending' && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="btn-danger text-sm"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  驳回
                </button>
                <button onClick={handleConfirm} className="btn-primary text-sm">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  确认通过
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-800 font-display mb-4">基本信息</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-slate-500">区域</p>
              <p className="font-medium text-slate-900">{record.area}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">计算日期</p>
              <p className="font-medium text-slate-900">{record.calculationDate}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">数据来源</p>
              <p className="font-medium text-slate-900">
                {record.source === 'system' ? '系统生成' : record.source === 'manual' ? '人工录入' : '历史数据'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">估算容量</p>
              <p className="font-medium text-primary-700">
                {record.calculatedResult
                  ? `${record.calculatedResult.capacity.toFixed(2)} ${record.calculatedResult.unit}`
                  : 'N/A'}
              </p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-sm text-slate-500">备注</p>
            <p className="font-medium text-slate-700">{record.remark}</p>
          </div>
          {record.failureReason && (
            <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">失败原因</p>
                  <p className="text-sm text-red-700">{record.failureReason}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-800 font-display mb-4">原始数据</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-slate-500">管网长度</p>
              <p className="font-medium text-slate-900">
                {record.rawData.pipeLength !== undefined ? `${record.rawData.pipeLength} m` : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">管网直径</p>
              <p className="font-medium text-slate-900">
                {record.rawData.pipeDiameter !== undefined
                  ? `${record.rawData.pipeDiameter} ${record.rawData.pipeDiameterUnit || 'm'}`
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">降雨强度</p>
              <p className="font-medium text-slate-900">
                {record.rawData.rainfallIntensity !== undefined
                  ? `${record.rawData.rainfallIntensity} ${record.rawData.rainfallUnit || 'mm/h'}`
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">径流系数</p>
              <p className="font-medium text-slate-900">
                {record.rawData.runoffCoefficient !== undefined ? record.rawData.runoffCoefficient : '-'}
              </p>
            </div>
          </div>
        </div>

        {record.anomalies.length > 0 && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-slate-800 font-display mb-4">异常检测结果</h2>
            <div className="space-y-3">
              {record.anomalies.map((anomaly, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg anomaly-${anomaly.severity}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 mt-0.5 text-slate-500" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">
                            {anomalyTypeLabels[anomaly.type]}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            anomaly.severity === 'high'
                              ? 'bg-red-100 text-red-700'
                              : anomaly.severity === 'medium'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {severityLabels[anomaly.severity]}级
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">
                          字段: {anomaly.field}
                        </p>
                        <p className="text-sm text-slate-700 mt-1">
                          {anomaly.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-800 font-display mb-6">计算过程追溯</h2>
          <div className="relative">
            <div className="timeline-line" />
            <div className="space-y-8">
              {record.calculationSteps.map((step, index) => (
                <div key={step.stepId} className="relative pl-12">
                  <div
                    className="timeline-dot"
                    style={{ top: '0' }}
                  />
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-slate-900">
                        步骤 {index + 1}: {step.description}
                      </h3>
                      {step.unitBefore && step.unitAfter && step.unitBefore !== step.unitAfter && (
                        <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                          单位换算: {step.unitBefore} → {step.unitAfter}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500 mb-1">输入</p>
                        <pre className="bg-white p-2 rounded border border-slate-200 text-xs overflow-x-auto">
                          {JSON.stringify(step.input, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <p className="text-slate-500 mb-1">计算公式</p>
                        <code className="block bg-white p-2 rounded border border-slate-200 text-xs font-mono text-primary-700">
                          {step.formula}
                        </code>
                      </div>
                      <div>
                        <p className="text-slate-500 mb-1">输出</p>
                        <pre className="bg-white p-2 rounded border border-slate-200 text-xs overflow-x-auto text-green-700">
                          {JSON.stringify(step.output, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {record.calculationSteps.length === 0 && (
                <div className="pl-12 py-4 text-slate-500">
                  无计算步骤记录
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">驳回确认</h3>
            <p className="text-sm text-slate-600 mb-4">请填写驳回原因：</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="input-field mb-4"
              rows={4}
              placeholder="请输入驳回原因..."
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim()}
                className="btn-danger"
              >
                确认驳回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
