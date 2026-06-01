import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, FileText, ArrowLeft, Check } from 'lucide-react';
import { useAnalysisStore } from '../store/useAnalysisStore';
import { exportToExcel, exportToPDF } from '../utils/exportUtils';
import { formatTimestamp, formatEnergy, formatTime, formatDuration, getAnomalyTypeName, getFieldName, getFieldUnit } from '../utils/formatters';

export function ReportPage() {
  const navigate = useNavigate();
  const { currentAnalysis } = useAnalysisStore();

  if (!currentAnalysis) {
    return (
      <div className="min-h-screen bg-slate-900">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center px-4 py-24">
          <FileText className="h-16 w-16 text-slate-600" />
          <h2 className="mt-6 text-2xl font-bold text-white">暂无分析数据</h2>
          <p className="mt-2 text-slate-400">请先进行能量分析</p>
          <button
            onClick={() => navigate('/import')}
            className="mt-8 flex items-center space-x-2 rounded-lg bg-cyan-600 px-6 py-3 text-white hover:bg-cyan-700"
          >
            <span>前往数据导入</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>返回</span>
            </button>
            <h1 className="text-2xl font-bold text-white">报告导出</h1>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => exportToPDF(currentAnalysis)}
              className="flex items-center space-x-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              <FileText className="h-4 w-4" />
              <span>导出 PDF</span>
            </button>
            <button
              onClick={() => exportToExcel(currentAnalysis)}
              className="flex items-center space-x-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>导出 Excel</span>
            </button>
          </div>
        </div>

        <div className="rounded-lg bg-white p-8 text-slate-900 shadow-lg">
          <div className="mb-6 border-b border-slate-200 pb-4 text-center">
            <h2 className="text-2xl font-bold text-slate-800">滑雪坡道能量分析报告</h2>
            <p className="mt-2 text-slate-500">
              {currentAnalysis.batchName} · {formatTimestamp(currentAnalysis.createdAt)}
            </p>
          </div>

          <div className="mb-6">
            <h3 className="mb-3 text-lg font-semibold text-slate-700">一、分析摘要</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded bg-slate-100 p-3">
                <p className="text-sm text-slate-500">总样本数</p>
                <p className="text-xl font-bold">{currentAnalysis.summary.totalSamples}</p>
              </div>
              <div className="rounded bg-slate-100 p-3">
                <p className="text-sm text-slate-500">测试时长</p>
                <p className="text-xl font-bold">{formatDuration(currentAnalysis.summary.duration / 1000)}</p>
              </div>
              <div className="rounded bg-slate-100 p-3">
                <p className="text-sm text-slate-500">平均动能</p>
                <p className="text-xl font-bold">{formatEnergy(currentAnalysis.summary.avgKineticEnergy)}</p>
              </div>
              <div className="rounded bg-slate-100 p-3">
                <p className="text-sm text-slate-500">平均势能</p>
                <p className="text-xl font-bold">{formatEnergy(currentAnalysis.summary.avgPotentialEnergy)}</p>
              </div>
              <div className="rounded bg-slate-100 p-3">
                <p className="text-sm text-slate-500">总能量损失</p>
                <p className="text-xl font-bold">{formatEnergy(currentAnalysis.summary.totalEnergyLoss)}</p>
              </div>
              <div className="rounded bg-slate-100 p-3">
                <p className="text-sm text-slate-500">异常数量</p>
                <p className="text-xl font-bold">{currentAnalysis.summary.anomalyCount}</p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="mb-3 text-lg font-semibold text-slate-700">二、设备参数</h3>
            <div className="overflow-hidden rounded bg-slate-50">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-2 font-medium text-slate-600">设备名称</td>
                    <td className="px-4 py-2">{currentAnalysis.deviceParams.name}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-2 font-medium text-slate-600">质量</td>
                    <td className="px-4 py-2">{currentAnalysis.deviceParams.mass} kg</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-2 font-medium text-slate-600">坡道角度</td>
                    <td className="px-4 py-2">{currentAnalysis.deviceParams.slopeAngle}°</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-2 font-medium text-slate-600">摩擦系数</td>
                    <td className="px-4 py-2">{currentAnalysis.deviceParams.frictionCoeff}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium text-slate-600">分析原因</td>
                    <td className="px-4 py-2">{currentAnalysis.analysisReason || '滑雪坡道能量分析'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="mb-3 text-lg font-semibold text-slate-700">三、异常记录</h3>
            {currentAnalysis.anomalies.length === 0 ? (
              <div className="flex items-center space-x-2 rounded bg-green-50 p-4 text-green-700">
                <Check className="h-5 w-5" />
                <span>未检测到异常</span>
              </div>
            ) : (
              <div className="space-y-2">
                {currentAnalysis.anomalies.slice(0, 10).map((anomaly) => (
                  <div
                    key={anomaly.id}
                    className={`rounded border-l-4 bg-slate-50 p-3 ${anomaly.severity === 'critical' ? 'border-red-500' : 'border-orange-500'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{getAnomalyTypeName(anomaly.type)}</span>
                      <span className="text-sm text-slate-500">{formatTime(anomaly.timestamp)}</span>
                    </div>
                    <p className="text-sm text-slate-600">{anomaly.reason}</p>
                    <p className="text-xs text-slate-500">
                      数值: {anomaly.value.toFixed(2)}, 阈值: {anomaly.threshold.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mb-6">
            <h3 className="mb-3 text-lg font-semibold text-slate-700">四、极端值</h3>
            <div className="grid grid-cols-2 gap-4">
              {currentAnalysis.extremeValues.map((ev) => (
                <div key={ev.id} className="rounded bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {ev.type === 'max' ? '最大' : '最小'}{getFieldName(ev.field)}
                    </span>
                    <span
                      className={`text-sm ${ev.deviationPercent > 0 ? 'text-orange-600' : 'text-cyan-600'}`}
                    >
                      {ev.deviationPercent > 0 ? '+' : ''}{ev.deviationPercent.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-lg font-bold">
                    {ev.value.toFixed(2)} {getFieldUnit(ev.field)}
                  </p>
                  <p className="text-xs text-slate-500">
                    均值: {ev.avgValue.toFixed(2)} {getFieldUnit(ev.field)} · {formatTime(ev.timestamp)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-lg font-semibold text-slate-700">五、数据来源</h3>
            <div className="rounded bg-slate-50 p-4">
              <p className="text-sm text-slate-600">
                源文件: {currentAnalysis.sourceFiles.join(', ')}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                现场备注: {currentAnalysis.fieldNotes.length} 条
              </p>
              <p className="mt-1 text-sm text-slate-600">
                人工修正: {currentAnalysis.manualCorrections.length} 条
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
