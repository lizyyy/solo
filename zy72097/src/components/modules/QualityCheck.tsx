import React from 'react';
import AlertCard from '../common/AlertCard';
import { AlertTriangle, Database, AlertCircle, Copy, Layers, Activity } from 'lucide-react';
import type { QualityIssue } from '../../types';

interface QualityCheckProps {
  issues: QualityIssue[];
  onJumpToRow: (dataId: string) => void;
}

const QualityCheck: React.FC<QualityCheckProps> = ({ issues, onJumpToRow }) => {
  const totalCount = issues.length;
  const nullCount = issues.filter(i => i.type === 'null').length;
  const duplicateCount = issues.filter(i => i.type === 'duplicate').length;
  const unitMismatchCount = issues.filter(i => i.type === 'unit_mismatch').length;
  const anomalyCount = issues.filter(i => i.type === 'anomaly').length;

  const stats = [
    { label: '总条数', value: totalCount, icon: Database, color: 'text-engineering-600', bg: 'bg-engineering-50', border: 'border-engineering-200' },
    { label: '空值数量', value: nullCount, icon: AlertCircle, color: 'text-warning-600', bg: 'bg-warning-50', border: 'border-warning-200' },
    { label: '重复数量', value: duplicateCount, icon: Copy, color: 'text-historical-600', bg: 'bg-historical-50', border: 'border-historical-200' },
    { label: '单位混用', value: unitMismatchCount, icon: Layers, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    { label: '异常值数量', value: anomalyCount, icon: Activity, color: 'text-danger-600', bg: 'bg-danger-50', border: 'border-danger-200' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-engineering-700" />
        <h2 className="text-lg font-serif-cn font-semibold text-engineering-800">数据质量检查汇总</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={`card ${stat.bg} ${stat.border} border p-4 transition-all duration-200 hover:shadow-engineering-hover`}
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs text-engineering-600 font-medium">{stat.label}</span>
            </div>
            <p className={`text-2xl font-mono-num font-bold ${stat.color}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-engineering-700">问题列表</h3>
          <span className="text-xs text-engineering-500">共 {totalCount} 条问题</span>
        </div>

        {totalCount === 0 ? (
          <div className="card p-8 text-center">
            <Activity className="w-12 h-12 text-engineering-300 mx-auto mb-3" />
            <p className="text-engineering-500">数据质量良好，未发现问题</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto scrollbar-thin pr-1">
            {issues.map((issue, index) => (
              <AlertCard
                key={`${issue.dataId}-${issue.type}-${index}`}
                issue={issue}
                onJumpToRow={onJumpToRow}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QualityCheck;
