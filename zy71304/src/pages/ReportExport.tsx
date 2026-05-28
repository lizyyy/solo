import { useState } from 'react';
import { usePrintStore } from '@/store/usePrintStore';
import { getMaterialById } from '@/data/materials';
import { exportChartAsImage, exportReportAsJSON, exportReportAsHTML } from '@/utils/exportUtils';
import {
  FileJson,
  FileCode,
  Image,
  Download,
  Copy,
  Check,
  AlertTriangle,
  FileText,
  Share2,
} from 'lucide-react';

export default function ReportExport() {
  const { currentBatch, currentResult, suggestions, issues } = usePrintStore();
  const [copied, setCopied] = useState(false);

  const material = currentBatch ? getMaterialById(currentBatch.materialId) : null;

  const batchIssues = currentBatch
    ? issues.filter((i) => i.batchId === currentBatch.id)
    : [];

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
        issues: batchIssues,
      }, 'stress-report');
    }
  };

  const handleExportHtml = () => {
    if (currentBatch && currentResult) {
      const reportData = {
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
        issues: batchIssues,
      };
      exportReportAsHTML(reportData, currentBatch, currentResult, suggestions, 'stress-report');
    }
  };

  const handleCopyToClipboard = async () => {
    if (!currentBatch || !currentResult) return;

    const reportText = `
3D打印翘曲热应力分析报告
==========================

批次信息:
- 批次ID: ${currentBatch.id}
- 创建时间: ${new Date(currentBatch.createdAt).toLocaleString()}
- 创建人: ${currentBatch.createdBy}
- 状态: ${currentBatch.status}

材料参数:
- 材料: ${material?.name || '未知'}
- 热膨胀系数: ${material?.thermalExpansionCoeff || 'N/A'} ×10^-6/°C
- 玻璃化转变温度: ${material?.glassTransitionTemp || 'N/A'}°C

打印参数:
- 床温: ${currentBatch.bedTemp}°C
- 喷嘴温度: ${currentBatch.nozzleTemp}°C
- 环境温度: ${currentBatch.ambientTemp}°C
- 模型尺寸: ${currentBatch.modelWidth}×${currentBatch.modelHeight}×${currentBatch.modelDepth} ${currentBatch.widthUnit}
- 冷却风扇速度: ${currentBatch.coolingFanSpeed}%
- 层高度: ${currentBatch.layerHeight}mm
- 打印速度: ${currentBatch.printSpeed}mm/s

分析结果:
- 风险等级: ${currentResult.riskLevel}
- 风险评分: ${currentResult.stressRiskScore.toFixed(1)}
- 热收缩率: ${(currentResult.shrinkageRate * 100).toFixed(3)}%
- 最大温差: ${currentResult.temperatureDiff.toFixed(1)}°C

问题检测:
- 检测到问题数: ${batchIssues.length}
- 已确认问题数: ${batchIssues.filter((i) => i.status === 'confirmed').length}
- 待处理问题数: ${batchIssues.filter((i) => i.status === 'discovered').length}

优化建议:
${suggestions.map((s, i) => `${i + 1}. ${s.parameter}: ${s.description} -> 建议值: ${s.recommendedValue}`).join('\n')}
    `.trim();

    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
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
          <div className="text-6xl mb-4">📄</div>
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
          <h2 className="text-xl font-bold text-white">报告导出</h2>
          <p className="text-sm text-gray-400">批次 #{currentBatch.id.slice(-6)}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCopyToClipboard}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {copied ? '已复制' : '复制报告'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">3D打印翘曲热应力分析报告</h3>
                <p className="text-sm text-gray-400">
                  生成时间: {new Date().toLocaleString()}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  分析摘要
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-slate-700/30 rounded-lg">
                    <div className="text-xs text-gray-400 mb-1">风险等级</div>
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-bold border ${getRiskBadgeClass(
                        currentResult?.riskLevel || 'low',
                      )}`}
                    >
                      {getRiskLabel(currentResult?.riskLevel || 'low')}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-700/30 rounded-lg">
                    <div className="text-xs text-gray-400 mb-1">风险评分</div>
                    <div className="text-xl font-bold text-white">
                      {currentResult?.stressRiskScore.toFixed(1) || '-'}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-700/30 rounded-lg">
                    <div className="text-xs text-gray-400 mb-1">热收缩率</div>
                    <div className="text-xl font-bold text-purple-400">
                      {currentResult ? `${(currentResult.shrinkageRate * 100).toFixed(3)}%` : '-'}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-700/30 rounded-lg">
                    <div className="text-xs text-gray-400 mb-1">检测问题</div>
                    <div className="text-xl font-bold text-orange-400">
                      {batchIssues.length}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-3">打印参数</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div className="p-2 bg-slate-700/30 rounded">
                    <span className="text-gray-500">材料:</span>
                    <span className="text-white ml-2">{material?.name || '未知'}</span>
                  </div>
                  <div className="p-2 bg-slate-700/30 rounded">
                    <span className="text-gray-500">床温:</span>
                    <span className="text-white ml-2">{currentBatch.bedTemp}°C</span>
                  </div>
                  <div className="p-2 bg-slate-700/30 rounded">
                    <span className="text-gray-500">喷嘴:</span>
                    <span className="text-white ml-2">{currentBatch.nozzleTemp}°C</span>
                  </div>
                  <div className="p-2 bg-slate-700/30 rounded">
                    <span className="text-gray-500">环境:</span>
                    <span className="text-white ml-2">{currentBatch.ambientTemp}°C</span>
                  </div>
                  <div className="p-2 bg-slate-700/30 rounded">
                    <span className="text-gray-500">尺寸:</span>
                    <span className="text-white ml-2">
                      {currentBatch.modelWidth}×{currentBatch.modelHeight}×{currentBatch.modelDepth}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-700/30 rounded">
                    <span className="text-gray-500">冷却:</span>
                    <span className="text-white ml-2">{currentBatch.coolingFanSpeed}%</span>
                  </div>
                </div>
              </div>

              {suggestions.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-3">优化建议</h4>
                  <div className="space-y-2">
                    {suggestions.map((suggestion, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg"
                      >
                        <div className="text-sm text-white font-medium">
                          {idx + 1}. {suggestion.parameter} 调整
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {suggestion.description}
                        </div>
                        <div className="text-xs text-blue-400 mt-1">
                          建议值: {suggestion.recommendedValue} | 预期改善: {(suggestion.expectedImprovement * 100).toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
              <Download className="w-4 h-4" />
              导出选项
            </h3>
            <div className="space-y-3">
              <button
                onClick={handleExportJson}
                disabled={!currentResult}
                className="w-full flex items-center gap-3 p-3 bg-slate-700/50 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <FileJson className="w-5 h-5 text-yellow-400" />
                <div className="text-left">
                  <div className="text-sm text-white">JSON 格式</div>
                  <div className="text-xs text-gray-500">包含完整分析数据</div>
                </div>
              </button>

              <button
                onClick={handleExportHtml}
                disabled={!currentResult}
                className="w-full flex items-center gap-3 p-3 bg-slate-700/50 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <FileCode className="w-5 h-5 text-blue-400" />
                <div className="text-left">
                  <div className="text-sm text-white">HTML 报告</div>
                  <div className="text-xs text-gray-500">可在浏览器中查看</div>
                </div>
              </button>

              <button
                onClick={handleCopyToClipboard}
                disabled={!currentResult}
                className="w-full flex items-center gap-3 p-3 bg-slate-700/50 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-400" />
                ) : (
                  <Share2 className="w-5 h-5 text-green-400" />
                )}
                <div className="text-left">
                  <div className="text-sm text-white">
                    {copied ? '已复制到剪贴板' : '复制文本报告'}
                  </div>
                  <div className="text-xs text-gray-500">纯文本格式</div>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
              <Image className="w-4 h-4" />
              图表导出
            </h3>
            <div className="space-y-3">
              <div className="p-3 bg-slate-700/30 rounded-lg">
                <div className="text-sm text-white mb-1">应力分布热力图</div>
                <div className="text-xs text-gray-500 mb-2">PNG / SVG 格式</div>
                <div className="text-xs text-blue-400">前往应力分析页面导出</div>
              </div>
              <div className="p-3 bg-slate-700/30 rounded-lg">
                <div className="text-sm text-white mb-1">温度梯度曲线</div>
                <div className="text-xs text-gray-500 mb-2">PNG / SVG 格式</div>
                <div className="text-xs text-blue-400">前往应力分析页面导出</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">报告说明</h3>
            <div className="text-xs text-gray-500 space-y-2">
              <p>• 本报告基于材料热收缩理论估算</p>
              <p>• 实际打印结果可能受环境因素影响</p>
              <p>• 建议结合实际打印情况参考分析结果</p>
              <p>• 所有数据保存在本地浏览器中</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
