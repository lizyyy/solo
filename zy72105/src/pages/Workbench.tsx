import { BatchSelector } from '../components/common/BatchSelector';
import { UnitConversionPanel } from '../components/unitConvert/UnitConversionPanel';
import { CalculationPanel } from '../components/calculation/CalculationPanel';
import { CalculationTimeline } from '../components/calculation/CalculationTimeline';
import { ConflictResolutionPanel } from '../components/conflict/ConflictResolutionPanel';
import { NotePanel } from '../components/report/NotePanel';
import { useAppStore } from '../store/useAppStore';
import { Thermometer, Droplets, Gauge, Activity } from 'lucide-react';
import { format } from 'date-fns';

export const Workbench = () => {
  const { currentBatchId, batches } = useAppStore();
  const currentBatch = batches.find((b) => b.id === currentBatchId);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">主工作台</h2>
          <p className="text-slate-500 text-sm mt-1">数据导入 → 单位换算 → 噪声计算 → 冲突检测 → 生成报告</p>
        </div>
      </div>

      <BatchSelector />

      {currentBatch && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500">无人机型号</p>
              <p className="font-semibold text-sm text-slate-800">{currentBatch.experimentRecord.droneModel}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
              <Thermometer className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500">温度</p>
              <p className="font-semibold text-sm text-slate-800">{currentBatch.experimentRecord.temperature}°C</p>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-50 rounded-lg flex items-center justify-center">
              <Droplets className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500">湿度</p>
              <p className="font-semibold text-sm text-slate-800">{currentBatch.experimentRecord.humidity}%</p>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <Gauge className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500">大气压</p>
              <p className="font-semibold text-sm text-slate-800">{currentBatch.experimentRecord.atmosphericPressure}Pa</p>
            </div>
          </div>
        </div>
      )}

      {currentBatch && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full" />
              数据点 ({currentBatch.experimentRecord.dataPoints.length})
            </h3>
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">时间</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">数值</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">单位</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">方向</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">来源</th>
                  </tr>
                </thead>
                <tbody>
                  {currentBatch.experimentRecord.dataPoints.map((dp) => (
                    <tr key={dp.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-xs">{format(new Date(dp.timestamp), 'HH:mm:ss')}</td>
                      <td className="px-3 py-2 font-mono font-semibold">{dp.value}</td>
                      <td className="px-3 py-2 text-slate-600">{dp.unit}</td>
                      <td className="px-3 py-2 text-slate-600">{dp.direction || '-'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          dp.source === 'sensor' ? 'bg-blue-50 text-blue-600' :
                          dp.source === 'import' ? 'bg-green-50 text-green-600' :
                          'bg-slate-50 text-slate-600'
                        }`}>
                          {dp.source === 'sensor' ? '传感器' : dp.source === 'import' ? '导入' : '手动'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-500 rounded-full" />
              传感器日志 ({currentBatch.experimentRecord.sensorLogs.length})
            </h3>
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">时间</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">参数</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">数值</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">单位</th>
                  </tr>
                </thead>
                <tbody>
                  {currentBatch.experimentRecord.sensorLogs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-xs">{format(new Date(log.timestamp), 'HH:mm:ss')}</td>
                      <td className="px-3 py-2 text-slate-600">{log.parameter}</td>
                      <td className="px-3 py-2 font-mono font-semibold">{log.value}</td>
                      <td className="px-3 py-2 text-slate-600">{log.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <UnitConversionPanel />
      <CalculationPanel />
      <ConflictResolutionPanel />
      <CalculationTimeline />
      <NotePanel />
    </div>
  );
};
