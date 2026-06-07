import { useReportStore } from '../store/useReportStore';
import { ReportCard } from '../components/report/ReportCard';
import { FileBarChart, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

export function ReportList() {
  const { reports, getBucketById } = useReportStore();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 font-serif">置信度校准报告</h1>
          <p className="text-sm text-slate-500 mt-1">管理所有实验的置信度校准分析报告</p>
        </div>
        <Link
          to="/import"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium"
        >
          <Plus size={18} />
          导入实验桶
        </Link>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
            <FileBarChart size={32} className="text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-700 mb-2">暂无报告</h3>
          <p className="text-sm text-slate-500 mb-4">导入线上实验桶以创建置信度校准报告</p>
          <Link
            to="/import"
            className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-500 transition-colors text-sm"
          >
            <Plus size={16} />
            立即导入
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {reports.map((report) => {
            const bucket = getBucketById(report.bucketId);
            return (
              <ReportCard
                key={report.id}
                report={report}
                bucketName={bucket?.name || '未知实验桶'}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
