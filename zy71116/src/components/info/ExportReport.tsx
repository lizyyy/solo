import { useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { downloadReport } from '../../utils/export';

export const ExportReport = () => {
  const { currentRoute, cameraState, filters, timelinePosition } = useAppStore();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!currentRoute) return;

    setIsExporting(true);
    try {
      await downloadReport(
        currentRoute,
        cameraState,
        filters,
        timelinePosition
      );
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (!currentRoute) return null;

  return (
    <div className="space-y-3">
      <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/50 space-y-2">
        <div className="text-xs text-gray-400">报告内容</div>
        <div className="space-y-1 text-xs text-gray-300">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>路线详细信息和途径节点</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span>坡度校验和设施状态检查</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            <span>当前筛选条件和相机视角</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span>时间轴位置和场景状态</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleExport}
        disabled={isExporting}
        className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            生成报告中...
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            导出路线报告
          </>
        )}
      </button>

      <div className="text-center text-xs text-gray-500">
        <FileText className="w-3 h-3 inline mr-1" />
        导出为 PDF 格式
      </div>
    </div>
  );
};
