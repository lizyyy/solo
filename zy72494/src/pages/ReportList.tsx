import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { FileText, ChevronRight, User } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import DateDisplay from '../components/DateDisplay';

export default function ReportList() {
  const navigate = useNavigate();
  const { reports, complaints } = useAppStore();

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="报告中心"
        subtitle="查看和管理所有整改报告，每份报告都附有详细的原因分析和责任人"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report) => {
          const complaint = complaints.find((c) => c.id === report.complaintId);
          return (
            <div
              key={report.id}
              className="card p-6 card-hover cursor-pointer"
              onClick={() => navigate(`/reports/${report.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-xl bg-primary-50">
                  <FileText className="w-6 h-6 text-primary-700" />
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300" />
              </div>
              <h3 className="mt-4 font-semibold text-gray-900">
                {complaint?.title || '整改报告'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {report.suggestions.length} 条整改建议 · {report.materialList.length} 项材料
              </p>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="w-4 h-4" />
                  {report.generatedBy}
                </div>
                <span className="text-xs text-gray-400">
                  <DateDisplay date={report.generatedAt} formatStr="MM-dd HH:mm" />
                </span>
              </div>
            </div>
          );
        })}

        {reports.length === 0 && (
          <div className="col-span-full text-center py-20">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">暂无报告</p>
            <p className="text-sm text-gray-400 mt-1">在投诉详情页可生成整改报告</p>
          </div>
        )}
      </div>
    </div>
  );
}
