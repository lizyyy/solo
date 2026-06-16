import { useStore } from '@/store/useStore';
import { useFilteredData } from '@/hooks/useFilteredData';
import { exportReportCSV, exportDetailCSV, downloadCSV } from '@/utils/export';
import { Download, CheckCircle2 } from 'lucide-react';

export default function ExportPanel() {
  const { filteredSamples, filteredChains, filteredIssues } = useFilteredData();
  const reviews = useStore((s) => s.reviews);
  const caliberLabel = useStore((s) => s.caliberLabel);

  const handleExportReport = () => {
    const content = exportReportCSV(filteredSamples, filteredChains, filteredIssues, reviews, caliberLabel);
    downloadCSV(content, `发车间隔优化报告_${new Date().toLocaleDateString('zh-CN')}.csv`);
  };

  const handleExportDetail = () => {
    const content = exportDetailCSV(filteredSamples, filteredChains, filteredIssues, caliberLabel);
    downloadCSV(content, `发车间隔优化明细_${new Date().toLocaleDateString('zh-CN')}.csv`);
  };

  return (
    <div className="rounded-xl bg-white shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Download className="h-5 w-5 text-[#0F4C5C]" />
        <h3 className="text-sm font-bold text-gray-900">导出</h3>
      </div>

      <div className="flex items-center gap-2 mb-3 text-xs">
        <span className="text-gray-500">当前口径：</span>
        <span className="font-medium text-gray-700">{caliberLabel}</span>
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <span className="text-green-600">口径一致</span>
      </div>

      <div className="flex gap-2 mb-3">
        <button
          onClick={handleExportReport}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#0F4C5C] text-white hover:bg-[#0d3f4d] transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          导出报告
        </button>
        <button
          onClick={handleExportDetail}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#0F4C5C] text-white hover:bg-[#0d3f4d] transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          导出明细
        </button>
      </div>

      <p className="text-xs text-gray-400">报告与明细数据同源，口径一致</p>
    </div>
  );
}
