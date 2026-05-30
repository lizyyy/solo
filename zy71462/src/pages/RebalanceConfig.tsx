import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useBatchStore } from '@/store/batchStore';
import { useTemplateStore } from '@/store/templateStore';
import { runRebalanceOptimization, RebalanceInput } from '@/utils/optimization/rebalanceEngine';
import { validateAll } from '@/utils/validation/dataValidator';
import { OptimizationTarget, MATERIAL_TYPE_LABELS } from '@/types';
import { Settings, Play, AlertTriangle, CheckCircle, Save, ArrowRight, Info } from 'lucide-react';

const RebalanceConfig: React.FC = () => {
  const { 
    currentBatch, 
    materials, 
    holdings, 
    targetWeights, 
    priceQuotes,
    config,
    setConfig,
    setCurrentTask,
    setTrades,
    setEvidenceRecords,
    setValidationErrors,
    setCalculating,
    setCalculationProgress,
    updateBatchStatus,
    isCalculating,
  } = useBatchStore();

  const { templates, applyTemplate } = useTemplateStore();
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const materialStatus = {
    holding: holdings.length > 0,
    target: targetWeights.length > 0,
    price: priceQuotes.length > 0,
  };

  const canCalculate = materialStatus.holding && materialStatus.target;

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      applyTemplate(template.id, setConfig);
    }
  };

  const handleOptimize = async () => {
    if (!currentBatch || !canCalculate) return;

    const getMaterialId = (type: 'holding' | 'target' | 'price') => {
      const m = materials.find(mat => mat.type === type);
      return m?.id || 'unknown';
    };

    const materialIds = {
      holding: getMaterialId('holding'),
      target: getMaterialId('target'),
      price: getMaterialId('price'),
    };

    const errors = validateAll(holdings, targetWeights, priceQuotes, config, materialIds);
    setValidationErrors(errors);

    if (errors.some(e => e.severity === 'error')) {
      updateBatchStatus('error');
      return;
    }

    setCalculating(true);
    updateBatchStatus('calculating');
    setCalculationProgress(0, '开始再平衡优化...');

    try {
      const input: RebalanceInput = {
        holdings,
        targetWeights,
        priceQuotes,
        config,
        materialIds,
      };

      const result = await runRebalanceOptimization(
        input,
        (progress, message) => {
          setCalculationProgress(progress, message);
        }
      );

      setCurrentTask(result.task);
      setTrades(result.trades);
      setEvidenceRecords(result.evidenceRecords);
      updateBatchStatus('completed');
    } catch (error: any) {
      console.error('Optimization failed:', error);
      updateBatchStatus('error');
    } finally {
      setCalculating(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">再平衡参数配置</h1>
            <p className="mt-1 text-sm text-slate-400">
              设置税费规则、亏损抵扣规则、持有期约束和优化目标
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isCalculating && (
              <Badge variant="warning">计算中...</Badge>
            )}
            <Link to="/result">
              <Button variant="secondary">
                查看结果 <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>

        {!canCalculate && (
          <Card className="p-4 border-amber-500/30 bg-amber-500/5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-amber-400 mb-1">材料不完整</h3>
                <p className="text-sm text-slate-400">
                  请先导入持仓表和目标权重后再进行计算。
                  {!materialStatus.holding && ` 缺少：${MATERIAL_TYPE_LABELS.holding}`}
                  {!materialStatus.target && ` 缺少：${MATERIAL_TYPE_LABELS.target}`}
                </p>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-4">
          <h3 className="font-medium text-white mb-4 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            快速模板
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className={`p-3 rounded-md border cursor-pointer transition-colors ${
                  selectedTemplate === template.id
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-slate-700 hover:bg-slate-800/50'
                }`}
                onClick={() => handleTemplateChange(template.id)}
              >
                <div className="font-medium text-white text-sm">{template.name}</div>
                <div className="text-xs text-slate-400 mt-1">{template.description}</div>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <h3 className="font-medium text-white mb-4">优化目标</h3>
            <div className="space-y-2">
              {(['minimize_tax', 'maximize_after_tax', 'minimize_tracking_error'] as OptimizationTarget[]).map((target) => (
                <label
                  key={target}
                  className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                    config.optimizationTarget === target
                      ? 'border-emerald-500/50 bg-emerald-500/10'
                      : 'border-slate-700 hover:bg-slate-800/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="optimizationTarget"
                    checked={config.optimizationTarget === target}
                    onChange={() => setConfig({ optimizationTarget: target })}
                    className="w-4 h-4 text-emerald-500 bg-slate-800 border-slate-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="text-sm text-white">
                      {target === 'minimize_tax' && '最小化税费'}
                      {target === 'maximize_after_tax' && '最大化税后收益'}
                      {target === 'minimize_tracking_error' && '最小化跟踪误差'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {target === 'minimize_tax' && '优先考虑税费成本，尽量减少交易产生的税费'}
                      {target === 'maximize_after_tax' && '综合考虑收益和税费，追求税后净收益最大化'}
                      {target === 'minimize_tracking_error' && '优先贴近目标权重，税费作为次要考虑'}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-medium text-white mb-4">交易约束</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-300 block mb-1">最小交易金额 (元)</label>
                <input
                  type="number"
                  value={config.constraints.minTradeValue}
                  onChange={(e) => setConfig({ constraints: { ...config.constraints, minTradeValue: Number(e.target.value) } })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-600"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300 block mb-1">最大换手率 (%)</label>
                <input
                  type="number"
                  value={config.constraints.maxTurnoverPct * 100}
                  onChange={(e) => setConfig({ constraints: { ...config.constraints, maxTurnoverPct: Number(e.target.value) / 100 } })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-600"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.constraints.allowShortTermSell}
                  onChange={(e) => setConfig({ constraints: { ...config.constraints, allowShortTermSell: e.target.checked } })}
                  className="w-4 h-4 text-emerald-500 bg-slate-800 border-slate-600 rounded focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-300">允许卖出短期持有持仓</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.constraints.washSaleProtection}
                  onChange={(e) => setConfig({ constraints: { ...config.constraints, washSaleProtection: e.target.checked } })}
                  className="w-4 h-4 text-emerald-500 bg-slate-800 border-slate-600 rounded focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-300">启用 Wash Sale 保护</span>
              </label>
            </div>
          </Card>
        </div>

        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setShowAdvanced(!showAdvanced)}>
            <Info className="w-4 h-4 mr-2" />
            {showAdvanced ? '收起高级设置' : '展开高级设置'}
          </Button>
        </div>

        {showAdvanced && (
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4">
              <h3 className="font-medium text-white mb-4">税费规则</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-slate-400 block mb-1">印花税税率</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={config.taxRules.stampDutyRate * 100}
                    onChange={(e) => setConfig({ taxRules: { ...config.taxRules, stampDutyRate: Number(e.target.value) / 100 } })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">佣金费率 (%)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={config.taxRules.commissionRate * 100}
                    onChange={(e) => setConfig({ taxRules: { ...config.taxRules, commissionRate: Number(e.target.value) / 100 } })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">最低佣金 (元)</label>
                  <input
                    type="number"
                    value={config.taxRules.commissionMin}
                    onChange={(e) => setConfig({ taxRules: { ...config.taxRules, commissionMin: Number(e.target.value) } })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">短期利得税率 (%)</label>
                  <input
                    type="number"
                    value={config.taxRules.shortTermCapitalGainsRate * 100}
                    onChange={(e) => setConfig({ taxRules: { ...config.taxRules, shortTermCapitalGainsRate: Number(e.target.value) / 100 } })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">长期利得税率 (%)</label>
                  <input
                    type="number"
                    value={config.taxRules.longTermCapitalGainsRate * 100}
                    onChange={(e) => setConfig({ taxRules: { ...config.taxRules, longTermCapitalGainsRate: Number(e.target.value) / 100 } })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-white text-sm"
                  />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-medium text-white mb-4">亏损抵扣规则</h3>
              <div className="space-y-3 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.lossOffsetRules.enabled}
                    onChange={(e) => setConfig({ lossOffsetRules: { ...config.lossOffsetRules, enabled: e.target.checked } })}
                    className="w-4 h-4 text-emerald-500 bg-slate-800 border-slate-600 rounded focus:ring-emerald-500"
                  />
                  <span className="text-slate-300">启用亏损抵扣</span>
                </label>
                <div>
                  <label className="text-slate-400 block mb-1">亏损结转年限</label>
                  <input
                    type="number"
                    value={config.lossOffsetRules.carryForwardYears}
                    onChange={(e) => setConfig({ lossOffsetRules: { ...config.lossOffsetRules, carryForwardYears: Number(e.target.value) } })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Wash Sale 保护期 (天)</label>
                  <input
                    type="number"
                    value={config.lossOffsetRules.washSaleProtectionDays}
                    onChange={(e) => setConfig({ lossOffsetRules: { ...config.lossOffsetRules, washSaleProtectionDays: Number(e.target.value) } })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">以前年度亏损 (元)</label>
                  <input
                    type="number"
                    value={config.lossOffsetRules.priorYearLosses}
                    onChange={(e) => setConfig({ lossOffsetRules: { ...config.lossOffsetRules, priorYearLosses: Number(e.target.value) } })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">抵扣顺序</label>
                  <select
                    value={config.lossOffsetRules.offsetOrder}
                    onChange={(e) => setConfig({ lossOffsetRules: { ...config.lossOffsetRules, offsetOrder: e.target.value as 'short_first' | 'long_first' } })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-white text-sm"
                  >
                    <option value="short_first">短期亏损优先</option>
                    <option value="long_first">长期亏损优先</option>
                  </select>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-medium text-white mb-4">持有期规则</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-slate-400 block mb-1">最低持有天数</label>
                  <input
                    type="number"
                    value={config.holdingPeriodRules.minHoldingDays}
                    onChange={(e) => setConfig({ holdingPeriodRules: { ...config.holdingPeriodRules, minHoldingDays: Number(e.target.value) } })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">短期持有阈值 (天)</label>
                  <input
                    type="number"
                    value={config.holdingPeriodRules.shortTermThresholdDays}
                    onChange={(e) => setConfig({ holdingPeriodRules: { ...config.holdingPeriodRules, shortTermThresholdDays: Number(e.target.value) } })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">长期持有阈值 (天)</label>
                  <input
                    type="number"
                    value={config.holdingPeriodRules.longTermThresholdDays}
                    onChange={(e) => setConfig({ holdingPeriodRules: { ...config.holdingPeriodRules, longTermThresholdDays: Number(e.target.value) } })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-white text-sm"
                  />
                </div>
              </div>
            </Card>
          </div>
        )}

        {isCalculating && (
          <Card className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{useBatchStore.getState().calculationMessage}</span>
                <span className="text-slate-500 font-mono">{Math.round(useBatchStore.getState().calculationProgress * 100)}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
                  style={{ width: `${useBatchStore.getState().calculationProgress * 100}%` }}
                />
              </div>
            </div>
          </Card>
        )}

        <div className="flex items-center justify-between pt-4">
          <div className="text-sm text-slate-500">
            {canCalculate 
              ? '参数配置完成，可以开始再平衡优化计算' 
              : '请先导入必要的材料数据'}
          </div>
          <div className="flex items-center gap-3">
            <Link to="/import">
              <Button variant="secondary">
                返回导入
              </Button>
            </Link>
            <Button 
              variant="primary" 
              disabled={!canCalculate || isCalculating}
              onClick={handleOptimize}
            >
              <Play className="w-4 h-4 mr-2" />
              {isCalculating ? '计算中...' : '开始计算'}
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default RebalanceConfig;
