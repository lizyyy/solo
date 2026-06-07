import { Link } from 'react-router-dom';
import { Clock, FileText, AlertTriangle } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';
import type { ConfidenceReport } from '../../types';

interface ReportCardProps {
  report: ConfidenceReport;
  bucketName: string;
}

export function ReportCard({ report, bucketName }: ReportCardProps) {
  return (
    <Link
      to={`/report/${report.id}`}
      className="block bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg hover:border-slate-300 transition-all duration-300 group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-slate-800 group-hover:text-slate-900 transition-colors font-serif">
            {report.name}
          </h3>
          <p className="text-sm text-slate-500 mt-1">关联：{bucketName}</p>
        </div>
        <StatusBadge status={report.status} type="report" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <FileText size={14} />
          <span>当前版本：{report.currentVersion}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock size={14} />
          <span>更新时间：{report.updateTime}</span>
        </div>
      </div>

      {report.hasTimeWindowIssue && (
        <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-100">
          <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
          <span className="text-xs text-amber-700">存在时间窗穿越问题，待实验平台复核</span>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">三步流程</span>
          <div className="flex gap-1">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`w-6 h-1.5 rounded-full ${
                  step <= report.workflowStep ? 'bg-emerald-500' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}
