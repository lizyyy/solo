import { useAppStore } from '../store/appStore';
import { Thermometer, Ruler, Clock, Settings, User, FileText, AlertTriangle, CheckCircle2, Calculator } from 'lucide-react';
import { validateInput } from '../engine/validator';
import { getAnomalyTypeLabel, getSeverityLabel } from '../engine/validator';
import { useMemo } from 'react';

export default function InputForm() {
  const { currentInput, setInput, resetInput, performCalculation, isCalculating } = useAppStore();

  const liveAnomalies = useMemo(() => {
    return validateInput(currentInput);
  }, [currentInput]);

  const handleNumberChange = (field: 'temperature' | 'distance' | 'timeDiff' | 'deviceDeviation', value: string) => {
    if (value === '' || value === '-') {
      setInput({ [field]: null });
    } else {
      const num = parseFloat(value);
      setInput({ [field]: isNaN(num) ? null : num });
    }
  };

  const hasErrors = liveAnomalies.some(a => a.severity === 'error');
  const hasWarnings = liveAnomalies.some(a => a.severity === 'warning');

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-400" />
          实验参数录入
        </h2>
        <div className="flex items-center gap-2">
          {hasErrors && (
            <span className="flex items-center gap-1 text-sm text-red-400 bg-red-500/10 px-3 py-1 rounded-full">
              <AlertTriangle className="w-4 h-4" />
              {liveAnomalies.filter(a => a.severity === 'error').length} 项错误
            </span>
          )}
          {hasWarnings && !hasErrors && (
            <span className="flex items-center gap-1 text-sm text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full">
              <AlertTriangle className="w-4 h-4" />
              {liveAnomalies.filter(a => a.severity === 'warning').length} 项警告
            </span>
          )}
          {!hasErrors && !hasWarnings && liveAnomalies.length === 0 && (
            <span className="flex items-center gap-1 text-sm text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">
              <CheckCircle2 className="w-4 h-4" />
              参数完整
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <Thermometer className="w-4 h-4 text-orange-400" />
            温度 (℃)
          </label>
          <input
            type="number"
            step="0.1"
            placeholder="例如: 25.5"
            value={currentInput.temperature ?? ''}
            onChange={(e) => handleNumberChange('temperature', e.target.value)}
            className={`w-full px-4 py-3 bg-slate-900/50 border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
              liveAnomalies.some(a => a.field === 'temperature')
                ? 'border-red-500 focus:ring-red-500/50'
                : 'border-slate-600 focus:ring-blue-500/50 focus:border-blue-500'
            }`}
          />
          <p className="text-xs text-slate-500">合理范围: -50 ~ 100 ℃</p>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <Ruler className="w-4 h-4 text-cyan-400" />
            测距 (m)
          </label>
          <input
            type="number"
            step="0.01"
            placeholder="例如: 10.50"
            value={currentInput.distance ?? ''}
            onChange={(e) => handleNumberChange('distance', e.target.value)}
            className={`w-full px-4 py-3 bg-slate-900/50 border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
              liveAnomalies.some(a => a.field === 'distance')
                ? 'border-red-500 focus:ring-red-500/50'
                : 'border-slate-600 focus:ring-blue-500/50 focus:border-blue-500'
            }`}
          />
          <p className="text-xs text-slate-500">合理范围: 0.1 ~ 1000 m</p>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <Clock className="w-4 h-4 text-purple-400" />
            时间差
          </label>
          <div className="flex gap-3">
            <input
              type="number"
              step="0.0001"
              placeholder="例如: 0.0306"
              value={currentInput.timeDiff ?? ''}
              onChange={(e) => handleNumberChange('timeDiff', e.target.value)}
              className={`flex-1 px-4 py-3 bg-slate-900/50 border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                liveAnomalies.some(a => a.field === 'timeDiff')
                  ? 'border-red-500 focus:ring-red-500/50'
                  : 'border-slate-600 focus:ring-blue-500/50 focus:border-blue-500'
              }`}
            />
            <select
              value={currentInput.timeUnit}
              onChange={(e) => setInput({ timeUnit: e.target.value as 's' | 'ms' })}
              className={`px-4 py-3 bg-slate-900/50 border rounded-xl text-white focus:outline-none focus:ring-2 transition-all ${
                liveAnomalies.some(a => a.field === 'timeUnit')
                  ? 'border-red-500 focus:ring-red-500/50'
                  : 'border-slate-600 focus:ring-blue-500/50 focus:border-blue-500'
              }`}
            >
              <option value="s">秒 (s)</option>
              <option value="ms">毫秒 (ms)</option>
            </select>
          </div>
          <p className="text-xs text-slate-500">合理范围: 0.0001 ~ 10 s</p>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <Settings className="w-4 h-4 text-emerald-400" />
            设备偏差 (m/s)
          </label>
          <input
            type="number"
            step="0.1"
            placeholder="例如: 0.5"
            value={currentInput.deviceDeviation ?? ''}
            onChange={(e) => handleNumberChange('deviceDeviation', e.target.value)}
            className={`w-full px-4 py-3 bg-slate-900/50 border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
              liveAnomalies.some(a => a.field === 'deviceDeviation')
                ? 'border-amber-500 focus:ring-amber-500/50'
                : 'border-slate-600 focus:ring-blue-500/50 focus:border-blue-500'
            }`}
          />
          <p className="text-xs text-slate-500">设备校准证书上的系统偏差</p>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <Settings className="w-4 h-4 text-slate-400" />
            设备编号 (可选)
          </label>
          <input
            type="text"
            placeholder="例如: DEV-001"
            value={currentInput.deviceId ?? ''}
            onChange={(e) => setInput({ deviceId: e.target.value || undefined })}
            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <User className="w-4 h-4 text-slate-400" />
            操作人员 (可选)
          </label>
          <input
            type="text"
            placeholder="例如: 张老师"
            value={currentInput.operator ?? ''}
            onChange={(e) => setInput({ operator: e.target.value || undefined })}
            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <FileText className="w-4 h-4 text-slate-400" />
          备注 (可选)
        </label>
        <textarea
          placeholder="记录实验条件、环境因素等补充信息..."
          value={currentInput.notes ?? ''}
          onChange={(e) => setInput({ notes: e.target.value || undefined })}
          rows={2}
          className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all resize-none"
        />
      </div>

      {liveAnomalies.length > 0 && (
        <div className="mt-6 space-y-2">
          <h3 className="text-sm font-medium text-slate-300">实时异常检测</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {liveAnomalies.map((anomaly) => (
              <div
                key={anomaly.id}
                className={`p-3 rounded-xl border text-sm ${
                  anomaly.severity === 'error'
                    ? 'bg-red-500/10 border-red-500/30 text-red-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    anomaly.severity === 'error' ? 'bg-red-500/20' : 'bg-amber-500/20'
                  }`}>
                    #{anomaly.sequence} {getSeverityLabel(anomaly.severity)}
                  </span>
                  {getAnomalyTypeLabel(anomaly.type)}
                </div>
                <p className="mt-1 text-xs opacity-80">{anomaly.explanation}</p>
                <p className="mt-1 text-xs opacity-60">建议: {anomaly.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={performCalculation}
          disabled={isCalculating}
          className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-medium rounded-xl hover:from-blue-500 hover:to-cyan-400 transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isCalculating ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              计算中...
            </>
          ) : (
            <>
              <Calculator className="w-5 h-5" />
              执行校准计算
            </>
          )}
        </button>
        <button
          onClick={resetInput}
          className="px-6 py-3 bg-slate-700 text-slate-300 font-medium rounded-xl hover:bg-slate-600 transition-all"
        >
          重置
        </button>
      </div>
    </div>
  );
}
