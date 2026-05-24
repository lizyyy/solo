import { useState, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { getMaterialById } from '@/data/materials';
import { generateReportData, exportToPDF, exportToJSON, captureScreenshot } from '@/utils/export';
import { formatVolume, formatWeight } from '@/utils/volume';
import { X, FileText, Download, Image, FileJson, Loader2 } from 'lucide-react';

export function ReportModal() {
  const { showReportModal, setShowReportModal, boundaries, activeBatchId, batches } = useStore();
  const [isExporting, setIsExporting] = useState(false);
  const [screenshot, setScreenshot] = useState<string>('');
  const [hasScreenshot, setHasScreenshot] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const activeBatch = batches.find(b => b.id === activeBatchId);
  const batchName = activeBatch?.name || '当前盘点';

  const totalVolume = boundaries.reduce((sum, b) => sum + (b.volume || 0), 0);
  const totalWeight = boundaries.reduce((sum, b) => sum + (b.weight || 0), 0);

  const handleCaptureScreenshot = async () => {
    setIsExporting(true);
    setShowReportModal(false);

    setTimeout(async () => {
      const dataUrl = await captureScreenshot('viewer-container');
      setScreenshot(dataUrl);
      setHasScreenshot(true);
      setShowReportModal(true);
      setIsExporting(false);
    }, 500);
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const report = generateReportData(
        batchName,
        activeBatchId || 'current',
        boundaries,
        screenshot || undefined
      );
      await exportToPDF(report);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('PDF导出失败，请重试');
    }
    setIsExporting(false);
  };

  const handleExportJSON = () => {
    const report = generateReportData(
      batchName,
      activeBatchId || 'current',
      boundaries
    );
    exportToJSON(report);
  };

  if (!showReportModal) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col m-4">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-white font-semibold text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            导出盘点报告
          </h2>
          <button
            onClick={() => setShowReportModal(false)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div ref={previewRef} className="flex-1 overflow-y-auto p-6">
          <div className="bg-white rounded-lg p-6 text-slate-800">
            <h1 className="text-xl font-bold text-center mb-2">料场堆体体积盘点报告</h1>
            <p className="text-center text-sm text-slate-500 mb-4">
              生成时间: {new Date().toLocaleString('zh-CN')}
            </p>
            <p className="text-center text-sm text-slate-500 mb-6">
              盘点批次: {batchName}
            </p>

            {hasScreenshot && screenshot && (
              <div className="mb-6">
                <img
                  src={screenshot}
                  alt="3D视图截图"
                  className="w-full rounded-lg border border-slate-200"
                  style={{ maxHeight: '200px', objectFit: 'cover' }}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-sm text-slate-500">总体积</div>
                <div className="text-xl font-bold text-blue-600">
                  {formatVolume(totalVolume)}
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-sm text-slate-500">总重量</div>
                <div className="text-xl font-bold text-green-600">
                  {formatWeight(totalWeight)}
                </div>
              </div>
            </div>

            <h3 className="font-semibold mb-3">料堆明细</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 font-medium">料堆名称</th>
                  <th className="text-left py-2 font-medium">物料类型</th>
                  <th className="text-right py-2 font-medium">体积(m³)</th>
                  <th className="text-right py-2 font-medium">重量(吨)</th>
                </tr>
              </thead>
              <tbody>
                {boundaries.map(b => {
                  const material = getMaterialById(b.materialId);
                  return (
                    <tr key={b.id} className="border-b border-slate-100">
                      <td className="py-2">{b.name}</td>
                      <td className="py-2">{material?.name || '未知'}</td>
                      <td className="text-right py-2">{(b.volume || 0).toFixed(2)}</td>
                      <td className="text-right py-2">{(b.weight || 0).toFixed(2)}</td>
                    </tr>
                  );
                })}
                <tr className="font-semibold">
                  <td colSpan={2} className="py-2">合计</td>
                  <td className="text-right py-2">{totalVolume.toFixed(2)}</td>
                  <td className="text-right py-2">{totalWeight.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 border-t border-slate-700 flex items-center justify-between">
          <button
            onClick={handleCaptureScreenshot}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
          >
            <Image className="w-4 h-4" />
            截取3D视图
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJSON}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
            >
              <FileJson className="w-4 h-4" />
              导出JSON
            </button>
            <button
              onClick={handleExportPDF}
              disabled={isExporting || boundaries.length === 0}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              导出PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
