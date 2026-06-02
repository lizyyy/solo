import { useShelterStore } from '../store/shelterStore';
import { ShelterStatus, shelterStatusLabels } from '../types';
import { generateReportSummary } from '../utils/nlGenerator';
import { exportToPDF, exportToExcel, printReport } from '../utils/export';

export function useReport() {
  const { shelters, records } = useShelterStore();

  const processed = shelters.filter(s => s.status === ShelterStatus.PROCESSED);
  const pending = shelters.filter(s => s.status === ShelterStatus.PENDING_VERIFY);
  const onsite = shelters.filter(s => s.status === ShelterStatus.ONSITE_CHECK);

  const totalCapacity = shelters.reduce((sum, s) => sum + s.designCapacity, 0);
  const totalReported = shelters.reduce((sum, s) => sum + s.reportedCount, 0);

  const summary = generateReportSummary(
    processed.length,
    pending.length,
    onsite.length,
    totalCapacity,
    totalReported
  );

  const reportData = {
    summary,
    processed,
    pending,
    onsite,
    allRecords: records,
    generatedAt: new Date().toLocaleString('zh-CN'),
    reportTitle: '应急避难场所容量月度报告',
    reportPeriod: '2026年6月'
  };

  const handleExportPDF = async () => {
    await exportToPDF('report-content', `应急避难场所容量报告_${new Date().toISOString().slice(0, 10)}`);
  };

  const handleExportExcel = () => {
    exportToExcel(shelters, records, `应急避难场所容量清单_${new Date().toISOString().slice(0, 10)}`);
  };

  const handlePrint = () => {
    printReport('report-content');
  };

  return {
    reportData,
    processed,
    pending,
    onsite,
    handleExportPDF,
    handleExportExcel,
    handlePrint
  };
}
