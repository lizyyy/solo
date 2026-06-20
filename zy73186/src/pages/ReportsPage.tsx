import React, { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Search, Filter } from 'lucide-react';
import { ReportPreview } from '@/components/reports/ReportPreview';
import { Button } from '@/components/common/Button';
import { useReportGenerator } from '@/hooks/useReportGenerator';
import { useSessionStore } from '@/stores/useSessionStore';
import { useMaterialStore } from '@/stores/useMaterialStore';
import { useComputationStore } from '@/stores/useComputationStore';
import { useAuditStore } from '@/stores/useAuditStore';
import { shortHash } from '@/utils/hash';

const ReportsPage: React.FC = () => {
  const { reports, generateReport, loadAllReports, downloadReport } = useReportGenerator();
  const { sessions, currentSession, loadAllSessions } = useSessionStore();
  const { materials } = useMaterialStore();
  const { steps } = useComputationStore();
  const { auditLogs } = useAuditStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadAllSessions();
    loadAllReports();
  }, [loadAllSessions, loadAllReports]);

  const filteredReports = reports.filter((report) =>
    searchQuery
      ? report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.id.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  const handleGenerateReport = async (sessionId?: string) => {
    const targetSessionId = sessionId || currentSession?.id;
    if (!targetSessionId) return;

    setIsGenerating(true);
    try {
      const session = sessions.find((s) => s.id === targetSessionId);
      const sessionMaterials = materials.filter((m) => m.sessionId === targetSessionId);
      const sessionSteps = steps.filter((s) => s.sessionId === targetSessionId);
      const sessionAuditLogs = auditLogs.filter((l) => l.sessionId === targetSessionId);

      if (!session || sessionMaterials.length === 0 || sessionSteps.length === 0) {
        alert('会话数据不完整，无法生成报告');
        return;
      }

      await generateReport(
        session,
        sessionMaterials,
        sessionSteps,
        sessionAuditLogs,
        '现场老师'
      );
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('生成报告失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleViewDetail = (reportId: string) => {
    window.location.href = `/reports/${reportId}`;
  };

  const urlParams = new URLSearchParams(window.location.search);
  const autoGenerateSessionId = urlParams.get('sessionId');

  useEffect(() => {
    if (autoGenerateSessionId && sessions.length > 0) {
      const sessionExists = sessions.some((s) => s.id === autoGenerateSessionId);
      if (sessionExists) {
        handleGenerateReport(autoGenerateSessionId);
        window.history.replaceState({}, '', '/reports');
      }
    }
  }, [autoGenerateSessionId, sessions]);

  const sessionsWithData = sessions.filter((session) => {
    const hasMaterials = materials.some((m) => m.sessionId === session.id);
    const hasSteps = steps.some((s) => s.sessionId === session.id);
    const hasReport = reports.some((r) => r.sessionId === session.id);
    return hasMaterials && hasSteps && !hasReport;
  });

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <div className="sticky top-0 z-40 bg-[#0d1117]/95 backdrop-blur border-b border-[#4a5568] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => (window.location.href = '/')}
            >
              返回工作台
            </Button>
            <h1 className="font-mono text-xl text-[#e2e8f0] tracking-wide">报告中心</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#718096]" />
              <input
                type="text"
                placeholder="搜索报告..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-[#1a202c] border border-[#4a5568] rounded font-mono text-sm text-[#e2e8f0] focus:outline-none focus:border-[#3182ce] w-48"
              />
            </div>
            {sessionsWithData.length > 0 && (
              <Button
                variant="primary"
                size="sm"
                icon={<FileText className="w-4 h-4" />}
                onClick={() => handleGenerateReport()}
                loading={isGenerating}
              >
                生成新报告
              </Button>
            )}
          </div>
        </div>
      </div>

      <main className="p-6">
        <div className="max-w-6xl mx-auto">
          {sessionsWithData.length > 0 && (
            <div className="mb-6 p-4 bg-[#1a365d]/20 border border-[#3182ce]/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm text-[#e2e8f0] mb-1">
                    有 {sessionsWithData.length} 个会话可以生成报告
                  </p>
                  <p className="text-xs text-[#a0aec0]">
                    {sessionsWithData.slice(0, 3).map((s, i) => (
                      <span key={s.id} className="mr-2">
                        #{shortHash(s.id, 8)}
                        {i < Math.min(sessionsWithData.length, 3) - 1 && '、'}
                      </span>
                    ))}
                    {sessionsWithData.length > 3 && `等 ${sessionsWithData.length} 个`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {sessionsWithData.slice(0, 2).map((session) => (
                    <Button
                      key={session.id}
                      size="sm"
                      variant="secondary"
                      onClick={() => handleGenerateReport(session.id)}
                    >
                      生成 #{shortHash(session.id, 4)}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="mb-6 text-sm text-[#718096]">
            共 {filteredReports.length} 份报告
          </div>

          {filteredReports.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="w-12 h-12 text-[#4a5568] mx-auto mb-4" />
              <p className="font-mono text-[#718096]">暂无报告</p>
              <p className="font-mono text-xs text-[#4a5568] mt-1">
                完成计算后可在此处生成Markdown复核报告
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredReports.map((report) => (
                <div
                  key={report.id}
                  className="cursor-pointer"
                  onClick={() => handleViewDetail(report.id)}
                >
                  <ReportPreview
                    report={report}
                    onDownload={() => downloadReport(report, 'md')}
                    showFull={false}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ReportsPage;
