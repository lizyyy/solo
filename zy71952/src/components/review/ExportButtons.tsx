import { FileSpreadsheet, FileText } from 'lucide-react';
import { useRecordStore } from '../../store/useRecordStore';
import { exportToExcel, exportToPDF } from '../../utils/export';
import { cn } from '../../utils/status';

export function ExportButtons() {
  const { isChecklistComplete, generateReviewReport, resetChecklist } = useRecordStore();
  const canExport = isChecklistComplete();

  const handleExportExcel = () => {
    if (!canExport) return;
    const report = generateReviewReport();
    exportToExcel(report);
    resetChecklist();
  };

  const handleExportPDF = () => {
    if (!canExport) return;
    const report = generateReviewReport();
    exportToPDF(report);
    resetChecklist();
  };

  return (
    <div className="flex gap-3">
      <button
        onClick={handleExportExcel}
        disabled={!canExport}
        className={cn(
          'flex items-center gap-2 px-4 py-2 border text-sm font-medium transition-colors',
          canExport
            ? 'border-primary-500 bg-primary-500 text-white hover:bg-primary-600 cursor-pointer'
            : 'border-mono-300 bg-mono-100 text-mono-400 cursor-not-allowed'
        )}
      >
        <FileSpreadsheet size={16} />
        导出 Excel
      </button>
      <button
        onClick={handleExportPDF}
        disabled={!canExport}
        className={cn(
          'flex items-center gap-2 px-4 py-2 border text-sm font-medium transition-colors',
          canExport
            ? 'border-farm-500 bg-farm-500 text-white hover:bg-farm-600 cursor-pointer'
            : 'border-mono-300 bg-mono-100 text-mono-400 cursor-not-allowed'
        )}
      >
        <FileText size={16} />
        导出 PDF
      </button>
    </div>
  );
}
