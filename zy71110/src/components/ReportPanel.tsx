import { useStore } from '../store/useStore';
import { presetScenarios } from '../utils/presets';
import { exportReportAsPDF, exportReportAsJSON, exportScreenshot } from '../utils/export';
import { FileText, Download, Image, FileJson, AlertTriangle, CheckCircle } from 'lucide-react';
import { useState } from 'react';

interface ReportPanelProps {
  canvas: HTMLCanvasElement | null;
}

export function ReportPanel({ canvas }: ReportPanelProps) {
  const coverageResult = useStore((state) => state.coverageResult);
  const environment = useStore((state) => state.environment);
  const sprinklers = useStore((state) => state.sprinklers);
  const field = useStore((state) => state.field);
  const currentPresetId = useStore((state) => state.currentPresetId);
  const [isExporting, setIsExporting] = useState(false);

  const scenarioName = presetScenarios.find((p) => p.id === currentPresetId)?.name || '自定义场景';

  const handleExportPDF = async () => {
    if (!coverageResult) return;
    setIsExporting(true);
    try {
      await exportReportAsPDF({
        coverageResult,
        environment,
        sprinklers,
        field,
        scenarioName,
        timestamp: new Date(),
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJSON = () => {
    if (!coverageResult) return;
    exportReportAsJSON({
      coverageResult,
      environment,
      sprinklers,
      field,
      scenarioName,
      timestamp: new Date(),
    });
  };

  const handleExportScreenshot = () => {
    if (!canvas) return;
    exportScreenshot(canvas, scenarioName);
  };

  if (!coverageResult) {
    return (
      <div className="w-72 bg-white shadow-lg p-4">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="h-24 bg-gray-200 rounded mb-4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const coveragePercent = (coverageResult.coverageRate * 100).toFixed(1);
  const isGoodCoverage = coverageResult.coverageRate >= 0.9;

  return (
    <div className="w-72 bg-white shadow-lg overflow-y-auto">
      <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <FileText size={20} />
          覆盖分析报告
        </h2>
        <p className="text-sm text-blue-100 mt-1">{scenarioName}</p>
      </div>

      <div className="p-4">
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">覆盖率</span>
            {isGoodCoverage ? (
              <span className="flex items-center gap-1 text-green-600 text-sm">
                <CheckCircle size={16} />
                良好
              </span>
            ) : (
              <span className="flex items-center gap-1 text-red-500 text-sm">
                <AlertTriangle size={16} />
                需优化
              </span>
            )}
          </div>

          <div className="relative w-full h-4 bg-gray-200 rounded-full overflow-hidden mb-3">
            <div
              className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${isGoodCoverage ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ width: `${coveragePercent}%` }}
            ></div>
          </div>

          <div className="text-center">
            <span className="text-3xl font-bold text-gray-800">{coveragePercent}%</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-xs text-blue-600 mb-1">覆盖面积</p>
            <p className="text-lg font-bold text-blue-700">
              {coverageResult.coveredArea.toFixed(1)}
              <span className="text-sm font-normal ml-1">m²</span>
            </p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <p className="text-xs text-red-600 mb-1">漏浇面积</p>
            <p className="text-lg font-bold text-red-700">
              {coverageResult.missedArea.toFixed(1)}
              <span className="text-sm font-normal ml-1">m²</span>
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-600 mb-1">总面积</p>
            <p className="text-lg font-bold text-gray-700">
              {coverageResult.totalArea.toFixed(1)}
              <span className="text-sm font-normal ml-1">m²</span>
            </p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <p className="text-xs text-purple-600 mb-1">喷头数量</p>
            <p className="text-lg font-bold text-purple-700">{sprinklers.length}</p>
          </div>
        </div>

        {coverageResult.missedZones.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm font-medium text-red-800 mb-2 flex items-center gap-2">
              <AlertTriangle size={16} />
              发现 {coverageResult.missedZones.length} 个漏浇区域
            </p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {coverageResult.missedZones.slice(0, 5).map((zone, i) => (
                <div key={i} className="text-xs text-red-700 flex justify-between">
                  <span>
                    {zone.type === 'corner' ? '边角' : '间隙'}区域{i + 1}
                  </span>
                  <span>{zone.area.toFixed(1)} m²</span>
                </div>
              ))}
              {coverageResult.missedZones.length > 5 && (
                <p className="text-xs text-red-500">...还有 {coverageResult.missedZones.length - 5} 个区域</p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Download size={16} />
            导出报告
          </p>
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="w-full py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <FileText size={16} />
            {isExporting ? '导出中...' : '导出 PDF 报告'}
          </button>
          <button
            onClick={handleExportJSON}
            className="w-full py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            <FileJson size={16} />
            导出 JSON 数据
          </button>
          <button
            onClick={handleExportScreenshot}
            disabled={!canvas}
            className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Image size={16} />
            导出场景截图
          </button>
        </div>
      </div>
    </div>
  );
}
