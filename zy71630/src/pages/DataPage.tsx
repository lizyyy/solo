import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Edit3, Save, AlertTriangle, CheckCircle, FileText, User, DollarSign, Tag, Clock, Shield } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { getAnomalyTypeLabel, getSeverityLabel, getGuaranteeTypeLabel } from '@/utils/anomalyDetector';
import { getRiskColor } from '@/utils/colors';
import { cn } from '@/lib/utils';
import type { Loan, RiskReport } from '@/types';

export default function DataPage() {
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [adjustedValue, setAdjustedValue] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const loans = useAppStore((state) => state.loans);
  const riskRatings = useAppStore((state) => state.riskRatings);
  const industryTags = useAppStore((state) => state.industryTags);
  const maturityBuckets = useAppStore((state) => state.maturityBuckets);
  const guarantees = useAppStore((state) => state.guarantees);
  const getLoanReport = useAppStore((state) => state.getLoanReport);
  const getLoanAnomalies = useAppStore((state) => state.getLoanAnomalies);
  const updateRiskReport = useAppStore((state) => state.updateRiskReport);
  const updateLoanRiskRating = useAppStore((state) => state.updateLoanRiskRating);

  const selectedLoan = loans.find((l) => l.id === selectedLoanId);
  const selectedReport = selectedLoanId ? getLoanReport(selectedLoanId) : undefined;
  const selectedAnomalies = selectedLoanId ? getLoanAnomalies(selectedLoanId) : [];
  const selectedGuarantees = selectedLoanId
    ? guarantees.filter((g) => g.loanId === selectedLoanId)
    : [];

  const handleLoanClick = (loan: Loan) => {
    setSelectedLoanId(loan.id === selectedLoanId ? null : loan.id);
    setEditMode(false);
    if (loan.id !== selectedLoanId) {
      const report = getLoanReport(loan.id);
      setAdjustedValue(report?.adjustedValue || '');
      setConclusion(report?.conclusion || '');
      setAdjustReason(report?.adjustReason || '');
    }
  };

  const handleSave = () => {
    if (!selectedLoanId) return;

    const oldConclusion = selectedReport?.conclusion || '';
    if (oldConclusion && oldConclusion !== conclusion) {
      let confirmed = true;
      if (typeof window !== 'undefined' && window.confirm) {
        try {
          confirmed = window.confirm(
            '警告：即将覆盖已有结论。\n\n旧结论将被记录到审计日志，是否继续？'
          );
        } catch {
          confirmed = true;
        }
      }
      if (!confirmed) return;
    }

    updateRiskReport(selectedLoanId, adjustedValue, conclusion, adjustReason);
    setEditMode(false);
  };

  const handleRatingChange = (newRating: string) => {
    if (!selectedLoanId) return;
    let reason = '自动化调整';
    if (typeof window !== 'undefined' && window.prompt) {
      try {
        const result = window.prompt('请输入评级调整原因：');
        if (result !== null) {
          reason = result;
        } else {
          return;
        }
      } catch {
        reason = '自动化调整';
      }
    }
    if (reason) {
      updateLoanRiskRating(selectedLoanId, newRating, reason);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <div className="w-96 border-r border-slate-700/50 flex flex-col bg-slate-800/30">
          <div className="p-4 border-b border-slate-700/50">
            <h2 className="text-lg font-bold text-white">贷款列表</h2>
            <p className="text-xs text-slate-400 mt-1">共 {loans.length} 条贷款记录</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loans.map((loan) => {
              const anomalies = getLoanAnomalies(loan.id);
              const hasAnomaly = anomalies.some((a) => !a.resolved);
              const isSelected = loan.id === selectedLoanId;
              const industryName = industryTags.find((i) => i.code === loan.industryCode)?.name;
              const riskLevel = riskRatings.find((r) => r.code === loan.riskRatingCode)?.riskLevel || 5;

              return (
                <div
                  key={loan.id}
                  onClick={() => handleLoanClick(loan)}
                  className={cn(
                    'p-3 rounded-lg border cursor-pointer transition-all',
                    isSelected
                      ? 'bg-cyan-500/15 border-cyan-500/50'
                      : 'bg-slate-700/20 border-transparent hover:border-slate-600/50'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-medium text-white flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {loan.customerName}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {loan.loanNo}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {industryName}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono text-cyan-400">
                        {(loan.principal / 10000).toFixed(0)}万
                      </div>
                      <div
                        className="text-[11px] font-mono mt-0.5 px-1.5 py-0.5 rounded inline-block"
                        style={{
                          backgroundColor: getRiskColor(riskLevel) + '30',
                          color: getRiskColor(riskLevel),
                        }}
                      >
                        {loan.riskRatingCode}
                      </div>
                      {hasAnomaly && (
                        <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-amber-400">
                          <AlertTriangle className="w-3 h-3" />
                          {anomalies.filter((a) => !a.resolved).length}个异常
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {selectedLoan && selectedReport ? (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">
                  风险报告 - {selectedLoan.customerName}
                </h2>
                <div className="flex items-center gap-2">
                  {!editMode ? (
                    <button
                      onClick={() => setEditMode(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                      编辑报告
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditMode(false)}
                        className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
                      >
                        <Save className="w-4 h-4" />
                        保存
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <InfoCard
                  icon={<User className="w-4 h-4" />}
                  label="客户名称"
                  value={selectedLoan.customerName}
                />
                <InfoCard
                  icon={<DollarSign className="w-4 h-4" />}
                  label="贷款金额"
                  value={`${(selectedLoan.principal / 10000).toFixed(0)}万元`}
                />
                <InfoCard
                  icon={<Tag className="w-4 h-4" />}
                  label="所属行业"
                  value={industryTags.find((i) => i.code === selectedLoan.industryCode)?.name || '-'}
                />
                <InfoCard
                  icon={<Clock className="w-4 h-4" />}
                  label="到期期限"
                  value={maturityBuckets.find((m) => m.code === selectedLoan.maturityBucketCode)?.name || '-'}
                />
              </div>

              <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  风险评级
                </h3>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-slate-400">当前评级:</span>
                  <div className="flex gap-2">
                    {riskRatings.map((rating) => (
                      <button
                        key={rating.code}
                        onClick={() => handleRatingChange(rating.code)}
                        className={cn(
                          'px-3 py-1.5 rounded text-sm font-mono border transition-all',
                          selectedLoan.riskRatingCode === rating.code
                            ? 'border-cyan-400 text-white'
                            : 'border-transparent text-slate-400 hover:text-white'
                        )}
                        style={{
                          backgroundColor: selectedLoan.riskRatingCode === rating.code
                            ? getRiskColor(rating.riskLevel) + '40'
                            : 'transparent',
                        }}
                      >
                        {rating.code}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  三段式数据分离
                </h3>

                <DataSection
                  title="原始值"
                  value={selectedReport.rawValue}
                  type="raw"
                  readOnly
                />

                <DataSection
                  title="修正值"
                  value={adjustedValue}
                  type="adjusted"
                  readOnly={!editMode}
                  onChange={setAdjustedValue}
                />

                {editMode && (
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-amber-500/30">
                    <label className="block text-xs font-medium text-amber-400 mb-2">
                      修正原因 *
                    </label>
                    <textarea
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      className="w-full h-20 bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-sm text-white resize-none focus:outline-none focus:border-amber-500"
                      placeholder="请详细说明修正原因..."
                    />
                  </div>
                )}

                <DataSection
                  title="最终结论"
                  value={conclusion}
                  type="conclusion"
                  readOnly={!editMode}
                  onChange={setConclusion}
                />
              </div>

              {selectedAnomalies.length > 0 && (
                <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                  <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    异常标记 ({selectedAnomalies.length})
                  </h3>
                  <div className="space-y-3">
                    {selectedAnomalies.map((anomaly) => (
                      <div
                        key={anomaly.id}
                        className={cn(
                          'p-4 rounded-lg border',
                          anomaly.resolved
                            ? 'bg-green-500/10 border-green-500/30'
                            : 'bg-amber-500/10 border-amber-500/30'
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="text-xs font-medium px-2 py-0.5 rounded"
                              style={{
                                backgroundColor: anomaly.severity === 3
                                  ? 'rgba(239, 68, 68, 0.2)'
                                  : anomaly.severity === 2
                                  ? 'rgba(245, 158, 11, 0.2)'
                                  : 'rgba(234, 179, 8, 0.2)',
                                color: anomaly.severity === 3
                                  ? '#EF4444'
                                  : anomaly.severity === 2
                                  ? '#F59E0B'
                                  : '#EAB308',
                              }}
                            >
                              {getAnomalyTypeLabel(anomaly.type)}
                            </span>
                            <span className="text-xs text-slate-400">
                              严重程度: {getSeverityLabel(anomaly.severity)}
                            </span>
                          </div>
                          {anomaly.resolved && (
                            <span className="flex items-center gap-1 text-xs text-green-400">
                              <CheckCircle className="w-3.5 h-3.5" />
                              已解决
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-300">{anomaly.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedGuarantees.length > 0 && (
                <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                  <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-400" />
                    担保信息 ({selectedGuarantees.length})
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedGuarantees.map((guarantee) => (
                      <div
                        key={guarantee.id}
                        className={cn(
                          'p-4 rounded-lg border',
                          guarantee.isRepeated
                            ? 'bg-red-500/10 border-red-500/30'
                            : 'bg-slate-700/30 border-slate-600/50'
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-200">
                            {getGuaranteeTypeLabel(guarantee.type)}
                          </span>
                          <span className="text-sm font-mono text-cyan-400">
                            {(guarantee.amount / 10000).toFixed(0)}万
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">{guarantee.guarantor}</div>
                        {guarantee.isRepeated && (
                          <div className="mt-2 text-[11px] text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            担保重复风险
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <FileText className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg">请从左侧选择一笔贷款查看详情</p>
              <p className="text-sm mt-2">支持风险报告编辑、异常标记查看、担保信息管理</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
        {icon}
        {label}
      </div>
      <div className="text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function DataSection({
  title,
  value,
  type,
  readOnly,
  onChange,
}: {
  title: string;
  value: string;
  type: 'raw' | 'adjusted' | 'conclusion';
  readOnly: boolean;
  onChange?: (value: string) => void;
}) {
  const config = {
    raw: {
      border: 'border-slate-600',
      bg: 'bg-slate-700/20',
      titleColor: 'text-slate-400',
      icon: '📋',
    },
    adjusted: {
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/10',
      titleColor: 'text-amber-400',
      icon: '✏️',
    },
    conclusion: {
      border: 'border-green-500/30',
      bg: 'bg-green-500/10',
      titleColor: 'text-green-400',
      icon: '✅',
    },
  };

  const style = config[type];

  return (
    <div className={`rounded-xl p-5 border ${style.border} ${style.bg}`}>
      <div className={`text-sm font-medium mb-3 ${style.titleColor} flex items-center gap-2`}>
        <span>{style.icon}</span>
        {title}
        {readOnly && type !== 'raw' && (
          <span className="text-[10px] text-slate-500 ml-2">（点击编辑按钮可修改）</span>
        )}
        {type === 'raw' && (
          <span className="text-[10px] text-slate-500 ml-2">（原始数据，不可篡改）</span>
        )}
      </div>
      {readOnly ? (
        <div className="text-base text-white leading-relaxed">{value || '-'}</div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full h-24 bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-base text-white resize-none focus:outline-none focus:border-cyan-500"
          placeholder={`请输入${title}...`}
        />
      )}
    </div>
  );
}
