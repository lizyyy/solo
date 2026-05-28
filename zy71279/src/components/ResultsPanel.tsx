import React, { useState } from 'react';
import { BarChart3, Radar, TrendingUp, Layers, Eye, Target } from 'lucide-react';
import type { ErrorAnalysis, PrintEstimation, ConstraintCheck, DetailedError, EstimationTask, Material, ViewMode } from '@/types';
import { ErrorDistributionChart, ScatterComparisonChart, RadarComparisonChart, TradeoffTrendChart } from './charts';
import { QualityIssueList } from './QualityIssueList';
import { ExportButton } from './ExportButton';
import { formatNumber, formatTime } from '@/utils/math';
import type { ReportData } from '@/utils/reportExporter';

interface ResultsPanelProps {
  task: EstimationTask | null;
  errorAnalysis: ErrorAnalysis | null;
  printEstimation: PrintEstimation | null;
  constraintChecks: ConstraintCheck[];
  qualityErrors: DetailedError[];
  material: Material | null;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  comparisonData?: ReportData[];
}

const viewModes: { key: ViewMode; label: string; icon: React.ElementType }[] = [
  { key: 'solid', label: '实体', icon: Layers },
  { key: 'wireframe', label: '线框', icon: Eye },
  { key: 'heatmap', label: '热力图', icon: Target }
];

export const ResultsPanel: React.FC<ResultsPanelProps> = ({
  task,
  errorAnalysis,
  printEstimation,
  constraintChecks,
  qualityErrors,
  material,
  viewMode,
  onViewModeChange,
  comparisonData = []
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'charts' | 'quality' | 'compare'>('overview');

  const reportData: ReportData | null = task && errorAnalysis ? {
    task,
    errorAnalysis,
    printEstimation: printEstimation || undefined,
    constraintChecks,
    material: material || undefined,
    qualityErrors
  } : null;

  const hasData = errorAnalysis !== null;

  const StatCard = ({ label, value, unit, color, icon: Icon }: {
    label: string;
    value: string | number;
    unit?: string;
    color: string;
    icon: React.ElementType;
  }) => (
    <div className={`p-4 rounded-xl ${color}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-600">{label}</span>
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-800">{value}</span>
        {unit && <span className="text-sm text-gray-500">{unit}</span>}
      </div>
    </div>
  );

  const tabs = [
    { key: 'overview' as const, label: '概览', icon: BarChart3 },
    { key: 'charts' as const, label: '图表', icon: TrendingUp },
    { key: 'quality' as const, label: '质量检查', icon: Target },
    { key: 'compare' as const, label: '多方案对比', icon: Radar }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">分析结果</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            {viewModes.map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.key}
                  onClick={() => onViewModeChange(mode.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    viewMode === mode.key
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {mode.label}
                </button>
              );
            })}
          </div>
          {reportData && (
            <ExportButton
              data={comparisonData.length > 1 ? comparisonData : reportData}
              comparisonTitle={comparisonData.length > 1 ? '多方案对比报告' : undefined}
              disabled={!hasData}
            />
          )}
        </div>
      </div>

      {!hasData ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">暂无分析结果</p>
          <p className="text-gray-300 text-sm mt-1">运行估计后结果将显示在这里</p>
        </div>
      ) : (
        <>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === tab.key
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === 'overview' && errorAnalysis && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                  label="最大误差"
                  value={errorAnalysis.maxError.toFixed(4)}
                  unit="mm"
                  color="bg-red-50"
                  icon={Target}
                />
                <StatCard
                  label="平均误差"
                  value={errorAnalysis.meanError.toFixed(4)}
                  unit="mm"
                  color="bg-amber-50"
                  icon={BarChart3}
                />
                <StatCard
                  label="标准差"
                  value={errorAnalysis.stdDeviation.toFixed(4)}
                  unit="mm"
                  color="bg-blue-50"
                  icon={TrendingUp}
                />
                <StatCard
                  label="模型体积"
                  value={errorAnalysis.volume.toFixed(2)}
                  unit="cm³"
                  color="bg-green-50"
                  icon={Layers}
                />
              </div>

              {printEstimation && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatCard
                    label="打印时间"
                    value={formatTime(printEstimation.printTimeHours)}
                    color="bg-purple-50"
                    icon={TrendingUp}
                  />
                  <StatCard
                    label="材料用量"
                    value={printEstimation.materialWeight.toFixed(1)}
                    unit="g"
                    color="bg-cyan-50"
                    icon={Layers}
                  />
                  <StatCard
                    label="材料成本"
                    value={`¥${printEstimation.materialCost.toFixed(2)}`}
                    color="bg-emerald-50"
                    icon={Target}
                  />
                  <StatCard
                    label="总成本"
                    value={`¥${printEstimation.totalCost.toFixed(2)}`}
                    color="bg-rose-50"
                    icon={BarChart3}
                  />
                </div>
              )}

              {task && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-medium text-gray-700 mb-3">任务信息</h4>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">模型:</span>
                      <span className="ml-2 font-medium text-gray-800">{task.modelName}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">原始面数:</span>
                      <span className="ml-2 font-mono text-gray-800">{formatNumber(task.originalFaces, 0)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">简化后面数:</span>
                      <span className="ml-2 font-mono text-gray-800">{formatNumber(task.simplifiedFaces, 0)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">简化比例:</span>
                      <span className="ml-2 font-medium text-gray-800">
                        {(task.simplificationRatio * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">材料:</span>
                      <span className="ml-2 font-medium text-gray-800">{material?.name || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">层厚:</span>
                      <span className="ml-2 font-medium text-gray-800">{task.layerHeight} mm</span>
                    </div>
                    <div>
                      <span className="text-gray-500">填充率:</span>
                      <span className="ml-2 font-medium text-gray-800">{task.infillRate}%</span>
                    </div>
                    <div>
                      <span className="text-gray-500">误差阈值:</span>
                      <span className="ml-2 font-medium text-gray-800">{task.errorThreshold} mm</span>
                    </div>
                  </div>
                </div>
              )}

              {errorAnalysis && (
                <div className="rounded-xl border border-gray-200 p-4">
                  <h4 className="font-medium text-gray-700 mb-3">误差分布</h4>
                  <ErrorDistributionChart errorAnalysis={errorAnalysis} height={250} />
                </div>
              )}
            </div>
          )}

          {activeTab === 'charts' && errorAnalysis && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-gray-200 p-4">
                  <h4 className="font-medium text-gray-700 mb-3">误差 vs 面数</h4>
                  <ScatterComparisonChart
                    data={comparisonData.length > 0 ? comparisonData : [{
                      task: task!,
                      errorAnalysis,
                      printEstimation: printEstimation || undefined,
                      material: material || undefined
                    }]}
                    height={300}
                    xAxis="faceCount"
                    yAxis="maxError"
                  />
                </div>
                <div className="rounded-xl border border-gray-200 p-4">
                  <h4 className="font-medium text-gray-700 mb-3">成本 vs 面数</h4>
                  <ScatterComparisonChart
                    data={comparisonData.length > 0 ? comparisonData : [{
                      task: task!,
                      errorAnalysis,
                      printEstimation: printEstimation || undefined,
                      material: material || undefined
                    }]}
                    height={300}
                    xAxis="faceCount"
                    yAxis="cost"
                  />
                </div>
              </div>

              {comparisonData.length >= 2 && (
                <>
                  <div className="rounded-xl border border-gray-200 p-4">
                    <h4 className="font-medium text-gray-700 mb-3">多维度对比雷达图</h4>
                    <RadarComparisonChart data={comparisonData} height={350} />
                  </div>
                  <div className="rounded-xl border border-gray-200 p-4">
                    <h4 className="font-medium text-gray-700 mb-3">误差-时间-成本权衡曲线</h4>
                    <TradeoffTrendChart data={comparisonData} height={350} />
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'quality' && (
            <div className="rounded-xl border border-gray-200 p-4">
              <QualityIssueList
                qualityErrors={qualityErrors}
                constraintChecks={constraintChecks}
              />
            </div>
          )}

          {activeTab === 'compare' && (
            <div className="space-y-4">
              {comparisonData.length < 2 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                  <Radar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-400">请选择至少2个任务进行对比</p>
                  <p className="text-gray-300 text-sm mt-1">在历史记录中勾选多个任务后查看对比</p>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-gray-200 p-4">
                    <h4 className="font-medium text-gray-700 mb-3">方案对比雷达图</h4>
                    <RadarComparisonChart data={comparisonData} height={400} />
                  </div>
                  <div className="rounded-xl border border-gray-200 p-4">
                    <h4 className="font-medium text-gray-700 mb-3">权衡趋势曲线</h4>
                    <TradeoffTrendChart data={comparisonData} height={350} />
                  </div>
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-gray-700">指标</th>
                            {comparisonData.map((d, i) => (
                              <th key={i} className="px-4 py-3 text-center font-medium text-gray-700">
                                方案 {i + 1}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          <tr>
                            <td className="px-4 py-3 text-gray-600">模型名称</td>
                            {comparisonData.map((d, i) => (
                              <td key={i} className="px-4 py-3 text-center font-medium">{d.task.modelName}</td>
                            ))}
                          </tr>
                          <tr className="bg-gray-50/50">
                            <td className="px-4 py-3 text-gray-600">简化后面数</td>
                            {comparisonData.map((d, i) => (
                              <td key={i} className="px-4 py-3 text-center font-mono">
                                {formatNumber(d.task.simplifiedFaces, 0)}
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-gray-600">简化比例</td>
                            {comparisonData.map((d, i) => (
                              <td key={i} className="px-4 py-3 text-center">
                                {(d.task.simplificationRatio * 100).toFixed(1)}%
                              </td>
                            ))}
                          </tr>
                          <tr className="bg-gray-50/50">
                            <td className="px-4 py-3 text-gray-600">最大误差 (mm)</td>
                            {comparisonData.map((d, i) => (
                              <td key={i} className="px-4 py-3 text-center font-mono">
                                {d.errorAnalysis?.maxError.toFixed(4) || '-'}
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-gray-600">平均误差 (mm)</td>
                            {comparisonData.map((d, i) => (
                              <td key={i} className="px-4 py-3 text-center font-mono">
                                {d.errorAnalysis?.meanError.toFixed(4) || '-'}
                              </td>
                            ))}
                          </tr>
                          <tr className="bg-gray-50/50">
                            <td className="px-4 py-3 text-gray-600">打印时间</td>
                            {comparisonData.map((d, i) => (
                              <td key={i} className="px-4 py-3 text-center">
                                {d.printEstimation ? formatTime(d.printEstimation.printTimeHours) : '-'}
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-gray-600">总成本 (元)</td>
                            {comparisonData.map((d, i) => (
                              <td key={i} className="px-4 py-3 text-center font-mono">
                                {d.printEstimation?.totalCost.toFixed(2) || '-'}
                              </td>
                            ))}
                          </tr>
                          <tr className="bg-gray-50/50">
                            <td className="px-4 py-3 text-gray-600">约束通过率</td>
                            {comparisonData.map((d, i) => {
                              const passed = d.constraintChecks.filter(c => c.passed).length;
                              const total = d.constraintChecks.length;
                              return (
                                <td key={i} className="px-4 py-3 text-center">
                                  {total > 0 ? `${passed}/${total} (${((passed / total) * 100).toFixed(0)}%)` : '-'}
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
