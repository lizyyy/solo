import { useDataStore } from '@/store/useDataStore';
import { StatusBadge } from '@/components/common/StatusBadge';
import { RISK_LABELS, FIELD_UNITS } from '@/config/thresholds';
import {
  FileText,
  ThermometerSun,
  Flame,
  AlertTriangle,
  Activity,
  Calendar,
  User,
} from 'lucide-react';
import { formatDateTime } from '@/utils/csvParser';

export function ReportSummary() {
  const { records, currentAnalysis, dataQualityReport } = useDataStore();

  if (!currentAnalysis || records.length === 0) {
    return null;
  }

  const riskColor = {
    low: 'success',
    medium: 'warning',
    high: 'danger',
  } as const;

  const timeRange = records.length > 0
    ? `${formatDateTime(records[0].timestamp)} - ${formatDateTime(records[records.length - 1].timestamp)}`
    : '';

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-400" />
          分析报告摘要
        </h3>
        <StatusBadge type={riskColor[currentAnalysis.riskLevel]}>
          {RISK_LABELS[currentAnalysis.riskLevel]}
        </StatusBadge>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
            <Calendar className="w-4 h-4" />
            检测时间
          </div>
          <div className="text-slate-200 text-sm">{formatDateTime(new Date())}</div>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
            <Activity className="w-4 h-4" />
            数据时段
          </div>
          <div className="text-slate-200 text-xs">{timeRange}</div>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
            <User className="w-4 h-4" />
            分析人员
          </div>
          <div className="text-slate-200 text-sm">设备工程师 何工</div>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
            <ThermometerSun className="w-4 h-4" />
            样本数量
          </div>
          <div className="text-slate-200 text-sm font-mono">{records.length} 条</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-emerald-400 text-sm mb-2">
            <ThermometerSun className="w-4 h-4" />
            平均温度（排除极端值）
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {currentAnalysis.meanTemperature.toFixed(1)}
            <span className="text-sm font-normal ml-1">{FIELD_UNITS.temperature}</span>
          </div>
          <div className="text-xs text-slate-500 mt-2 line-through">
            含极端值: {currentAnalysis.meanTemperatureWithExtremes.toFixed(1)}{FIELD_UNITS.temperature}
          </div>
        </div>

        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-400 text-sm mb-2">
            <Flame className="w-4 h-4" />
            极端值数量
          </div>
          <div className="text-2xl font-bold text-red-400 font-mono">
            {currentAnalysis.extremeCount}
            <span className="text-sm font-normal ml-1">条</span>
          </div>
          <div className="text-xs text-slate-500 mt-2">
            已从平均值计算中排除
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-400 text-sm mb-2">
            <AlertTriangle className="w-4 h-4" />
            数据质量问题
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">
            {dataQualityReport
              ? dataQualityReport.nullCount +
                dataQualityReport.duplicateCount +
                dataQualityReport.boundaryCount
              : 0}
            <span className="text-sm font-normal ml-1">条</span>
          </div>
          <div className="text-xs text-slate-500 mt-2">
            空值 {dataQualityReport?.nullCount || 0} · 重复 {dataQualityReport?.duplicateCount || 0} · 边界 {dataQualityReport?.boundaryCount || 0}
          </div>
        </div>
      </div>
    </div>
  );
}
