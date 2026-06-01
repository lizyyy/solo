import { useDataStore } from '@/store/useDataStore';
import { StatusBadge } from '@/components/common/StatusBadge';
import { AlertTriangle, FileWarning, Copy, MinusCircle, Flame, Activity } from 'lucide-react';

export function DataQualityCard() {
  const { dataQualityReport, records } = useDataStore();

  if (!dataQualityReport || records.length === 0) {
    return null;
  }

  const stats = [
    {
      label: '总记录数',
      value: dataQualityReport.totalRecords,
      icon: Activity,
      color: 'text-blue-400',
    },
    {
      label: '空值记录',
      value: dataQualityReport.nullCount,
      icon: MinusCircle,
      color: dataQualityReport.nullCount > 0 ? 'text-slate-400' : 'text-emerald-400',
    },
    {
      label: '重复记录',
      value: dataQualityReport.duplicateCount,
      icon: Copy,
      color: dataQualityReport.duplicateCount > 0 ? 'text-purple-400' : 'text-emerald-400',
    },
    {
      label: '边界记录',
      value: dataQualityReport.boundaryCount,
      icon: AlertTriangle,
      color: dataQualityReport.boundaryCount > 0 ? 'text-amber-400' : 'text-emerald-400',
    },
    {
      label: '极端值记录',
      value: dataQualityReport.extremeCount,
      icon: Flame,
      color: dataQualityReport.extremeCount > 0 ? 'text-red-400' : 'text-emerald-400',
    },
  ];

  const hasIssues =
    dataQualityReport.nullCount > 0 ||
    dataQualityReport.duplicateCount > 0 ||
    dataQualityReport.boundaryCount > 0 ||
    dataQualityReport.extremeCount > 0;

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
          <FileWarning className="w-5 h-5 text-amber-400" />
          数据质量检查
        </h3>
        {hasIssues ? (
          <StatusBadge type="warning">存在 {
            dataQualityReport.nullCount +
            dataQualityReport.duplicateCount +
            dataQualityReport.boundaryCount +
            dataQualityReport.extremeCount
          } 条异常记录</StatusBadge>
        ) : (
          <StatusBadge type="success">数据质量良好</StatusBadge>
        )}
      </div>

      <div className="grid grid-cols-5 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="text-center p-4 bg-slate-900/50 rounded-lg">
              <Icon className={`w-6 h-6 mx-auto mb-2 ${stat.color}`} />
              <div className={`text-2xl font-bold mb-1 ${stat.color}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {stat.value}
              </div>
              <div className="text-xs text-slate-400">{stat.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
