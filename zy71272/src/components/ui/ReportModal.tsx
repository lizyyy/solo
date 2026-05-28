import { useState, useRef, useEffect } from 'react';
import { RehearsalReport } from '../../types';
import {
  X,
  Download,
  FileText,
  Music,
  Mic,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Volume2,
  Calendar,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getIssueTypeLabel, getIssueIcon } from '../../utils/sceneDetection';
import { getIssueSeverityColor, formatDate, roundTo } from '../../utils/helpers';
import { INSTRUMENT_LABELS, INSTRUMENT_COLORS } from '../../utils/constants';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function ReportModal() {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [report, setReport] = useState<RehearsalReport | null>(null);

  const plan = useStore(state => state.plan);
  const musicians = useStore(state => state.musicians);
  const monitorPoints = useStore(state => state.monitorPoints);
  const roomConfig = useStore(state => state.roomConfig);
  const sceneIssues = useStore(state => state.sceneIssues);
  const uiState = useStore(state => state.uiState);
  const setShowReportModal = useStore(state => state.setShowReportModal);
  const generateReport = useStore(state => state.generateReport);
  const saveReport = useStore(state => state.saveReport);

  const reportGeneratedRef = useRef(false);

  useEffect(() => {
    if (uiState.showReportModal && plan && !reportGeneratedRef.current) {
      setReport(generateReport());
      reportGeneratedRef.current = true;
    }
    if (!uiState.showReportModal) {
      setReport(null);
      reportGeneratedRef.current = false;
    }
  }, [uiState.showReportModal, plan, generateReport]);

  if (!uiState.showReportModal || !plan || !report) return null;

  const errorCount = sceneIssues.filter(i => i.severity === 'error').length;
  const warningCount = sceneIssues.filter(i => i.severity === 'warning').length;

  const handleExportPDF = async () => {
    if (!reportRef.current || !report) return;
    setIsExporting(true);

    try {
      saveReport(report);

      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#0a0e17',
        scale: 2,
        useCORS: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 0;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`${plan.name}_排练报告_${formatDate(new Date())}.pdf`);
    } catch (error) {
      console.error('导出PDF失败:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportImage = async () => {
    if (!reportRef.current || !report) return;
    setIsExporting(true);

    try {
      saveReport(report);

      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#0a0e17',
        scale: 2,
        useCORS: true,
      });

      const link = document.createElement('a');
      link.download = `${plan.name}_排练报告_${formatDate(new Date())}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('导出图片失败:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#00ff88';
    if (score >= 60) return '#ff6b35';
    return '#ff3366';
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm">
      <div className="bg-[#121a29] border border-[#00f0ff]/30 rounded-2xl w-[900px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3a4a6b]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff3366] to-[#ff6b35] flex items-center justify-center">
              <FileText size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">排练报告</h2>
              <p className="text-sm text-[#8899aa]">{plan.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportImage}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00f0ff]/20 text-[#00f0ff] hover:bg-[#00f0ff]/30 border border-[#00f0ff]/50 transition-all disabled:opacity-50"
            >
              <Download size={16} />
              <span className="text-sm">导出图片</span>
            </button>
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#ff3366]/20 to-[#ff6b35]/20 text-[#ff6b35] hover:from-[#ff3366]/30 hover:to-[#ff6b35]/30 border border-[#ff6b35]/50 transition-all disabled:opacity-50"
            >
              <FileText size={16} />
              <span className="text-sm">导出PDF</span>
            </button>
            <button
              onClick={() => setShowReportModal(false)}
              className="p-2 rounded-lg text-[#8899aa] hover:text-white hover:bg-[#3a4a6b] transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div ref={reportRef} className="space-y-6">
            <div className="bg-gradient-to-r from-[#00f0ff]/10 to-[#ff3366]/10 rounded-xl p-6 border border-[#00f0ff]/20">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="flex items-center gap-4 text-sm text-[#8899aa]">
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {formatDate(plan.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Music size={14} />
                      {musicians.length} 名乐手
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin size={14} />
                      {monitorPoints.length} 个监听点
                    </span>
                  </div>
                </div>
                <div className="text-center">
                  <div
                    className="text-5xl font-bold mb-1"
                    style={{ color: getScoreColor(report.overallScore) }}
                  >
                    {report.overallScore}
                  </div>
                  <div className="text-sm text-[#8899aa]">综合评分</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#0a0e17] rounded-xl p-4 border border-[#3a4a6b]">
                <div className="flex items-center gap-2 mb-2">
                  <Volume2 size={18} className="text-[#00f0ff]" />
                  <span className="text-white font-medium">声场平衡</span>
                </div>
                <div
                  className="text-3xl font-bold"
                  style={{ color: getScoreColor(report.volumeBalanceScore) }}
                >
                  {report.volumeBalanceScore}
                </div>
                <div className="w-full h-2 bg-[#1a2535] rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${report.volumeBalanceScore}%`,
                      backgroundColor: getScoreColor(report.volumeBalanceScore),
                    }}
                  />
                </div>
              </div>

              <div className="bg-[#0a0e17] rounded-xl p-4 border border-[#3a4a6b]">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={18} className="text-[#ff3366]" />
                  <span className="text-white font-medium">严重问题</span>
                </div>
                <div className={`text-3xl font-bold ${errorCount > 0 ? 'text-[#ff3366]' : 'text-[#00ff88]'}`}>
                  {errorCount}
                </div>
                <p className="text-xs text-[#8899aa] mt-2">
                  {errorCount === 0 ? '无严重问题' : '需要立即调整'}
                </p>
              </div>

              <div className="bg-[#0a0e17] rounded-xl p-4 border border-[#3a4a6b]">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={18} className="text-[#ff6b35]" />
                  <span className="text-white font-medium">警告项</span>
                </div>
                <div className={`text-3xl font-bold ${warningCount > 0 ? 'text-[#ff6b35]' : 'text-[#00ff88]'}`}>
                  {warningCount}
                </div>
                <p className="text-xs text-[#8899aa] mt-2">
                  {warningCount === 0 ? '配置良好' : '建议优化'}
                </p>
              </div>
            </div>

            <div className="bg-[#0a0e17] rounded-xl p-5 border border-[#3a4a6b]">
              <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                <Music size={18} className="text-[#00f0ff]" />
                乐手配置
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {musicians.map(musician => (
                  <div key={musician.id} className="flex items-center gap-3 p-3 bg-[#121a29] rounded-lg">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${INSTRUMENT_COLORS[musician.type]}30` }}
                    >
                      <span style={{ color: INSTRUMENT_COLORS[musician.type] }}>🎵</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium text-sm">{musician.name}</div>
                      <div className="text-xs text-[#8899aa]">
                        {INSTRUMENT_LABELS[musician.type]} · {musician.sourceLevel}dB
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-[#8899aa]">位置</div>
                      <div className="text-xs text-white font-mono">
                        ({roundTo(musician.position.x, 1)}, {roundTo(musician.position.z, 1)})
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#0a0e17] rounded-xl p-5 border border-[#3a4a6b]">
              <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                <MapPin size={18} className="text-[#ff6b35]" />
                监听点声压级
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {monitorPoints.map(mp => {
                  const spl = report.monitorReadings[mp.id] || 0;
                  return (
                    <div key={mp.id} className="flex items-center gap-3 p-3 bg-[#121a29] rounded-lg">
                      <div className="w-10 h-10 rounded-lg bg-[#ff6b35]/20 flex items-center justify-center">
                        <MapPin size={18} className="text-[#ff6b35]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium text-sm">{mp.name}</div>
                        <div className="text-xs text-[#8899aa]">
                          位置: ({roundTo(mp.position.x, 1)}, {roundTo(mp.position.z, 1)})
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold" style={{ color: spl >= 60 ? '#00ff88' : '#ff6b35' }}>
                          {spl.toFixed(1)}
                        </div>
                        <div className="text-xs text-[#8899aa]">dB</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {sceneIssues.length > 0 && (
              <div className="bg-[#0a0e17] rounded-xl p-5 border border-[#ff3366]/30">
                <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                  <AlertTriangle size={18} className="text-[#ff3366]" />
                  检测到的问题 ({sceneIssues.length})
                </h4>
                <div className="space-y-2">
                  {sceneIssues.map((issue, index) => (
                    <div
                      key={issue.id}
                      className="flex items-start gap-3 p-3 bg-[#121a29] rounded-lg"
                      style={{ borderLeft: `3px solid ${getIssueSeverityColor(issue.severity)}` }}
                    >
                      <span className="text-lg">{getIssueIcon(issue.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="text-xs px-2 py-0.5 rounded font-medium"
                            style={{
                              backgroundColor: `${getIssueSeverityColor(issue.severity)}20`,
                              color: getIssueSeverityColor(issue.severity),
                            }}
                          >
                            {getIssueTypeLabel(issue.type)}
                          </span>
                          <span className="text-xs" style={{ color: getIssueSeverityColor(issue.severity) }}>
                            {issue.severity === 'error' ? '错误' : '警告'}
                          </span>
                        </div>
                        <p className="text-sm text-white">{issue.message}</p>
                        {issue.suggestion && (
                          <p className="text-xs text-[#8899aa] mt-1">💡 {issue.suggestion}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-[#0a0e17] rounded-xl p-5 border border-[#3a4a6b]">
              <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                <Mic size={18} className="text-[#00f0ff]" />
                房间信息
              </h4>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 bg-[#121a29] rounded-lg">
                  <div className="text-2xl font-bold text-[#00f0ff]">{roomConfig?.length}</div>
                  <div className="text-xs text-[#8899aa] mt-1">长度 (m)</div>
                </div>
                <div className="text-center p-3 bg-[#121a29] rounded-lg">
                  <div className="text-2xl font-bold text-[#ff6b35]">{roomConfig?.width}</div>
                  <div className="text-xs text-[#8899aa] mt-1">宽度 (m)</div>
                </div>
                <div className="text-center p-3 bg-[#121a29] rounded-lg">
                  <div className="text-2xl font-bold text-[#ff3366]">{roomConfig?.height}</div>
                  <div className="text-xs text-[#8899aa] mt-1">高度 (m)</div>
                </div>
                <div className="text-center p-3 bg-[#121a29] rounded-lg">
                  <div className="text-2xl font-bold text-[#00ff88]">
                    {(roomConfig ? roomConfig.length * roomConfig.width : 0).toFixed(0)}
                  </div>
                  <div className="text-xs text-[#8899aa] mt-1">面积 (m²)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
