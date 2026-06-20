import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { adjustedCalculationParams } from '@/data/sampleData';
import { Settings2, Play, RotateCcw, TrendingUp, TrendingDown, GitBranch, Ruler } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function ConfigPage() {
  const params = useAppStore(s => s.params);
  const updateParams = useAppStore(s => s.updateParams);
  const runCalculation = useAppStore(s => s.runCalculation);
  const currentRun = useAppStore(s => s.currentRun);
  const initDefault = useAppStore(s => s.initDefault);
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentRun) {
      initDefault();
    }
  }, [currentRun, initDefault]);

  const handleRun = (name: string) => {
    runCalculation(name);
  };

  const handleAdjustOneStep = (direction: 'up' | 'down') => {
    const factor = direction === 'up' ? 1.1 : 0.9;
    updateParams({
      tolerance: +(params.tolerance * factor).toFixed(4),
      boundaryConfig: {
        ...params.boundaryConfig,
        percentileThreshold: params.boundaryConfig.percentileThreshold
          ? +(params.boundaryConfig.percentileThreshold * factor).toFixed(3)
          : undefined,
      },
    });
  };

  const handleApplyAdjusted = () => {
    updateParams({
      formula: adjustedCalculationParams.formula,
      boundaryConfig: adjustedCalculationParams.boundaryConfig,
      tolerance: adjustedCalculationParams.tolerance,
    });
  };

  const handleReset = () => {
    updateParams({
      formula: 'value * coefficient + base_value * 0.1',
      boundaryConfig: {
        minValue: 0,
        maxValue: 1000,
        percentileThreshold: 0.1,
        sampleSizeThreshold: 5,
      },
      tolerance: 0.01,
    });
  };

  const variableHints = ['value', 'coefficient', 'base_value', 'constraint_min', 'constraint_max'];

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-ink-200 px-8 py-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-md bg-ink-100 flex items-center justify-center">
            <Settings2 className="w-4 h-4 text-ink-600" />
          </div>
          <h1 className="font-serif text-xl font-bold text-ink-900">验算配置</h1>
        </div>
        <p className="text-sm text-ink-400">
          调一档参数即可复算 · 报告里看得出公式、单位和边界样本如何让结果变化
        </p>
      </header>

      <div className="p-8 max-w-[1200px] space-y-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-ink-900 flex items-center justify-center">
                <span className="text-amber-400 font-mono text-xs font-bold">fx</span>
              </div>
              <h2 className="text-sm font-semibold text-ink-800">约束规划公式</h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {variableHints.map(v => (
                <button
                  key={v}
                  onClick={() => updateParams({ formula: params.formula + ' ' + v })}
                  className="tag bg-ink-50 text-ink-600 border border-ink-200 hover:bg-ink-100 cursor-pointer font-mono text-[11px]"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={params.formula}
            onChange={e => updateParams({ formula: e.target.value })}
            rows={3}
            className="input font-mono text-sm leading-relaxed"
            placeholder="例如：value * coefficient + base_value * 0.1"
          />
          <p className="text-[11px] text-ink-400 mt-2">
            支持四则运算、括号、变量引用、以及 sqrt / abs / max / min / pow 等函数
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-md bg-purple-50 flex items-center justify-center">
                <GitBranch className="w-4 h-4 text-anomaly-boundary" />
              </div>
              <h2 className="text-sm font-semibold text-ink-800">边界样本配置</h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-ink-500 mb-1 block">最小值阈值</label>
                <input
                  type="number"
                  value={params.boundaryConfig.minValue ?? ''}
                  onChange={e => updateParams({
                    boundaryConfig: { ...params.boundaryConfig, minValue: e.target.value === '' ? undefined : Number(e.target.value) }
                  })}
                  className="input"
                />
              </div>
              <div>
                <label className="text-xs text-ink-500 mb-1 block">最大值阈值</label>
                <input
                  type="number"
                  value={params.boundaryConfig.maxValue ?? ''}
                  onChange={e => updateParams({
                    boundaryConfig: { ...params.boundaryConfig, maxValue: e.target.value === '' ? undefined : Number(e.target.value) }
                  })}
                  className="input"
                />
              </div>
              <div>
                <label className="text-xs text-ink-500 mb-1 block">
                  百分位阈值（识别分布两端 {((params.boundaryConfig.percentileThreshold ?? 0) * 100).toFixed(0)}%）
                </label>
                <input
                  type="range"
                  min={0.01}
                  max={0.5}
                  step={0.01}
                  value={params.boundaryConfig.percentileThreshold ?? 0.1}
                  onChange={e => updateParams({
                    boundaryConfig: { ...params.boundaryConfig, percentileThreshold: Number(e.target.value) }
                  })}
                  className="w-full accent-ink-700"
                />
              </div>
              <div>
                <label className="text-xs text-ink-500 mb-1 block">样本量下限</label>
                <input
                  type="number"
                  value={params.boundaryConfig.sampleSizeThreshold ?? ''}
                  onChange={e => updateParams({
                    boundaryConfig: { ...params.boundaryConfig, sampleSizeThreshold: e.target.value === '' ? undefined : Number(e.target.value) }
                  })}
                  className="input"
                />
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-md bg-red-50 flex items-center justify-center">
                <Ruler className="w-4 h-4 text-anomaly-unit" />
              </div>
              <h2 className="text-sm font-semibold text-ink-800">单位与容差配置</h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-ink-500 mb-1 block">必填单位字段（逗号分隔）</label>
                <input
                  type="text"
                  value={params.unitConfig.requiredFields.join(', ')}
                  onChange={e => updateParams({
                    unitConfig: { ...params.unitConfig, requiredFields: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }
                  })}
                  className="input font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-ink-500 mb-1 block">允许的单位（逗号分隔，留空表示接受任意）</label>
                <input
                  type="text"
                  value={params.unitConfig.allowedUnits.join(', ')}
                  onChange={e => updateParams({
                    unitConfig: { ...params.unitConfig, allowedUnits: e.target.value.split(',').map(s => s.trim()) }
                  })}
                  className="input font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-ink-500 mb-1 block">
                  计算容差：{params.tolerance}
                </label>
                <input
                  type="range"
                  min={0.001}
                  max={0.1}
                  step={0.001}
                  value={params.tolerance}
                  onChange={e => updateParams({ tolerance: Number(e.target.value) })}
                  className="w-full accent-ink-700"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-ink-800">调一档参数复算</h2>
            <span className="text-xs text-ink-400">快速调整 · 对比前后变化</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => handleAdjustOneStep('up')} className="btn-secondary">
              <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
              调高一档（容差/百分位 ×1.1）
            </button>
            <button onClick={() => handleAdjustOneStep('down')} className="btn-secondary">
              <TrendingDown className="w-3.5 h-3.5 mr-1.5" />
              调低一档（容差/百分位 ×0.9）
            </button>
            <button onClick={handleApplyAdjusted} className="btn-secondary">
              <Settings2 className="w-3.5 h-3.5 mr-1.5" />
              应用预设调整方案
            </button>
            <button onClick={handleReset} className="btn-ghost">
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              恢复默认
            </button>
          </div>
        </div>

        <div className="card p-5 bg-ink-900 border-ink-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white mb-1">运行批量验算</h2>
              <p className="text-xs text-ink-300">
                将以当前配置对 {useAppStore.getState().answers.length} 条历史答案重新验算，生成异常队列
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleRun('参数调整复算')}
                className={cn('btn bg-amber-500 text-ink-900 hover:bg-amber-400 font-semibold')}
              >
                <Play className="w-4 h-4 mr-1.5" />
                运行验算
              </button>
              <button
                onClick={() => navigate('/')}
                className="btn bg-white/10 text-white hover:bg-white/20"
              >
                查看异常队列
              </button>
            </div>
          </div>
        </div>

        {currentRun && (
          <div className="card p-4">
            <div className="text-xs font-medium text-ink-400 mb-3">上次验算概况</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatItem label="运行名称" value={currentRun.name} />
              <StatItem label="总记录" value={currentRun.totalCount} />
              <StatItem label="异常数" value={currentRun.anomalyCount} highlight />
              <StatItem label="运行时间" value={new Date(currentRun.createdAt).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatItem({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-ink-400 mb-0.5">{label}</div>
      <div className={cn('text-sm font-semibold', highlight ? 'text-anomaly-unit' : 'text-ink-800')}>
        {value}
      </div>
    </div>
  );
}
