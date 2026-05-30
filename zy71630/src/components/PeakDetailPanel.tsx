import { X, AlertTriangle, FileText, Building2, Clock, Shield, TrendingUp } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { getAnomalyTypeLabel, getSeverityLabel, getGuaranteeTypeLabel } from '@/utils/anomalyDetector';
import { getRiskColor, getRiskLabel, hexToRgba } from '@/utils/colors';
import type { TerrainDataPoint, Loan, RiskReport, AnomalyMark } from '@/types';
import { cn } from '@/lib/utils';

interface PeakDetailPanelProps {
  dataPoint: TerrainDataPoint | null;
  onClose: () => void;
}

export function PeakDetailPanel({ dataPoint, onClose }: PeakDetailPanelProps) {
  const selectLoan = useAppStore((state) => state.selectLoan);
  const selectedLoanId = useAppStore((state) => state.selectedLoanId);
  const getLoanAnomalies = useAppStore((state) => state.getLoanAnomalies);
  const getLoanReport = useAppStore((state) => state.getLoanReport);
  const industryTags = useAppStore((state) => state.industryTags);
  const maturityBuckets = useAppStore((state) => state.maturityBuckets);
  const riskRatings = useAppStore((state) => state.riskRatings);
  const guarantees = useAppStore((state) => state.guarantees);
  const loans = useAppStore((state) => state.loans);

  if (!dataPoint) return null;

  const industryName = industryTags.find((i) => i.code === dataPoint.industryCode)?.name || '未知';
  const maturityName = maturityBuckets.find((m) => m.code === dataPoint.maturityCode)?.name || '未知';
  const riskRating = riskRatings.find((r) => r.code === dataPoint.riskRatingCode);

  const pointLoans = loans.filter((l) => dataPoint.loans.includes(l.id));

  const handleLoanClick = (loan: Loan) => {
    selectLoan(loan.id === selectedLoanId ? null : loan.id);
  };

  const selectedLoan = loans.find((l) => l.id === selectedLoanId);
  const selectedReport = selectedLoanId ? getLoanReport(selectedLoanId) : undefined;
  const selectedAnomalies = selectedLoanId ? getLoanAnomalies(selectedLoanId) : [];
  const selectedGuarantees = selectedLoanId
    ? guarantees.filter((g) => g.loanId === selectedLoanId)
    : [];

  return (
    <div className="absolute right-0 top-0 h-full w-96 bg-slate-800/95 backdrop-blur-xl border-l border-slate-700/50 flex flex-col shadow-2xl z-20">
      <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">峰值详情</h3>
          <div className="text-xs text-slate-400 mt-0.5">
            {industryName} · {maturityName} · {dataPoint.riskRatingCode}级
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-slate-700/50 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      <div className="p-4 border-b border-slate-700/50">
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="敞口总额"
            value={`${(dataPoint.totalPrincipal / 10000).toFixed(0)}万`}
            color="cyan"
          />
          <StatCard
            icon={<FileText className="w-4 h-4" />}
            label="贷款笔数"
            value={`${dataPoint.loanCount}笔`}
            color="blue"
          />
          <StatCard
            icon={<AlertTriangle className="w-4 h-4" />}
            label="平均风险"
            value={`${dataPoint.avgRiskLevel.toFixed(1)}`}
            color="amber"
          />
        </div>

        <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: hexToRgba(getRiskColor(dataPoint.avgRiskLevel), 0.15) }}>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getRiskColor(dataPoint.avgRiskLevel) }}
            />
            <span className="text-sm font-medium" style={{ color: getRiskColor(dataPoint.avgRiskLevel) }}>
              风险等级: {riskRating?.name} ({getRiskLabel(dataPoint.avgRiskLevel)})
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h4 className="text-sm font-semibold text-slate-200 mb-3">贷款列表 ({pointLoans.length})</h4>
          <div className="space-y-2">
            {pointLoans.map((loan) => {
              const anomalies = getLoanAnomalies(loan.id);
              const hasAnomaly = anomalies.length > 0;
              const isSelected = loan.id === selectedLoanId;

              return (
                <div
                  key={loan.id}
                  onClick={() => handleLoanClick(loan)}
                  className={cn(
                    'p-3 rounded-lg border cursor-pointer transition-all',
                    isSelected
                      ? 'bg-cyan-500/15 border-cyan-500/50'
                      : 'bg-slate-700/30 border-slate-600/50 hover:border-slate-500'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-medium text-white">{loan.customerName}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{loan.loanNo}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono text-cyan-400">
                        {(loan.principal / 10000).toFixed(0)}万
                      </div>
                      <div
                        className="text-xs font-mono mt-0.5"
                        style={{ color: getRiskColor(riskRatings.find(r => r.code === loan.riskRatingCode)?.riskLevel || 5) }}
                      >
                        {loan.riskRatingCode}
                      </div>
                    </div>
                  </div>
                  {hasAnomaly && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs text-amber-400">
                        {anomalies.length}个异常标记
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {selectedLoan && selectedReport && (
          <div className="p-4 border-t border-slate-700/50 bg-slate-900/50">
            <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              风险报告 - {selectedLoan.customerName}
            </h4>

            <ReportSection title="原始值" value={selectedReport.rawValue} type="raw" />
            {selectedReport.adjustedValue !== selectedReport.rawValue && (
              <ReportSection
                title="修正值"
                value={selectedReport.adjustedValue}
                type="adjusted"
                reason={selectedReport.adjustReason}
              />
            )}
            <ReportSection title="最终结论" value={selectedReport.conclusion} type="conclusion" />

            {selectedAnomalies.length > 0 && (
              <div className="mt-4">
                <h5 className="text-xs font-medium text-slate-300 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  异常标记 ({selectedAnomalies.length})
                </h5>
                <div className="space-y-2">
                  {selectedAnomalies.map((anomaly) => (
                    <AnomalyItem key={anomaly.id} anomaly={anomaly} />
                  ))}
                </div>
              </div>
            )}

            {selectedGuarantees.length > 0 && (
              <div className="mt-4">
                <h5 className="text-xs font-medium text-slate-300 mb-2 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-blue-400" />
                  担保信息 ({selectedGuarantees.length})
                </h5>
                <div className="space-y-1.5">
                  {selectedGuarantees.map((guarantee) => (
                    <div
                      key={guarantee.id}
                      className={cn(
                        'text-xs p-2 rounded',
                        guarantee.isRepeated
                          ? 'bg-red-500/10 border border-red-500/30'
                          : 'bg-slate-700/30'
                      )}
                    >
                      <div className="flex justify-between">
                        <span className="text-slate-300">
                          {getGuaranteeTypeLabel(guarantee.type)}
                        </span>
                        <span className="text-slate-400 font-mono">
                          {(guarantee.amount / 10000).toFixed(0)}万
                        </span>
                      </div>
                      <div className="text-slate-500 mt-0.5">{guarantee.guarantor}</div>
                      {guarantee.isRepeated && (
                        <div className="text-red-400 mt-1 text-[10px]">⚠ 担保重复风险</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'cyan' | 'blue' | 'amber' | 'green' | 'red';
}) {
  const colorClasses: Record<string, string> = {
    cyan: 'text-cyan-400 bg-cyan-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    green: 'text-green-400 bg-green-500/10',
    red: 'text-red-400 bg-red-500/10',
  };

  return (
    <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs opacity-80">{label}</span>
      </div>
      <div className="text-lg font-bold font-mono">{value}</div>
    </div>
  );
}

function ReportSection({
  title,
  value,
  type,
  reason,
}: {
  title: string;
  value: string;
  type: 'raw' | 'adjusted' | 'conclusion';
  reason?: string;
}) {
  const config = {
    raw: {
      border: 'border-slate-600',
      bg: 'bg-slate-700/20',
      titleColor: 'text-slate-400',
    },
    adjusted: {
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/10',
      titleColor: 'text-amber-400',
    },
    conclusion: {
      border: 'border-green-500/30',
      bg: 'bg-green-500/10',
      titleColor: 'text-green-400',
    },
  };

  const style = config[type];

  return (
    <div className={`mb-3 p-3 rounded-lg border ${style.border} ${style.bg}`}>
      <div className={`text-xs font-medium mb-1.5 ${style.titleColor}`}>
        {title}
      </div>
      <div className="text-sm text-white">{value}</div>
      {reason && (
        <div className="mt-2 text-xs text-slate-400 border-t border-slate-600/50 pt-2">
          修正原因: {reason}
        </div>
      )}
    </div>
  );
}

function AnomalyItem({ anomaly }: { anomaly: AnomalyMark }) {
  const severityColor = anomaly.severity === 3 ? 'red' : anomaly.severity === 2 ? 'amber' : 'yellow';

  return (
    <div
      className={`p-2.5 rounded-lg border border-${severityColor}-500/30 bg-${severityColor}-500/10`}
      style={{
        borderColor: anomaly.severity === 3 ? 'rgba(239, 68, 68, 0.3)' : anomaly.severity === 2 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(234, 179, 8, 0.3)',
        backgroundColor: anomaly.severity === 3 ? 'rgba(239, 68, 68, 0.1)' : anomaly.severity === 2 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(234, 179, 8, 0.1)',
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className="text-xs font-medium"
          style={{
            color: anomaly.severity === 3 ? '#EF4444' : anomaly.severity === 2 ? '#F59E0B' : '#EAB308',
          }}
        >
          {getAnomalyTypeLabel(anomaly.type)}
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: anomaly.severity === 3 ? 'rgba(239, 68, 68, 0.2)' : anomaly.severity === 2 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(234, 179, 8, 0.2)',
            color: anomaly.severity === 3 ? '#EF4444' : anomaly.severity === 2 ? '#F59E0B' : '#EAB308',
          }}
        >
          {getSeverityLabel(anomaly.severity)}
        </span>
      </div>
      <p className="text-xs text-slate-300">{anomaly.description}</p>
      {anomaly.resolved && (
        <div className="mt-1 text-[10px] text-green-400">✓ 已解决</div>
      )}
    </div>
  );
}
