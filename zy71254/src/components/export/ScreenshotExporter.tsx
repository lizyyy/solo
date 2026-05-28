import { useState, useRef } from 'react';
import { Camera, Download, Share2, FileText } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

interface ScreenshotExporterProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export const ScreenshotExporter = ({ canvasRef }: ScreenshotExporterProps) => {
  const { addScreenshot, authorName, currentWindowWidth, currentWindowCenter, slices, selectedSliceId } =
    useAppStore();
  const [isExporting, setIsExporting] = useState(false);
  const [description, setDescription] = useState('');
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg'>('png');

  const selectedSlice = slices.find((s) => s.id === selectedSliceId);

  const handleCapture = () => {
    if (!canvasRef.current) return;

    setIsExporting(true);

    setTimeout(() => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dataUrl = canvas.toDataURL(
          exportFormat === 'png' ? 'image/png' : 'image/jpeg',
          0.95
        );

        const visibleSliceIndices = slices
          .filter((s) => s.isVisible)
          .map((s) => s.index);

        addScreenshot({
          imageData: dataUrl,
          description: description || `3D视图截图 - ${new Date().toLocaleString('zh-CN')}`,
          author: authorName,
          sliceIndices: visibleSliceIndices,
          windowSettings: {
            width: currentWindowWidth,
            center: currentWindowCenter,
          },
        });

        setDescription('');
        setShowExportPanel(false);
      } catch (error) {
        console.error('截图失败:', error);
      } finally {
        setIsExporting(false);
      }
    }, 100);
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL(
      exportFormat === 'png' ? 'image/png' : 'image/jpeg',
      0.95
    );

    const link = document.createElement('a');
    link.download = `mri-screenshot-${Date.now()}.${exportFormat}`;
    link.href = dataUrl;
    link.click();
  };

  const handleExportReport = () => {
    const reportContent = `
MRI 3D 工作台 - 导出报告
=====================================

导出时间: ${new Date().toLocaleString('zh-CN')}
操作用户: ${authorName}

窗宽/窗位设置:
- 窗宽 (WW): ${currentWindowWidth}
- 窗位 (WL): ${currentWindowCenter}

切片信息:
- 总切片数: ${slices.length}
- 当前选中: ${selectedSlice ? `#${selectedSlice.index.toString().padStart(2, '0')}` : '无'}
- 有错误切片: ${slices.filter((s) => s.hasError).length}
- 有标注切片: ${slices.filter((s) => s.id).length}

当前截图描述: ${description || '无'}

=====================================
此报告由 MRI 3D 工作台自动生成
    `.trim();

    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `mri-report-${Date.now()}.txt`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm rounded-xl p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-cyan-400 font-semibold text-sm flex items-center gap-2">
          <Camera className="w-4 h-4" />
          截图导出
        </h3>
        <button
          onClick={() => setShowExportPanel(!showExportPanel)}
          className={`p-1.5 rounded-lg transition-all ${
            showExportPanel
              ? 'bg-cyan-500 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          <Camera className="w-4 h-4" />
        </button>
      </div>

      {showExportPanel && (
        <div className="space-y-3">
          <div>
            <label className="text-slate-400 text-xs mb-1 block">截图描述</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入截图描述..."
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-slate-400 text-xs mb-2 block">导出格式</label>
            <div className="flex gap-2">
              <button
                onClick={() => setExportFormat('png')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs transition-all ${
                  exportFormat === 'png'
                    ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-400'
                    : 'bg-slate-700 border border-slate-600 text-slate-400 hover:bg-slate-600'
                }`}
              >
                PNG
              </button>
              <button
                onClick={() => setExportFormat('jpeg')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs transition-all ${
                  exportFormat === 'jpeg'
                    ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-400'
                    : 'bg-slate-700 border border-slate-600 text-slate-400 hover:bg-slate-600'
                }`}
              >
                JPEG
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCapture}
              disabled={isExporting || !canvasRef.current}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-cyan-500 text-white rounded-lg text-xs font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Share2 className="w-3 h-3" />
              保存到相册
            </button>
            <button
              onClick={handleDownload}
              disabled={!canvasRef.current}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3 h-3" />
              下载文件
            </button>
          </div>

          <button
            onClick={handleExportReport}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-700/50 text-slate-400 rounded-lg text-xs font-medium hover:bg-slate-700 hover:text-slate-300 transition-colors border border-slate-600"
          >
            <FileText className="w-3 h-3" />
            导出文字报告
          </button>
        </div>
      )}

      {!showExportPanel && (
        <div className="text-xs text-slate-500">
          <p>当前设置:</p>
          <div className="flex gap-4 mt-1">
            <span>WW: <span className="text-slate-400">{currentWindowWidth}</span></span>
            <span>WL: <span className="text-slate-400">{currentWindowCenter}</span></span>
          </div>
        </div>
      )}
    </div>
  );
};
