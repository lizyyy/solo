import { useState } from 'react';
import { Play, RotateCcw, Loader2, Zap, Thermometer, Wind } from 'lucide-react';
import { useNoiseCalculation } from '../../hooks/useNoiseCalculation';
import { useAppStore } from '../../store/useAppStore';
import { AlertBanner } from '../common/AlertBanner';
import { ASSESSMENT_LABELS, UNIT_LABELS } from '../../types';

export const CalculationPanel = () => {
  const { currentBatch, runCalculation, rerunCalculation, applyRerunResult } = useNoiseCalculation();
  const { isCalculating } = useAppStore();

  const [params, setParams] = useState({
    rotorSpeed: 4500,
    thrust: 49,
    rotorRadius: 0.28,
    bladeCount: 2,
    chord: 0.025,
    azimuth: 0,
    elevation: 0,
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [rerunResult, setRerunResult] = useState<{
    oldResult: unknown;
    newResult: unknown;
  } | null>(null);

  const handleRunCalculation = async () => {
    if (!currentBatch) return;
    const result = await runCalculation(currentBatch.id, params);
    setMessage({ type: result.success ? 'success' : 'error', text: result.message });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleRerun = async () => {
    if (!currentBatch) return;
    const result = await rerunCalculation(currentBatch.id);
    if (result.success && result.oldResult && result.newResult) {
      setRerunResult({ oldResult: result.oldResult, newResult: result.newResult });
      setMessage({ type: 'warning', text: '重跑完成，请确认是否应用新结果' });
    } else {
      setMessage({ type: 'error', text: result.message });
    }
  };

  const handleApplyRerun = () => {
    if (!currentBatch || !rerunResult) return;
    applyRerunResult(
      currentBatch.id,
      rerunResult.newResult as never,
      [] as never
    );
    setRerunResult(null);
    setMessage({ type: 'success', text: '新结果已应用' });
    setTimeout(() => setMessage(null), 3000);
  };

  const tipSpeed = (params.rotorSpeed * 2 * Math.PI * params.rotorRadius) / 60;
  const machNumber = tipSpeed / 343;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-blue-700 to-blue-600 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold">旋翼噪声物理近似计算</h3>
            <p className="text-blue-200 text-sm">基于厚度噪声/载荷噪声/宽带噪声模型</p>
          </div>
        </div>
      </div>

      <div className="p-5">
        {message && (
          <AlertBanner
            type={message.type}
            title={message.text}
            dismissible
          />
        )}

        <div className="grid grid-cols-4 gap-4 mb-5">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              <Wind className="w-3 h-3 inline mr-1" />
              旋翼转速 (RPM)
            </label>
            <input
              type="number"
              value={params.rotorSpeed}
              onChange={(e) => setParams({ ...params, rotorSpeed: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              推力 (N)
            </label>
            <input
              type="number"
              value={params.thrust}
              onChange={(e) => setParams({ ...params, thrust: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              <Thermometer className="w-3 h-3 inline mr-1" />
              桨叶数
            </label>
            <input
              type="number"
              value={params.bladeCount}
              onChange={(e) => setParams({ ...params, bladeCount: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              弦长 (m)
            </label>
            <input
              type="number"
              step="0.001"
              value={params.chord}
              onChange={(e) => setParams({ ...params, chord: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mb-5 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex-1 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-slate-500">桨尖速度</p>
              <p className="font-mono font-semibold text-sm text-slate-700">{tipSpeed.toFixed(1)} m/s</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">马赫数</p>
              <p className={`font-mono font-semibold text-sm ${machNumber > 0.4 ? 'text-red-600' : 'text-slate-700'}`}>
                {machNumber.toFixed(3)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">通过频率</p>
              <p className="font-mono font-semibold text-sm text-slate-700">
                {((params.bladeCount * params.rotorSpeed) / 60).toFixed(1)} Hz
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunCalculation}
            disabled={isCalculating || !currentBatch}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-600/20"
          >
            {isCalculating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            执行计算
          </button>
          <button
            onClick={handleRerun}
            disabled={isCalculating || !currentBatch?.result}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-4 h-4" />
            重跑对比
          </button>
        </div>

        {currentBatch?.result && (
          <div className="mt-5 p-4 rounded-lg border border-slate-200 bg-gradient-to-r from-slate-50 to-white">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">预测结果</h4>
            <div className="grid grid-cols-5 gap-4">
              <div className="text-center p-3 rounded-lg bg-white border border-slate-200">
                <p className="text-xs text-slate-500">总噪声级</p>
                <p className={`font-mono text-2xl font-bold ${
                  currentBatch.result.assessment === 'critical' ? 'text-red-600' :
                  currentBatch.result.assessment === 'warning' ? 'text-amber-600' :
                  'text-green-600'
                }`}>
                  {currentBatch.result.overallNoiseLevel.toFixed(1)}
                </p>
                <p className="text-xs text-slate-400">{UNIT_LABELS[currentBatch.result.unit]}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-white border border-slate-200">
                <p className="text-xs text-slate-500">评估等级</p>
                <p className={`font-mono text-xl font-bold ${
                  currentBatch.result.assessment === 'critical' ? 'text-red-600' :
                  currentBatch.result.assessment === 'warning' ? 'text-amber-600' :
                  'text-green-600'
                }`}>
                  {ASSESSMENT_LABELS[currentBatch.result.assessment]}
                </p>
              </div>
              <div className="text-center p-3 rounded-lg bg-white border border-slate-200">
                <p className="text-xs text-slate-500">主导频率</p>
                <p className="font-mono text-xl font-bold text-slate-700">
                  {currentBatch.result.dominantFrequency.toFixed(1)}
                </p>
                <p className="text-xs text-slate-400">Hz</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-white border border-slate-200">
                <p className="text-xs text-slate-500">指向性指数</p>
                <p className="font-mono text-xl font-bold text-slate-700">
                  {currentBatch.result.directionalityIndex.toFixed(2)}
                </p>
              </div>
              <div className="text-center p-3 rounded-lg bg-white border border-slate-200">
                <p className="text-xs text-slate-500">置信度</p>
                <p className="font-mono text-xl font-bold text-slate-700">
                  {(currentBatch.result.confidenceLevel * 100).toFixed(0)}%
                </p>
              </div>
            </div>
            {currentBatch.result.recommendations.length > 0 && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs font-medium text-blue-700 mb-1">建议措施</p>
                <ul className="space-y-1">
                  {currentBatch.result.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-xs text-blue-600 flex items-start">
                      <span className="mr-1.5">•</span>{rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {rerunResult && (
          <div className="mt-5 p-4 rounded-lg border border-amber-200 bg-amber-50">
            <h4 className="text-sm font-semibold text-amber-800 mb-3">重跑结果对比</h4>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <p className="text-xs text-slate-500 mb-1">历史结果</p>
                <p className="font-mono text-xl font-bold text-slate-600">
                  {(rerunResult.oldResult as { overallNoiseLevel: number }).overallNoiseLevel.toFixed(1)} dB
                </p>
              </div>
              <div className="p-3 bg-white rounded-lg border border-blue-200">
                <p className="text-xs text-blue-500 mb-1">新结果</p>
                <p className="font-mono text-xl font-bold text-blue-600">
                  {(rerunResult.newResult as { overallNoiseLevel: number }).overallNoiseLevel.toFixed(1)} dB
                </p>
              </div>
            </div>
            <button
              onClick={handleApplyRerun}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-all"
            >
              确认应用新结果
            </button>
            <button
              onClick={() => setRerunResult(null)}
              className="ml-2 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-all"
            >
              保留旧结果
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
