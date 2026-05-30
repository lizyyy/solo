import { useState } from 'react';
import { useAppStore } from '@/store';
import { generateCashFlows, calculateDuration, calculateConvexity, calculateSensitivity } from '@/utils/calculationEngine';
import CalculationSteps from '@/components/CalculationSteps';
import CashFlowTable from '@/components/CashFlowTable';
import ReactECharts from 'echarts-for-react';
import { Decimal } from 'decimal.js';

export default function Calculator() {
  const { 
    bonds, curves, calculationParams, setCalculationParams, generateReport, exceptions, toggleExceptionDrawer 
  } = useAppStore();
  
  const [selectedBond, setSelectedBond] = useState<string>('');
  const [selectedCurve, setSelectedCurve] = useState<string>('');
  const [calculated, setCalculated] = useState(false);
  const [cashFlows, setCashFlows] = useState<any[]>([]);
  const [durationResult, setDurationResult] = useState<any>(null);
  const [convexityResult, setConvexityResult] = useState<any>(null);
  const [sensitivityResult, setSensitivityResult] = useState<any>(null);

  const handleCalculate = () => {
    const bond = bonds.find((b) => b.id === selectedBond);
    const curve = curves.find((c) => c.id === selectedCurve);

    if (!bond || !curve) return;

    const { cashFlows: cf } = generateCashFlows(bond);
    setCashFlows(cf);

    const ytm = curve.points.length > 0 ? curve.points[Math.floor(curve.points.length / 2)].rate : new Decimal(0.03);
    
    const { result: duration } = calculateDuration(bond, cf, ytm, calculationParams.valuationDate, curve);
    setDurationResult(duration);

    const { result: convexity } = calculateConvexity(bond, cf, ytm, calculationParams.valuationDate, curve);
    setConvexityResult(convexity);

    const sensitivity = calculateSensitivity(bond, cf, ytm, calculationParams.valuationDate, calculationParams);
    setSensitivityResult(sensitivity);

    setCalculated(true);
  };

  const handleGenerateReport = () => {
    if (!selectedBond || !selectedCurve) return;
    generateReport(selectedBond, selectedCurve, calculationParams);
    alert('报告已生成，请前往报告中心查看');
  };

  const priceChartOption = sensitivityResult ? {
    tooltip: {
      trigger: 'axis',
    },
    legend: {
      data: ['实际价格', '久期估计', '久期+凸性估计'],
      top: 0,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      name: '收益率变动 (bp)',
    },
    yAxis: {
      type: 'value',
      name: '价格 (元)',
    },
    series: [
      {
        name: '实际价格',
        type: 'line',
        smooth: true,
        data: [
          [-100, sensitivityResult.largeDownPrice.toNumber()],
          [-1, sensitivityResult.smallDownPrice.toNumber()],
          [0, sensitivityResult.basePrice.toNumber()],
          [1, sensitivityResult.smallUpPrice.toNumber()],
          [100, sensitivityResult.largeUpPrice.toNumber()],
        ],
        lineStyle: { width: 3, color: '#1e3a5f' },
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: { color: '#c9a227' },
      },
      {
        name: '久期估计',
        type: 'line',
        smooth: true,
        lineStyle: { type: 'dashed', color: '#e74c3c' },
        data: [
          [-100, sensitivityResult.basePrice.mul(1 + sensitivityResult.largeDurationEffect.div(100)).toNumber()],
          [0, sensitivityResult.basePrice.toNumber()],
          [100, sensitivityResult.basePrice.mul(1 - sensitivityResult.largeDurationEffect.div(100)).toNumber()],
        ],
      },
      {
        name: '久期+凸性估计',
        type: 'line',
        smooth: true,
        lineStyle: { type: 'dotted', color: '#27ae60' },
        data: [
          [-100, sensitivityResult.basePrice.mul(1 + (sensitivityResult.largeDurationEffect.plus(sensitivityResult.largeConvexityEffect)).div(100)).toNumber()],
          [0, sensitivityResult.basePrice.toNumber()],
          [100, sensitivityResult.basePrice.mul(1 - (sensitivityResult.largeDurationEffect.minus(sensitivityResult.largeConvexityEffect)).div(100)).toNumber()],
        ],
      },
    ],
  } : {};

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-xl font-bold text-navy-800">计算分析</h1>
          <p className="mt-1 text-navy-500 text-sm">计算久期、凸性，分析敏感性对比</p>
        </div>
        {exceptions.length > 0 && (
          <button
            onClick={toggleExceptionDrawer}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <span>⚠️</span>
            <span>异常 ({exceptions.length})</span>
          </button>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="font-serif font-semibold text-navy-800">计算参数</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-4 gap-6">
            <div>
              <label className="block text-sm text-navy-600 mb-1">选择债券</label>
              <select
                value={selectedBond}
                onChange={(e) => setSelectedBond(e.target.value)}
                className="w-full px-3 py-2 border border-navy-200 rounded text-sm"
              >
                <option value="">请选择债券</option>
                {bonds.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-navy-600 mb-1">选择收益率曲线</label>
              <select
                value={selectedCurve}
                onChange={(e) => setSelectedCurve(e.target.value)}
                className="w-full px-3 py-2 border border-navy-200 rounded text-sm"
              >
                <option value="">请选择曲线</option>
                {curves.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-navy-600 mb-1">估值日</label>
              <input
                type="date"
                value={calculationParams.valuationDate}
                onChange={(e) => setCalculationParams({ valuationDate: e.target.value })}
                className="w-full px-3 py-2 border border-navy-200 rounded text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-navy-600 mb-1">小变动(bp)</label>
                <input
                  type="number"
                  value={calculationParams.yieldShiftBpSmall}
                  onChange={(e) => setCalculationParams({ yieldShiftBpSmall: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-navy-200 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-navy-600 mb-1">大变动(bp)</label>
                <input
                  type="number"
                  value={calculationParams.yieldShiftBpLarge}
                  onChange={(e) => setCalculationParams({ yieldShiftBpLarge: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-navy-200 rounded text-sm"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={handleCalculate}
              disabled={!selectedBond || !selectedCurve}
              className="btn-gold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              开始计算
            </button>
            {calculated && (
              <button onClick={handleGenerateReport} className="btn-primary">
                生成报告
              </button>
            )}
          </div>
        </div>
      </div>

      {calculated && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <div className="card card-body">
              <p className="text-navy-500 text-sm">麦考利久期</p>
              <p className="mt-2 text-2xl font-bold text-navy-800 font-serif">
                {durationResult?.macaulayDuration.toFixed(4)}
                <span className="text-sm font-normal text-navy-500 ml-1">年</span>
              </p>
            </div>
            <div className="card card-body">
              <p className="text-navy-500 text-sm">修正久期</p>
              <p className="mt-2 text-2xl font-bold text-navy-800 font-serif">
                {durationResult?.modifiedDuration.toFixed(4)}
              </p>
            </div>
            <div className="card card-body">
              <p className="text-navy-500 text-sm">凸性</p>
              <p className={`mt-2 text-2xl font-bold font-serif ${
                convexityResult?.signCheck === 'ABNORMAL' ? 'text-red-600' : 'text-navy-800'
              }`}>
                {convexityResult?.convexity.toFixed(4)}
              </p>
              {convexityResult?.signCheck === 'ABNORMAL' && (
                <p className="text-xs text-red-500 mt-1">符号异常</p>
              )}
            </div>
            <div className="card card-body">
              <p className="text-navy-500 text-sm">DV01</p>
              <p className="mt-2 text-2xl font-bold text-navy-800 font-serif">
                {durationResult?.dv01.toFixed(4)}
                <span className="text-sm font-normal text-navy-500 ml-1">元/bp</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <CalculationSteps 
              title="久期计算过程" 
              steps={durationResult?.calculationSteps || []} 
            />
            <CalculationSteps 
              title="凸性计算过程" 
              steps={convexityResult?.calculationSteps || []} 
            />
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="font-serif font-semibold text-navy-800">敏感性对比分析</h3>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-navy-700 mb-4">价格变动曲线</h4>
                  <div className="h-72">
                    <ReactECharts 
                      option={priceChartOption} 
                      style={{ height: '100%', width: '100%' }}
                      opts={{ renderer: 'svg' }}
                    />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-navy-700 mb-4">对比数据</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-navy-200">
                        <th className="text-left py-2 text-navy-600">指标</th>
                        <th className="text-center py-2 text-navy-600">小变动 (±{calculationParams.yieldShiftBpSmall}bp)</th>
                        <th className="text-center py-2 text-navy-600">大变动 (±{calculationParams.yieldShiftBpLarge}bp)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-navy-100">
                        <td className="py-2 text-navy-700">基准价格</td>
                        <td className="py-2 text-center font-mono" colSpan={2}>
                          {sensitivityResult?.basePrice.toFixed(4)} 元
                        </td>
                      </tr>
                      <tr className="border-b border-navy-100">
                        <td className="py-2 text-navy-700">上涨后价格</td>
                        <td className="py-2 text-center font-mono">{sensitivityResult?.smallUpPrice.toFixed(4)}</td>
                        <td className="py-2 text-center font-mono">{sensitivityResult?.largeUpPrice.toFixed(4)}</td>
                      </tr>
                      <tr className="border-b border-navy-100">
                        <td className="py-2 text-navy-700">下跌后价格</td>
                        <td className="py-2 text-center font-mono">{sensitivityResult?.smallDownPrice.toFixed(4)}</td>
                        <td className="py-2 text-center font-mono">{sensitivityResult?.largeDownPrice.toFixed(4)}</td>
                      </tr>
                      <tr className="border-b border-navy-100 bg-navy-50">
                        <td className="py-2 text-navy-700">久期效应</td>
                        <td className="py-2 text-center font-mono text-blue-600">
                          {sensitivityResult?.smallDurationEffect.toFixed(4)}%
                        </td>
                        <td className="py-2 text-center font-mono text-blue-600">
                          {sensitivityResult?.largeDurationEffect.toFixed(4)}%
                        </td>
                      </tr>
                      <tr className="border-b border-navy-100 bg-gold-50">
                        <td className="py-2 text-navy-700">凸性效应</td>
                        <td className="py-2 text-center font-mono text-gold-600">
                          {sensitivityResult?.smallConvexityEffect.toFixed(6)}%
                        </td>
                        <td className="py-2 text-center font-mono text-gold-600">
                          {sensitivityResult?.largeConvexityEffect.toFixed(4)}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gold-50 rounded border border-gold-200">
                <h5 className="text-sm font-medium text-gold-700 mb-2">💡 价格差异解释</h5>
                <p className="text-sm text-gold-600 whitespace-pre-line">
                  {sensitivityResult?.priceDiffExplanation}
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="font-serif font-semibold text-navy-800">现金流明细</h3>
            </div>
            <div className="card-body">
              <CashFlowTable cashFlows={cashFlows} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
