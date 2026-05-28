import { useRef } from 'react';
import { StressHeatmap } from '@/components/StressChart/StressHeatmap';
import { TemperatureCurve } from '@/components/StressChart/TemperatureCurve';
import { StressDetailTable } from '@/components/StressChart/StressDetailTable';
import { usePrintStore } from '@/store/usePrintStore';
import { getMaterialById } from '@/data/materials';
import { exportChartAsImage, exportReportAsJSON } from '@/utils/exportUtils';
import { Download, FileJson, AlertTriangle, Thermometer, Layers, Droplets } from 'lucide-react';

export default function StressAnalysis() {
  const { currentBatch, currentResult, suggestions, applySuggestion } = usePrintStore();
  const heatmapChartRef = useRef<any>(null);
  const curveChartRef = useRef<any>(null);

  const material = currentBatch ? getMaterialById(currentBatch.materialId) : null;

  const handleExportHeatmap = () => {
    if (heatmapChartRef.current) {
      exportChartAsImage(heatmapChartRef.current, 'stress-heatmap');
    }
  };

  const handleExportCurve = () => {
    if (curveChartRef.current) {
      exportChartAsImage(curveChartRef.current, 'temperature-curve');
    }
  };

  const handleExportJson = () => {
    if (currentBatch && currentResult) {
      exportReportAsJSON({
        batchId: currentBatch.id,
        generatedAt: new Date().toISOString(),
        analysisSummary: {
          material: material?.name || '未知',
          riskLevel: currentResult.riskLevel,
          stressScore: currentResult.stressRiskScore,
          shrinkageRate: currentResult.shrinkageRate,
          keyIssues: currentResult.validationErrors.map((e) => e.message),
        },
        corrections: [],
        issues: [],
      }, 'stress-report');
    }
  };

  const getRiskBadgeClass = (level: string) => {
    const classes: Record<string, string> = {
      low: 'bg-green-500/20 text-green-400 border-green-500/50',
      medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      high: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
      critical: 'bg-red-500/20 text-red-400 border-red-500/50',
    };
    return classes[level] || 'bg-gray-500/20 text-gray-400 border-gray-500/50';
  };

  const getRiskLabel = (level: string) => {
    const labels: Record<string, string> = {
      low: '低风险',
      medium: '中风险',
      high: '高风险',
      critical: '极高风险',
    };
    return labels[level] || '未知';
  };

  if (!currentBatch) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center text-gray-500">
          <div className="text-6xl mb-4">📊</div>
          <div className="text-xl mb-2">请先选择或创建一个批次</div>
          <div className="text-sm">前往参数录入页面开始分析</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">应力分析</h2>
          <p className="text-sm text-gray-400">批次 #{currentBatch.id.slice(-6)}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportHeatmap}
            disabled={!currentResult}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            导出热力图
          </button>
          <button
            onClick={handleExportCurve}
            disabled={!currentResult}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            导出温度曲线
          </button>
          <button
            onClick={handleExportJson}
            disabled={!currentResult}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
          >
            <FileJson className="w-4 h-4" />
            导出报告
          </button>
        </div>
      </div>

      {currentResult && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <AlertTriangle className="w-4 h-4" />
              总体风险等级
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-bold border ${getRiskBadgeClass(
                  currentResult.riskLevel,
                )}`}
              >
                {getRiskLabel(currentResult.riskLevel)}
              </span>
              <span className="text-2xl font-bold text-white">
                {currentResult.stressRiskScore.toFixed(1)}
              </span>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <Layers className="w-4 h-4" />
              热收缩率
            </div>
            <div className="text-2xl font-bold text-white">
              {(currentResult.shrinkageRate * 100).toFixed(3)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              基于 {material?.name || '未知材料'} 热膨胀系数
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <Thermometer className="w-4 h-4" />
              最大温差
            </div>
            <div className="text-2xl font-bold text-white">
              {currentResult.temperatureDiff.toFixed(1)}°C
            </div>
            <div className="text-xs text-gray-500 mt-1">
              喷嘴 {currentBatch.nozzleTemp}°C → 环境 {currentBatch.ambientTemp}°C
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <Droplets className="w-4 h-4" />
              冷却速度
            </div>
            <div className="text-2xl font-bold text-white">
              {currentBatch.coolingFanSpeed}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {currentBatch.coolingFanSpeed > 70 ? '快速冷却，风险较高' : currentBatch.coolingFanSpeed > 40 ? '中等冷却速度' : '缓慢冷却，风险较低'}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StressHeatmap
          stressDistribution={currentResult?.stressDistribution || []}
          onChartReady={(chart) => {
            heatmapChartRef.current = chart;
          }}
        />
        <TemperatureCurve
          temperatureCurve={currentResult?.temperatureCurve || []}
          onChartReady={(chart) => {
            curveChartRef.current = chart;
          }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StressDetailTable stressDistribution={currentResult?.stressDistribution || []} />

        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
          <h4 className="text-sm font-medium text-gray-300 mb-3">优化建议</h4>
          {suggestions && suggestions.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {suggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-700/50 rounded-lg border border-slate-600"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-medium text-white">
                        {suggestion.parameter} 调整建议
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {suggestion.description}
                      </div>
                      <div className="text-xs text-blue-400 mt-1">
                        建议值: {suggestion.recommendedValue}
                      </div>
                      <div className="text-xs text-green-400 mt-1">
                        预期改善: {(suggestion.expectedImprovement * 100).toFixed(1)}% 风险降低
                      </div>
                    </div>
                    <button
                      onClick={() => applySuggestion(suggestion)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition-colors"
                    >
                      应用
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <div className="text-4xl mb-2">✅</div>
              <div>暂无优化建议</div>
              <div className="text-sm">当前参数设置良好</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
