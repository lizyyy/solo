import React, { useState } from 'react';
import { Download, FileText, Table, FileJson, Loader2 } from 'lucide-react';
import { ReportExporter, type ReportData } from '@/utils/reportExporter';

interface ExportButtonProps {
  data: ReportData | ReportData[];
  comparisonTitle?: string;
  disabled?: boolean;
  onExport?: (format: string) => void;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  data,
  comparisonTitle,
  disabled = false,
  onExport
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (format: 'pdf' | 'xlsx' | 'json') => {
    if (disabled) return;
    setExporting(format);

    try {
      if (Array.isArray(data)) {
        if (format === 'xlsx') {
          const blob = ReportExporter.exportToExcel(data);
          const filename = comparisonTitle
            ? ReportExporter.generateComparisonFilename(comparisonTitle, 'xlsx')
            : `批量导出_${new Date().toISOString().slice(0, 10)}.xlsx`;
          ReportExporter.downloadBlob(blob, filename);
        } else if (format === 'pdf' && comparisonTitle) {
          const blob = await ReportExporter.generateComparisonReport({
            tasks: data,
            title: comparisonTitle
          });
          const filename = ReportExporter.generateComparisonFilename(comparisonTitle, 'pdf');
          ReportExporter.downloadBlob(blob, filename);
        } else {
          const blob = ReportExporter.exportToJSON(data);
          const filename = `批量导出_${new Date().toISOString().slice(0, 10)}.json`;
          ReportExporter.downloadBlob(blob, filename);
        }
      } else {
        let blob: Blob;
        let filename: string;

        switch (format) {
          case 'pdf':
            blob = await ReportExporter.exportToPDF(data);
            filename = ReportExporter.generateReportFilename(data.task, 'pdf');
            break;
          case 'xlsx':
            blob = ReportExporter.exportToExcel([data]);
            filename = ReportExporter.generateReportFilename(data.task, 'xlsx');
            break;
          case 'json':
            blob = ReportExporter.exportToJSON(data);
            filename = ReportExporter.generateReportFilename(data.task, 'json');
            break;
        }

        ReportExporter.downloadBlob(blob, filename);
      }

      onExport?.(format);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(null);
      setIsOpen(false);
    }
  };

  const formats = [
    { key: 'pdf' as const, label: 'PDF 报告', icon: FileText, desc: '适合打印分享' },
    { key: 'xlsx' as const, label: 'Excel 表格', icon: Table, desc: '适合数据处理' },
    { key: 'json' as const, label: 'JSON 数据', icon: FileJson, desc: '适合程序导入' }
  ];

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || !!exporting}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
          disabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
        }`}
      >
        {exporting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        {exporting ? '导出中...' : '导出报告'}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 z-20 overflow-hidden">
            <div className="p-2">
              {formats.map((format) => (
                <button
                  key={format.key}
                  onClick={() => handleExport(format.key)}
                  disabled={!!exporting}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
                >
                  <div className={`p-1.5 rounded-lg ${
                    format.key === 'pdf' ? 'bg-red-100 text-red-600' :
                    format.key === 'xlsx' ? 'bg-green-100 text-green-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    <format.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-800">{format.label}</div>
                    <div className="text-xs text-gray-500">{format.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
