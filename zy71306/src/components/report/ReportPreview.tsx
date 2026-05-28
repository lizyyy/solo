import { useCalibrationStore } from '../../store/calibrationStore';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { FileText, Download, FileJson, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ReportPreview() {
  const {
    generatedReport,
    exportReportPDF,
    exportReportHTML,
    isExporting,
    records,
    lastError,
  } = useCalibrationStore();
  const navigate = useNavigate();

  if (!generatedReport) {
    return (
      <Card title="校准报告">
        <div className="text-center py-16 text-walnut-400">
          <FileText size={64} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">暂无报告</p>
          <p className="text-sm mt-2">从历史记录中选择记录生成报告</p>
          <Button className="mt-6" onClick={() => navigate('/')}>
            <ArrowLeft size={18} />
            返回校准
          </Button>
        </div>
      </Card>
    );
  }

  const selectedRecords = records.filter((r) =>
    generatedReport.recordIds.includes(r.id)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-brass-300">{generatedReport.title}</h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/')}>
            <ArrowLeft size={18} />
            返回
          </Button>
          <Button onClick={() => exportReportPDF()} loading={isExporting}>
            <Download size={18} />
            导出 PDF
          </Button>
          <Button variant="secondary" onClick={() => exportReportHTML()}>
            <FileJson size={18} />
            导出 HTML
          </Button>
        </div>
      </div>

      {lastError && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <AlertTriangle size={20} className="text-amber-500 flex-shrink-0" />
          <p className="text-amber-400 text-sm">{lastError}</p>
        </div>
      )}

      {generatedReport.hasErrors && (
        <div className="flex items-center gap-2 p-4 bg-danger-500/10 border border-danger-500/30 rounded-lg">
          <AlertTriangle size={24} className="text-danger-500 flex-shrink-0" />
          <div>
            <p className="text-danger-400 font-bold">⚠ 报告包含严重问题</p>
            <p className="text-danger-300 text-sm">请仔细阅读问题汇总和调校建议</p>
          </div>
        </div>
      )}

      <Card>
        <div className="space-y-6">
          <div className="text-center pb-4 border-b border-brass-500/20">
            <h3 className="text-xl font-bold text-brass-300 mb-2">{generatedReport.subtitle}</h3>
            <p className="text-walnut-400">摘要: {generatedReport.summary}</p>
          </div>

          {generatedReport.sections.map((section, index) => (
            <div key={index} className="space-y-2">
              <h4 className="text-lg font-semibold text-brass-400 border-b border-walnut-700 pb-2">
                {section.title}
              </h4>
              {section.type === 'image' ? (
                <div className="rounded-lg overflow-hidden border border-walnut-600">
                  <img src={section.content} alt="" className="w-full h-auto" />
                </div>
              ) : (
                <div className="text-walnut-200 whitespace-pre-wrap text-sm leading-relaxed">
                  {section.content}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
