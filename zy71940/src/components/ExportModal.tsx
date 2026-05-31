import { FileText, FileJson, Download, Eye, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { Modal } from './Modal';
import { useAppStore } from '@/store/useAppStore';
import { generateBriefingData } from '@/services/exportService';
import { formatDateTime } from '@/utils/timeUtils';
import type { BriefingData } from '@/types';

export function ExportModal() {
  const isOpen = useAppStore(state => state.isExportModalOpen);
  const closeModal = useAppStore(state => state.closeExportModal);
  const { windows, conflicts, view } = useAppStore();
  const exportBriefing = useAppStore(state => state.exportBriefing);
  
  const [previewData, setPreviewData] = useState<BriefingData | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleGeneratePreview = () => {
    const data = generateBriefingData(windows, conflicts, view);
    setPreviewData(data);
  };

  const handleExport = (format: 'PDF' | 'JSON') => {
    setIsExporting(true);
    
    setTimeout(() => {
      exportBriefing(format);
      setIsExporting(false);
      setIsSuccess(true);
      
      setTimeout(() => {
        setIsSuccess(false);
        closeModal();
        setPreviewData(null);
      }, 1500);
    }, 500);
  };

  const handleClose = () => {
    closeModal();
    setPreviewData(null);
    setIsSuccess(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="导出任务简报">
      <div className="space-y-6">
        <div className="p-4 bg-space-800 rounded border border-tech-cyan/20">
          <h4 className="text-sm font-medium text-tech-cyan mb-3">当前视图范围</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">开始时间</span>
              <span className="text-white font-mono">{formatDateTime(view.startTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">结束时间</span>
              <span className="text-white font-mono">{formatDateTime(view.endTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">缩放比例</span>
              <span className="text-white">{(view.zoom * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-space-800 rounded border border-tech-cyan/20">
          <h4 className="text-sm font-medium text-tech-cyan mb-3">导出内容统计</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-2 bg-space-900 rounded">
              <div className="text-gray-400 text-xs">窗口总数</div>
              <div className="text-white text-lg font-mono">
                {generateBriefingData(windows, conflicts, view).summary.totalWindows}
              </div>
            </div>
            <div className="p-2 bg-space-900 rounded">
              <div className="text-gray-400 text-xs">冲突数</div>
              <div className="text-tech-red text-lg font-mono">
                {generateBriefingData(windows, conflicts, view).conflicts.length}
              </div>
            </div>
          </div>
        </div>

        {previewData && (
          <div className="p-4 bg-space-800 rounded border border-tech-green/30 max-h-60 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={16} className="text-tech-green" />
              <h4 className="text-sm font-medium text-tech-green">简报预览</h4>
            </div>
            <div className="space-y-2 text-xs">
              <div className="text-gray-400">生成时间: {formatDateTime(previewData.generatedAt)}</div>
              <div className="text-gray-400">
                窗口: {previewData.summary.normalCount}正常 / {previewData.summary.conflictCount}冲突 / {previewData.summary.resolvedCount}已解决
              </div>
              <div className="mt-2 text-gray-300">
                {previewData.windows.slice(0, 3).map(w => (
                  <div key={w.id} className="py-1 border-b border-tech-cyan/10">
                    {w.satelliteName} - {formatDateTime(w.startTime)}
                  </div>
                ))}
                {previewData.windows.length > 3 && (
                  <div className="text-gray-500 py-1">...还有 {previewData.windows.length - 3} 个窗口</div>
                )}
              </div>
            </div>
          </div>
        )}

        {isSuccess && (
          <div className="text-center py-4">
            <CheckCircle size={48} className="mx-auto text-tech-green mb-2" />
            <p className="text-tech-green font-medium">导出成功！</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={handleGeneratePreview}
            className="w-full btn-tech"
            disabled={isExporting || isSuccess}
          >
            <Eye size={16} className="inline mr-2" />
            生成预览
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={() => handleExport('JSON')}
              disabled={isExporting || isSuccess}
              className="flex-1 btn-tech btn-warning disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileJson size={16} className="inline mr-2" />
              导出 JSON
            </button>
            <button
              onClick={() => handleExport('PDF')}
              disabled={isExporting || isSuccess}
              className="flex-1 btn-tech btn-success disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText size={16} className="inline mr-2" />
              导出 PDF
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-500 text-center">
          任务简报将包含当前屏幕视图范围内的所有窗口和冲突信息
        </p>
      </div>
    </Modal>
  );
}
