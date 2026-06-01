import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap,
  Thermometer,
  Activity,
  AlertTriangle,
  Save,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { StatusCard } from '../components/common/StatusCard';
import { EnergyTrendChart } from '../components/charts/EnergyTrendChart';
import { SensorDataChart } from '../components/charts/SensorDataChart';
import { AnomalyPanel } from '../components/dashboard/AnomalyPanel';
import { ExtremeValuesPanel } from '../components/dashboard/ExtremeValuesPanel';
import { useAnalysisStore } from '../store/useAnalysisStore';
import { formatEnergy, formatDuration, formatTimestamp } from '../utils/formatters';

export function DashboardPage() {
  const navigate = useNavigate();
  const {
    currentAnalysis,
    highlightedDataIndex,
    runAnalysis,
    saveToHistory,
    acknowledgeAnomaly,
    setHighlightedDataIndex,
  } = useAnalysisStore();

  if (!currentAnalysis) {
    return (
      <div className="min-h-screen bg-slate-900">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center px-4 py-24">
          <div className="rounded-full bg-slate-800 p-8">
            <Zap className="h-16 w-16 text-slate-600" />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-white">暂无分析数据</h2>
          <p className="mt-2 text-slate-400">请先导入数据并运行能量分析</p>
          <button
            onClick={() => navigate('/import')}
            className="mt-8 flex items-center space-x-2 rounded-lg bg-cyan-600 px-6 py-3 text-white hover:bg-cyan-700"
          >
            <span>前往数据导入</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const { summary, kineticEnergy, potentialEnergy, totalEnergy, anomalies, extremeValues, sensorData, batchName, createdAt, analysisReason } = currentAnalysis;

  const overallStatus = summary.criticalAnomalyCount > 0
    ? 'critical'
    : summary.anomalyCount > 0
    ? 'warning'
    : 'normal';

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{batchName}</h1>
            <div className="mt-1 flex items-center space-x-4 text-sm text-slate-400">
              <span>分析时间: {formatTimestamp(createdAt)}</span>
              <span>分析原因: {analysisReason || '滑雪坡道能量分析'}</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                runAnalysis(batchName + ' (重算)', analysisReason);
              }}
              className="flex items-center space-x-2 rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              <Zap className="h-4 w-4" />
              <span>重新分析</span>
            </button>
            <button
              onClick={saveToHistory}
              className="flex items-center space-x-2 rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              <Save className="h-4 w-4" />
              <span>保存到历史</span>
            </button>
            <button
              onClick={() => navigate('/report')}
              className="flex items-center space-x-2 rounded-md bg-cyan-600 px-4 py-2 text-sm text-white hover:bg-cyan-700"
            >
              <FileText className="h-4 w-4" />
              <span>导出报告</span>
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-4 gap-4">
          <StatusCard
            title="平均动能"
            value={formatEnergy(summary.avgKineticEnergy)}
            subtitle={`总能量损失: ${formatEnergy(summary.totalEnergyLoss)}`}
            status="normal"
            icon={<Zap className="h-5 w-5 text-cyan-400" />}
          />
          <StatusCard
            title="平均势能"
            value={formatEnergy(summary.avgPotentialEnergy)}
            status="normal"
            icon={<Activity className="h-5 w-5 text-purple-400" />}
          />
          <StatusCard
            title="最高温度"
            value={`${summary.maxTemperature.toFixed(1)} °C`}
            status={summary.maxTemperature > 70 ? 'warning' : 'normal'}
            icon={<Thermometer className="h-5 w-5 text-orange-400" />}
          />
          <StatusCard
            title="异常检测"
            value={`${summary.anomalyCount} 处`}
            subtitle={`严重: ${summary.criticalAnomalyCount}, 警告: ${summary.anomalyCount - summary.criticalAnomalyCount}`}
            status={overallStatus}
            icon={<AlertTriangle className="h-5 w-5 text-red-400" />}
          />
        </div>

        <div className="mb-6 grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <div className="rounded-lg bg-slate-800/50 p-6">
              <h3 className="mb-4 text-lg font-medium text-white">能量趋势</h3>
              <EnergyTrendChart
                kineticEnergy={kineticEnergy}
                potentialEnergy={potentialEnergy}
                totalEnergy={totalEnergy}
                anomalies={anomalies}
                highlightedIndex={highlightedDataIndex}
              />
            </div>

            <div className="rounded-lg bg-slate-800/50 p-6">
              <h3 className="mb-4 text-lg font-medium text-white">传感器数据</h3>
              <SensorDataChart
                sensorData={sensorData}
                anomalies={anomalies}
                highlightedIndex={highlightedDataIndex}
              />
            </div>
          </div>

          <div className="space-y-6">
            <AnomalyPanel
              anomalies={anomalies}
              onAcknowledge={acknowledgeAnomaly}
              onHighlight={setHighlightedDataIndex}
            />
            <ExtremeValuesPanel
              extremeValues={extremeValues}
              onHighlight={setHighlightedDataIndex}
            />
          </div>
        </div>

        <div className="rounded-lg bg-slate-800/50 p-6">
          <h3 className="mb-4 text-lg font-medium text-white">分析摘要</h3>
          <div className="grid grid-cols-6 gap-4">
            <div className="text-center">
              <p className="text-sm text-slate-400">总样本数</p>
              <p className="mt-1 text-xl font-bold text-white">{summary.totalSamples}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-400">测试时长</p>
              <p className="mt-1 text-xl font-bold text-white">
                {formatDuration(summary.duration / 1000)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-400">最大振动</p>
              <p className="mt-1 text-xl font-bold text-white">
                {summary.maxVibration.toFixed(2)} mm/s
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-400">现场备注</p>
              <p className="mt-1 text-xl font-bold text-white">
                {currentAnalysis.fieldNotes.length} 条
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-400">人工修正</p>
              <p className="mt-1 text-xl font-bold text-white">
                {currentAnalysis.manualCorrections.length} 条
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-400">数据来源</p>
              <p className="mt-1 text-xl font-bold text-white">
                {currentAnalysis.sourceFiles.length} 个
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
