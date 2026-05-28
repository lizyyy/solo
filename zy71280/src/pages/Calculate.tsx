import React, { useEffect, useMemo } from 'react';
import { Calculator, AlertTriangle, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { useAuctionStore } from '../store/useAuctionStore';
import { ParameterSlider } from '../components/ParameterSlider';
import { RevenueChart } from '../components/RevenueChart';
import { MetricCard } from '../components/MetricCard';
import { formatCurrency, formatPercent, formatScenario } from '../utils/formatters';
import { cn } from '@/lib/utils';
import type { CalculationPoint } from '../types/auction';

const Calculate: React.FC = () => {
  const {
    items,
    selectedItemId,
    params,
    updateParams,
    calculationResults,
    optimalPoints,
    isCalculating,
    runCalculation,
    anomalies,
  } = useAuctionStore();

  const selectedItem = useMemo(
    () => items.find(i => i.id === selectedItemId),
    [items, selectedItemId]
  );

  const hasCriticalAnomaly = anomalies.some(a => a.severity === 'critical');
  const hasHighAnomaly = anomalies.some(a => a.severity === 'high');

  useEffect(() => {
    if (selectedItemId && calculationResults === null) {
      runCalculation();
    }
  }, [selectedItemId, calculationResults, runCalculation]);

  const handleParamChange = (key: keyof typeof params, value: number) => {
    updateParams({ [key]: value });
  };

  const handleRecalculate = () => {
    runCalculation();
  };

  const ScenarioCard: React.FC<{
    scenario: 'conservative' | 'neutral' | 'optimistic';
    point: CalculationPoint | null;
    icon: React.ReactNode;
  }> = ({ scenario, point, icon }) => {
    if (!point) return null;

    return (
      <div className={cn(
        'rounded-md border p-5',
        scenario === 'neutral'
          ? 'border-slate-800 bg-slate-800 text-white'
          : scenario === 'conservative'
          ? 'border-red-200 bg-red-50'
          : 'border-emerald-200 bg-emerald-50'
      )}>
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <h3 className={cn(
            'font-semibold',
            scenario === 'neutral' ? 'text-amber-400' : 'text-slate-700'
          )}>
            {formatScenario(scenario)}情景
          </h3>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className={cn('text-sm', scenario === 'neutral' ? 'text-slate-300' : 'text-slate-500')}>
              建议保留价
            </span>
            <span className={cn(
              'text-xl font-bold',
              scenario === 'neutral' ? 'text-amber-400' : 'text-slate-900',
              scenario === 'neutral' ? 'font-serif' : ''
            )} style={{ fontFamily: scenario === 'neutral' ? "'Cormorant Garamond', serif" : undefined }}>
              {formatCurrency(point.reservePrice)}
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className={cn('text-sm', scenario === 'neutral' ? 'text-slate-300' : 'text-slate-500')}>
              期望收益
            </span>
            <span className={cn('text-sm font-medium', scenario === 'neutral' ? 'text-white' : 'text-slate-700')}>
              {formatCurrency(point.expectedRevenue)}
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className={cn('text-sm', scenario === 'neutral' ? 'text-slate-300' : 'text-slate-500')}>
              流拍概率
            </span>
            <span className={cn(
              'text-sm font-medium',
              point.unsoldProbability > 0.4 ? 'text-red-600' : scenario === 'neutral' ? 'text-emerald-400' : 'text-emerald-600'
            )}>
              {formatPercent(point.unsoldProbability)}
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className={cn('text-sm', scenario === 'neutral' ? 'text-slate-300' : 'text-slate-500')}>
              置信度
            </span>
            <span className={cn(
              'text-sm font-medium',
              point.confidence < 0.7 ? 'text-amber-600' : scenario === 'neutral' ? 'text-emerald-400' : 'text-emerald-600'
            )}>
              {formatPercent(point.confidence)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  if (!selectedItem) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Calculator className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-700">请先选择分析拍品</h2>
          <p className="mt-2 text-sm text-slate-500">在「数据导入」页面选择一件拍品后开始计算</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            计算分析
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            调整参数，计算不同保留价下的期望收益和风险
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(hasCriticalAnomaly || hasHighAnomaly) && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-md">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-amber-700 font-medium">
                检测到{hasCriticalAnomaly ? '严重' : '高'}风险异常，建议先查看异常检测页
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-md border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900">{selectedItem.name}</h2>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-500">品类</p>
                <p className="text-sm font-medium text-slate-700">{selectedItem.category}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">估值</p>
                <p className="text-sm font-medium text-slate-900 font-mono">{formatCurrency(selectedItem.appraisedValue)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">品相</p>
                <p className="text-sm font-medium text-slate-700">{selectedItem.condition}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">估值机构</p>
                <p className="text-sm font-medium text-slate-700 truncate">{selectedItem.appraiser || '-'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {calculationResults && (
            <div className="bg-white rounded-md border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">收益期望曲线</h2>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Info className="w-4 h-4" />
                  悬停查看详细数据
                </div>
              </div>
              <RevenueChart
                data={calculationResults}
                optimalReservePrice={optimalPoints.neutral?.reservePrice}
              />
            </div>
          )}

          {calculationResults && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ScenarioCard
                scenario="conservative"
                point={optimalPoints.conservative}
                icon={<TrendingDown className="w-5 h-5 text-red-500" />}
              />
              <ScenarioCard
                scenario="neutral"
                point={optimalPoints.neutral}
                icon={<Minus className="w-5 h-5 text-amber-400" />}
              />
              <ScenarioCard
                scenario="optimistic"
                point={optimalPoints.optimistic}
                icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
              />
            </div>
          )}

          {calculationResults && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                title="建议保留价"
                value={formatCurrency(optimalPoints.neutral?.reservePrice || 0)}
                subtitle={`占估值 ${formatPercent((optimalPoints.neutral?.reservePrice || 0) / selectedItem.appraisedValue)}`}
                className="ring-2 ring-amber-400"
              />
              <MetricCard
                title="期望收益"
                value={formatCurrency(optimalPoints.neutral?.expectedRevenue || 0)}
                subtitle={`含佣金 ${formatCurrency(optimalPoints.neutral?.expectedCommission || 0)}`}
              />
              <MetricCard
                title="流拍概率"
                value={formatPercent(optimalPoints.neutral?.unsoldProbability || 0)}
                subtitle={
                  (optimalPoints.neutral?.unsoldProbability || 0) > params.maxUnsoldProbability
                    ? '超出可接受范围'
                    : '在可接受范围内'
                }
                trend={
                  (optimalPoints.neutral?.unsoldProbability || 0) > params.maxUnsoldProbability
                    ? 'down'
                    : 'neutral'
                }
              />
              <MetricCard
                title="置信度"
                value={formatPercent(optimalPoints.neutral?.confidence || 0)}
                subtitle={
                  (optimalPoints.neutral?.confidence || 0) >= 0.85
                    ? '结果可靠'
                    : (optimalPoints.neutral?.confidence || 0) >= 0.7
                    ? '参考使用'
                    : '建议补充数据'
                }
                trend={
                  (optimalPoints.neutral?.confidence || 0) >= 0.85
                    ? 'up'
                    : (optimalPoints.neutral?.confidence || 0) >= 0.7
                    ? 'neutral'
                    : 'down'
                }
              />
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-md border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">参数配置</h2>
              <button
                onClick={handleRecalculate}
                disabled={isCalculating}
                className="px-4 py-1.5 bg-slate-800 text-amber-400 text-sm font-medium rounded-md hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                {isCalculating ? '计算中...' : '重新计算'}
              </button>
            </div>
            <div className="space-y-5">
              <ParameterSlider
                label="风险容忍度"
                value={params.riskTolerance}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => handleParamChange('riskTolerance', v)}
                presets={[
                  { label: '保守', value: 0.2 },
                  { label: '中性', value: 0.5 },
                  { label: '激进', value: 0.8 },
                ]}
              />
              <ParameterSlider
                label="保留价下限/估值"
                value={params.minReserveRatio}
                min={0.3}
                max={0.7}
                step={0.05}
                unit="%"
                onChange={(v) => handleParamChange('minReserveRatio', v)}
              />
              <ParameterSlider
                label="保留价上限/估值"
                value={params.maxReserveRatio}
                min={0.6}
                max={1.0}
                step={0.05}
                unit="%"
                onChange={(v) => handleParamChange('maxReserveRatio', v)}
              />
              <ParameterSlider
                label="最大可接受流拍概率"
                value={params.maxUnsoldProbability}
                min={0.1}
                max={0.6}
                step={0.05}
                unit="%"
                onChange={(v) => handleParamChange('maxUnsoldProbability', v)}
              />
              <ParameterSlider
                label="最低佣金保障"
                value={params.minCommissionGuarantee}
                min={1000}
                max={20000}
                step={1000}
                unit="元"
                onChange={(v) => handleParamChange('minCommissionGuarantee', v)}
              />
              <ParameterSlider
                label="买家活跃度权重"
                value={params.buyerWeight}
                min={0}
                max={1}
                step={0.1}
                onChange={(v) => handleParamChange('buyerWeight', v)}
              />
              <ParameterSlider
                label="流拍成本系数"
                value={params.unsoldCostCoefficient}
                min={0.05}
                max={0.15}
                step={0.005}
                unit="%"
                onChange={(v) => handleParamChange('unsoldCostCoefficient', v)}
              />
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-50 to-amber-50 rounded-md border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">佣金阶梯设置</h3>
            <div className="space-y-2">
              {params.commissionTiers.map((tier) => (
                <div
                  key={tier.tier}
                  className="flex items-center justify-between p-2 bg-white rounded border border-slate-200"
                >
                  <div>
                    <p className="text-xs text-slate-500">{tier.description}</p>
                    <p className="text-xs font-mono text-slate-400">
                      {formatCurrency(tier.minAmount)} - {tier.maxAmount ? formatCurrency(tier.maxAmount) : '无限'}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-amber-600">{tier.rate}%</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              如需调整佣金阶梯，请在 <code>src/data/rules.json</code> 中修改配置
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calculate;
