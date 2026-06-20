import React, { useEffect, useState } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { ReportPreview } from '@/components/reports/ReportPreview';
import { Button } from '@/components/common/Button';
import { useReportGenerator } from '@/hooks/useReportGenerator';
import type { Report } from '@/types';

const ReportDetailPage: React.FC = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const { reports, loadAllReports, downloadReport } = useReportGenerator();
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    loadAllReports();
  }, [loadAllReports]);

  useEffect(() => {
    if (reportId && reports.length > 0) {
      const found = reports.find((r) => r.id === reportId);
      setReport(found || null);
    }
  }, [reportId, reports]);

  if (!report) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-12 h-12 text-[#4a5568] mx-auto mb-4" />
          <p className="font-mono text-[#718096]">加载报告中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <div className="sticky top-0 z-40 bg-[#0d1117]/95 backdrop-blur border-b border-[#4a5568] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => (window.location.href = '/reports')}
            >
              返回报告列表
            </Button>
            <h1 className="font-mono text-xl text-[#e2e8f0] tracking-wide">
              {report.title}
            </h1>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => downloadReport(report, 'md')}
          >
            下载 Markdown
          </Button>
        </div>
      </div>

      <main className="p-6">
        <div className="max-w-5xl mx-auto">
          <ReportPreview report={report} showFull={true} />
        </div>
      </main>
    </div>
  );
};

export default ReportDetailPage;
