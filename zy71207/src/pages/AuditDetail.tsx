import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  RotateCcw,
  Download,
  CheckCircle,
  AlertTriangle,
  Calculator,
  FileText,
  X,
  AlertCircle,
} from 'lucide-react';
import { useAuditStore } from '../store/audit.store';
import { api, downloadBlob } from '../api/client';
import { AuditTimeline } from '../components/AuditTimeline';
import { StatusBadge } from '../components/StatusBadge';

export function AuditDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    currentAudit,
    auditChain,
    rollbackPlan,
    loading,
    error,
    fetchAudit,
    fetchAuditChain,
    recalculateAudit,
    generateRollback,
    executeRollback,
    resolveAudit,
    clearRollbackPlan,
    clearError,
  } = useAuditStore();

  const [showRollbackModal, setShowRollbackModal] = useState(false);

  useEffect(() => {
    if (id) {
      fetchAudit(id);
      fetchAuditChain(id);
    }
  }, [id, fetchAudit, fetchAuditChain]);

  const handleExport = async () => {
    if (!id) return;
    try {
      const blob = await api.exportAudit(id);
      downloadBlob(blob, `审计报告_${currentAudit?.customerName || id}.xlsx`);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleGenerateRollback = async () => {
    if (!id) return;
    await generateRollback(id);
    setShowRollbackModal(true);
  };

  const handleExecuteRollback = async () => {
    if (!rollbackPlan) return;
    await executeRollback(rollbackPlan.rollback.id);
    setShowRollbackModal(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const isAbnormal = currentAudit?.status === 'abnormal';
  const hasError = auditChain.some((n) => n.status === 'error');
  const hasWarning = auditChain.some((n) => n.status === 'warning');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-dark-card rounded-lg transition-colors text-dark-muted hover:text-dark-text"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">审计详情</h1>
            <p className="text-dark-muted mt-1 font-mono text-sm">
              审计ID: {id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExport} className="btn-secondary">
            <Download className="w-4 h-4" />
            导出报告
          </button>
          <button
            onClick={() => id && recalculateAudit(id)}
            className="btn-secondary"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            重新计算
          </button>
          {isAbnormal && (
            <>
              <button onClick={handleGenerateRollback} className="btn-danger">
                <RotateCcw className="w-4 h-4" />
                生成回滚方案
              </button>
              <button
                onClick={() => id && resolveAudit(id)}
                className="btn-success"
              >
                <CheckCircle className="w-4 h-4" />
                标记已处理
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
          </div>
          <button onClick={clearError} className="text-red-400 hover:text-red-300">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {currentAudit && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-400" />
                基本信息
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-dark-muted mb-1">客户名称</p>
                  <p className="font-medium text-white">{currentAudit.customerName}</p>
                  <p className="text-xs text-dark-muted font-mono">
                    {currentAudit.customerId}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-dark-muted mb-1">产品名称</p>
                  <p className="font-medium text-white">{currentAudit.productName}</p>
                  <p className="text-xs text-dark-muted font-mono">
                    {currentAudit.productId}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-dark-muted mb-1">审计状态</p>
                  <StatusBadge status={currentAudit.status} />
                </div>
                <div>
                  <p className="text-sm text-dark-muted mb-1">审计时间</p>
                  <p className="font-medium text-white">
                    {new Date(currentAudit.auditTime).toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>
            </div>

            {isAbnormal && (
              <div className="card border-red-700/50 bg-red-900/10">
                <h2 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  问题诊断
                </h2>
                <div className="space-y-3">
                  {currentAudit.reasons
                    .filter((r) => r.includes('错误') || r.includes('多扣') || r.includes('少扣') || r.includes('不匹配') || r.includes('未应用'))
                    .map((reason, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-3 bg-red-900/20 rounded-lg border border-red-800/30"
                      >
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-red-200">{reason}</p>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="card">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-accent-400" />
                费用对比
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-dark-surface rounded-lg border border-dark-border">
                  <p className="text-sm text-dark-muted mb-1">应扣金额</p>
                  <p className="text-2xl font-bold font-mono text-emerald-400">
                    {formatCurrency(currentAudit.expectedAmount)}
                  </p>
                </div>
                <div className="p-4 bg-dark-surface rounded-lg border border-dark-border">
                  <p className="text-sm text-dark-muted mb-1">实扣金额</p>
                  <p className="text-2xl font-bold font-mono text-white">
                    {formatCurrency(currentAudit.actualAmount)}
                  </p>
                </div>
                <div
                  className={`p-4 rounded-lg border ${
                    currentAudit.diffAmount > 0
                      ? 'bg-red-900/20 border-red-700/50'
                      : currentAudit.diffAmount < 0
                        ? 'bg-amber-900/20 border-amber-700/50'
                        : 'bg-emerald-900/20 border-emerald-700/50'
                  }`}
                >
                  <p className="text-sm text-dark-muted mb-1">差异金额</p>
                  <p
                    className={`text-2xl font-bold font-mono ${
                      currentAudit.diffAmount > 0
                        ? 'text-red-400'
                        : currentAudit.diffAmount < 0
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                    }`}
                  >
                    {currentAudit.diffAmount !== 0
                      ? (currentAudit.diffAmount > 0 ? '+' : '') +
                        formatCurrency(currentAudit.diffAmount)
                      : '¥0.00'}
                  </p>
                </div>
              </div>

              <div className="mt-4 p-4 bg-dark-bg/50 rounded-lg">
                <p className="text-sm text-dark-muted mb-2">计算说明</p>
                <ul className="space-y-1 text-sm">
                  {currentAudit.reasons.map((reason, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary-400">•</span>
                      <span className="text-dark-text">{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                {hasError ? (
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                ) : hasWarning ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                )}
                审计链路
              </h2>
              <AuditTimeline nodes={auditChain} />
            </div>
          </div>
        </div>
      )}

      {showRollbackModal && rollbackPlan && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in">
          <div className="card w-full max-w-lg mx-4 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-red-400" />
                回滚补偿方案
              </h3>
              <button
                onClick={() => {
                  setShowRollbackModal(false);
                  clearRollbackPlan();
                }}
                className="text-dark-muted hover:text-dark-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="p-4 bg-dark-surface rounded-lg border border-dark-border">
                <p className="text-sm text-dark-muted mb-2">计算明细</p>
                <ul className="space-y-2">
                  {rollbackPlan.planDetails.calculation.map((item, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <Calculator className="w-4 h-4 text-primary-400" />
                      <span className="text-dark-text">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-xs text-dark-muted mb-1">回退本金</p>
                  <p className="text-lg font-bold font-mono text-white">
                    {formatCurrency(rollbackPlan.planDetails.rollbackAmount)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-dark-muted mb-1">补偿金</p>
                  <p className="text-lg font-bold font-mono text-amber-400">
                    {formatCurrency(rollbackPlan.planDetails.compensationAmount)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-dark-muted mb-1">合计</p>
                  <p className="text-lg font-bold font-mono text-red-400">
                    {formatCurrency(rollbackPlan.planDetails.totalAmount)}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-amber-900/20 border border-amber-700/50 rounded-lg">
                <p className="text-sm text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  补偿金按年化{(rollbackPlan.planDetails.compensationRate * 100).toFixed(1)}%计算
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRollbackModal(false);
                  clearRollbackPlan();
                }}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleExecuteRollback}
                className="btn-danger"
                disabled={loading}
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                确认执行回滚
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditDetail;
