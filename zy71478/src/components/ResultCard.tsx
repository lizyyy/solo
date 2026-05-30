import { useAppStore } from '../store/appStore';
import { formatVelocity, formatPercent, formatDateTime } from '../utils/format';
import { Thermometer, Ruler, Target, TrendingUp, CheckCircle2, AlertTriangle, XCircle, Hash, Clock, Save } from 'lucide-react';
import { useState } from 'react';

export default function ResultCard() {
  const { currentResult, currentRecordId, saveCurrentRecord } = useAppStore();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  if (!currentResult) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 shadow-xl">
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <Target className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg">请先输入参数并执行计算</p>
          <p className="text-sm mt-2 opacity-60">计算结果将在此处展示</p>
        </div>
      </div>
    );
  }

  const conclusionConfig = {
    consistent: {
      icon: CheckCircle2,
      label: '结果一致',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
    },
    inconsistent: {
      icon: XCircle,
      label: '结论不一致',
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
    },
    warning: {
      icon: AlertTriangle,
      label: '存在异常',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
    },
  };

  const config = conclusionConfig[currentResult.conclusion];
  const ConclusionIcon = config.icon;

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await saveCurrentRecord();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
    }
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          校准计算结果
        </h2>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bgColor} ${config.borderColor} border`}>
            <ConclusionIcon className={`w-4 h-4 ${config.color}`} />
            <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
          </div>
          <button
            onClick={handleSave}
            disabled={saveStatus !== 'idle' || currentRecordId !== null}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-all"
          >
            {saveStatus === 'saving' ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : saveStatus === 'saved' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {currentRecordId ? '已保存' : saveStatus === 'saved' ? '保存成功' : '保存记录'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 rounded-xl p-4 border border-orange-500/20">
          <div className="flex items-center gap-2 text-orange-400 text-sm mb-2">
            <Thermometer className="w-4 h-4" />
            理论值
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {formatVelocity(currentResult.theoreticalValue)}
          </div>
          <div className="text-xs text-slate-500 mt-1">温度法计算</div>
        </div>

        <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 rounded-xl p-4 border border-cyan-500/20">
          <div className="flex items-center gap-2 text-cyan-400 text-sm mb-2">
            <Ruler className="w-4 h-4" />
            测量值
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {Number.isNaN(currentResult.measuredValue) ? '--' : formatVelocity(currentResult.measuredValue)}
          </div>
          <div className="text-xs text-slate-500 mt-1">测距法计算</div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-xl p-4 border border-emerald-500/20">
          <div className="flex items-center gap-2 text-emerald-400 text-sm mb-2">
            <Target className="w-4 h-4" />
            校准后
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {Number.isNaN(currentResult.calibratedValue) ? '--' : formatVelocity(currentResult.calibratedValue)}
          </div>
          <div className="text-xs text-slate-500 mt-1">含设备偏差</div>
        </div>

        <div className={`rounded-xl p-4 border ${
          Math.abs(currentResult.deviationPercent) <= 5 
            ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20' 
            : 'bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20'
        }`}>
          <div className={`flex items-center gap-2 text-sm mb-2 ${
            Math.abs(currentResult.deviationPercent) <= 5 ? 'text-emerald-400' : 'text-red-400'
          }`}>
            <TrendingUp className="w-4 h-4" />
            偏差
          </div>
          <div className={`text-2xl font-bold font-mono ${
            Math.abs(currentResult.deviationPercent) <= 5 ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {Number.isNaN(currentResult.deviationPercent) ? '--' : formatPercent(currentResult.deviationPercent)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            绝对偏差: {Number.isNaN(currentResult.deviation) ? '--' : `${currentResult.deviation.toFixed(2)} m/s`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="flex items-center gap-3 text-slate-400">
          <Hash className="w-4 h-4 text-slate-500" />
          <div>
            <div className="text-xs text-slate-500">输入哈希</div>
            <div className="font-mono text-xs">{currentResult.inputHash.slice(0, 16)}...</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-slate-400">
          <Clock className="w-4 h-4 text-slate-500" />
          <div>
            <div className="text-xs text-slate-500">计算时间</div>
            <div>{formatDateTime(currentResult.calculatedAt)}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-slate-400">
          <Target className="w-4 h-4 text-slate-500" />
          <div>
            <div className="text-xs text-slate-500">算法版本</div>
            <div className="font-mono">v{currentResult.algorithmVersion}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
