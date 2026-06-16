import React, { useState, useMemo } from 'react';
import {
  Calculator,
  Scale,
  AlertTriangle,
  BarChart3,
  Target,
  Info,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  HelpCircle,
} from 'lucide-react';
import type { FittingResult, ProcessedData } from '../../types';
import { formatNumber, formatScientific } from '../../utils/format';
import { predictLife } from '../../services/fittingAlgorithm';
import { cn } from '../../lib/utils';

interface WeightClosureStatus {
  value: number;
  isClosed: boolean;
  threshold: number;
  details: string;
}

interface BoundaryStatus {
  minStress: number;
  maxStress: number;
  outOfBounds: {
    dataId: string;
    stress: number;
    direction: 'below' | 'above';
  }[];
}

interface ReportSummaryProps {
  fittingResult: FittingResult;
  processedData: ProcessedData[];
  weightClosureStatus: WeightClosureStatus;
  boundaryStatus: BoundaryStatus;
}

const ReportSummary: React.FC<ReportSummaryProps> = ({
  fittingResult,
  processedData,
  weightClosureStatus,
  boundaryStatus,
}) => {
  const [inputStress, setInputStress] = useState<string>('700');
  const [showBoundaryList, setShowBoundaryList] = useState(false);

  const dataStats = useMemo(() => {
    const total = processedData.length;
    const normal = processedData.filter((d) => d.status === 'normal').length;
    const pending = processedData.filter((d) => d.status === 'pending').length;
    const historical = processedData.filter((d) => d.status === 'historical').length;
    return { total, normal, pending, historical };
  }, [processedData]);

  const prediction = useMemo(() => {
    const stress = parseFloat(inputStress);
    if (isNaN(stress) || stress <= 0) return null;

    const { model, parameters } = fittingResult;
    const predictedLife = predictLife(stress, model, parameters);

    const r2 = parameters.r2;
    const errorMargin = (1 - r2) * 0.5;
    const lower = predictedLife * (1 - errorMargin);
    const upper = predictedLife * (1 + errorMargin);

    return { life: predictedLife, lower, upper };
  }, [inputStress, fittingResult]);

  const getModelName = (model: string): string => {
    const map: Record<string, string> = {
      power: '幂函数模型',
      exponential: '指数函数模型',
      basquin: 'Basquin模型',
    };
    return map[model] || model;
  };

  const getR2Status = (r2: number): { color: string; label: string } => {
    if (r2 >= 0.95) return { color: 'text-success-600', label: '优秀' };
    if (r2 >= 0.85) return { color: 'text-blue-600', label: '良好' };
    if (r2 >= 0.7) return { color: 'text-warning-600', label: '一般' };
    return { color: 'text-danger-600', label: '较差' };
  };

  const r2Status = getR2Status(fittingResult.parameters.r2);

  const renderWhySuggestion = (content: string) => (
    <div className="mt-4 p-3 bg-engineering-50 border border-engineering-200 rounded-engineering">
      <div className="flex items-start gap-2">
        <HelpCircle className="w-4 h-4 text-engineering-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-semibold text-engineering-700 mb-1">为什么这样建议</p>
          <p className="text-xs text-engineering-600 leading-relaxed">{content}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="w-6 h-6 text-engineering-700" />
        <h2 className="text-xl font-serif-cn font-bold text-engineering-800">拟合结果汇总报告</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card bg-white border-engineering-200 border p-6 shadow-engineering hover:shadow-engineering-hover transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-engineering-100 rounded-engineering">
              <Calculator className="w-5 h-5 text-engineering-700" />
            </div>
            <div>
              <h3 className="text-lg font-serif-cn font-semibold text-engineering-800">拟合公式</h3>
              <p className="text-xs text-engineering-500">{getModelName(fittingResult.model)}</p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-engineering-50 to-engineering-100 p-6 rounded-engineering mb-4">
            <div className="text-center">
              <p className="text-sm text-engineering-600 mb-2">拟合公式</p>
              <p className="text-3xl font-mono-num font-bold text-engineering-800 tracking-wide">
                {fittingResult.formula}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-engineering-50 rounded-engineering">
              <p className="text-xs text-engineering-600 mb-1">决定系数 R²</p>
              <p className={cn('text-4xl font-mono-num font-bold', r2Status.color)}>
                {fittingResult.parameters.r2.toFixed(4)}
              </p>
              <p className={cn('text-xs mt-1 font-medium', r2Status.color)}>
                {r2Status.label}
              </p>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-engineering-600">系数 a</p>
                <p className="text-xl font-mono-num font-semibold text-engineering-700">
                  {formatScientific(fittingResult.parameters.a)}
                </p>
              </div>
              <div>
                <p className="text-xs text-engineering-600">指数 b</p>
                <p className="text-xl font-mono-num font-semibold text-engineering-700">
                  {fittingResult.parameters.b.toFixed(4)}
                </p>
              </div>
            </div>
          </div>

          {renderWhySuggestion(
            'R²值越接近1，表示模型对数据的拟合程度越好。工程应用中通常要求R²≥0.95。如果R²较低，建议检查数据质量或尝试其他拟合模型。'
          )}
        </div>

        <div className="card bg-white border-engineering-200 border p-6 shadow-engineering hover:shadow-engineering-hover transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className={cn(
              'p-2 rounded-engineering',
              weightClosureStatus.isClosed ? 'bg-success-100' : 'bg-warning-100'
            )}>
              <Scale className={cn(
                'w-5 h-5',
                weightClosureStatus.isClosed ? 'text-success-700' : 'text-warning-700'
              )} />
            </div>
            <div>
              <h3 className="text-lg font-serif-cn font-semibold text-engineering-800">权重闭合状态</h3>
              <p className="text-xs text-engineering-500">权重因子收敛性检查</p>
            </div>
          </div>

          <div className="text-center p-6 bg-gradient-to-r from-engineering-50 to-engineering-100 rounded-engineering mb-4">
            <p className="text-sm text-engineering-600 mb-2">闭合度</p>
            <p className={cn(
              'text-5xl font-mono-num font-bold',
              weightClosureStatus.isClosed ? 'text-success-600' : 'text-warning-600'
            )}>
              {weightClosureStatus.value.toFixed(2)}%
            </p>
            <div className="flex items-center justify-center gap-2 mt-3">
              {weightClosureStatus.isClosed ? (
                <>
                  <CheckCircle className="w-5 h-5 text-success-600" />
                  <span className="text-success-700 font-semibold">状态：已闭合</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-warning-600" />
                  <span className="text-warning-700 font-semibold">状态：未闭合</span>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-engineering-50 rounded-engineering">
              <p className="text-xs text-engineering-600 mb-1">闭合阈值</p>
              <p className="text-xl font-mono-num font-semibold text-engineering-700">
                ≤ {weightClosureStatus.threshold}%
              </p>
            </div>
            <div className="p-3 bg-engineering-50 rounded-engineering">
              <p className="text-xs text-engineering-600 mb-1">偏差程度</p>
              <p className="text-xl font-mono-num font-semibold text-engineering-700">
                {Math.abs(weightClosureStatus.value - weightClosureStatus.threshold).toFixed(2)}%
              </p>
            </div>
          </div>

          <p className="text-sm text-engineering-600 mt-4 p-3 bg-engineering-50 rounded-engineering">
            {weightClosureStatus.details}
          </p>

          {renderWhySuggestion(
            '权重闭合度反映了不同应力水平下数据点权重的平衡状态。闭合度≤5%时认为权重分配合理，模型预测结果可靠。如未闭合，建议检查各应力水平的数据点数量是否均衡。'
          )}
        </div>

        <div className="card bg-white border-engineering-200 border p-6 shadow-engineering hover:shadow-engineering-hover transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className={cn(
              'p-2 rounded-engineering',
              boundaryStatus.outOfBounds.length === 0 ? 'bg-success-100' : 'bg-danger-100'
            )}>
              <AlertTriangle className={cn(
                'w-5 h-5',
                boundaryStatus.outOfBounds.length === 0 ? 'text-success-700' : 'text-danger-700'
              )} />
            </div>
            <div>
              <h3 className="text-lg font-serif-cn font-semibold text-engineering-800">边界阈值检查</h3>
              <p className="text-xs text-engineering-500">数据点应力范围验证</p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-engineering-50 to-engineering-100 p-6 rounded-engineering mb-4">
            <div className="flex items-center justify-between">
              <div className="text-center">
                <p className="text-xs text-engineering-600 mb-1">最小应力</p>
                <p className="text-2xl font-mono-num font-bold text-engineering-700">
                  {formatNumber(boundaryStatus.minStress)}
                </p>
                <p className="text-xs text-engineering-500">MPa</p>
              </div>
              <div className="flex-1 mx-4">
                <div className="h-2 bg-engineering-200 rounded-full relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-engineering-400 via-engineering-600 to-engineering-400 rounded-full" />
                </div>
                <p className="text-center text-xs text-engineering-500 mt-2">有效拟合区间</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-engineering-600 mb-1">最大应力</p>
                <p className="text-2xl font-mono-num font-bold text-engineering-700">
                  {formatNumber(boundaryStatus.maxStress)}
                </p>
                <p className="text-xs text-engineering-500">MPa</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-4 bg-engineering-50 rounded-engineering text-center">
              <p className="text-xs text-engineering-600 mb-1">超出边界条数</p>
              <p className={cn(
                'text-3xl font-mono-num font-bold',
                boundaryStatus.outOfBounds.length === 0 ? 'text-success-600' : 'text-danger-600'
              )}>
                {boundaryStatus.outOfBounds.length}
              </p>
            </div>
            <div className="p-4 bg-engineering-50 rounded-engineering text-center">
              <p className="text-xs text-engineering-600 mb-1">检查结果</p>
              <p className={cn(
                'text-lg font-bold mt-2',
                boundaryStatus.outOfBounds.length === 0 ? 'text-success-600' : 'text-danger-600'
              )}>
                {boundaryStatus.outOfBounds.length === 0 ? '全部通过' : '存在异常'}
              </p>
            </div>
          </div>

          {boundaryStatus.outOfBounds.length > 0 && (
            <div>
              <button
                onClick={() => setShowBoundaryList(!showBoundaryList)}
                className="flex items-center justify-between w-full p-3 bg-danger-50 border border-danger-200 rounded-engineering text-danger-700 hover:bg-danger-100 transition-colors"
              >
                <span className="text-sm font-medium">查看超出边界的详细列表</span>
                {showBoundaryList ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showBoundaryList && (
                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                  {boundaryStatus.outOfBounds.map((item, index) => (
                    <div
                      key={`${item.dataId}-${index}`}
                      className="flex items-center justify-between p-3 bg-danger-50 border border-danger-200 rounded-engineering"
                    >
                      <div className="flex items-center gap-2">
                        <TrendingDown className={cn(
                          'w-4 h-4',
                          item.direction === 'below' ? 'text-warning-600' : 'text-danger-600'
                        )} />
                        <span className="font-mono-num text-sm text-engineering-700">{item.dataId}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          'text-sm font-mono-num font-semibold',
                          item.direction === 'below' ? 'text-warning-600' : 'text-danger-600'
                        )}>
                          {formatNumber(item.stress)} MPa
                        </span>
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded',
                          item.direction === 'below'
                            ? 'bg-warning-100 text-warning-700'
                            : 'bg-danger-100 text-danger-700'
                        )}>
                          {item.direction === 'below' ? '低于下限' : '高于上限'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {renderWhySuggestion(
            '模型仅在拟合数据的应力范围内有效。超出边界的数据点可能导致预测结果不准确。建议删除或标记超出边界的数据，或补充相应应力水平的试验数据。'
          )}
        </div>

        <div className="card bg-white border-engineering-200 border p-6 shadow-engineering hover:shadow-engineering-hover transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-engineering-100 rounded-engineering">
              <BarChart3 className="w-5 h-5 text-engineering-700" />
            </div>
            <div>
              <h3 className="text-lg font-serif-cn font-semibold text-engineering-800">数据统计</h3>
              <p className="text-xs text-engineering-500">各状态数据条数统计</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-5 bg-gradient-to-br from-engineering-50 to-engineering-100 rounded-engineering text-center">
              <p className="text-sm text-engineering-600 mb-1">总条数</p>
              <p className="text-4xl font-mono-num font-bold text-engineering-700">
                {dataStats.total}
              </p>
            </div>
            <div className="p-5 bg-gradient-to-br from-success-50 to-success-100 rounded-engineering text-center">
              <p className="text-sm text-success-600 mb-1">正常条数</p>
              <p className="text-4xl font-mono-num font-bold text-success-600">
                {dataStats.normal}
              </p>
            </div>
            <div className="p-5 bg-gradient-to-br from-warning-50 to-warning-100 rounded-engineering text-center">
              <p className="text-sm text-warning-600 mb-1">待确认条数</p>
              <p className="text-4xl font-mono-num font-bold text-warning-600">
                {dataStats.pending}
              </p>
            </div>
            <div className="p-5 bg-gradient-to-br from-historical-50 to-historical-100 rounded-engineering text-center">
              <p className="text-sm text-historical-600 mb-1">历史数据条数</p>
              <p className="text-4xl font-mono-num font-bold text-historical-600">
                {dataStats.historical}
              </p>
            </div>
          </div>

          <div className="h-3 bg-engineering-100 rounded-full overflow-hidden">
            <div className="h-full flex">
              <div
                className="bg-success-500 transition-all duration-500"
                style={{ width: `${(dataStats.normal / dataStats.total) * 100}%` }}
              />
              <div
                className="bg-warning-500 transition-all duration-500"
                style={{ width: `${(dataStats.pending / dataStats.total) * 100}%` }}
              />
              <div
                className="bg-historical-500 transition-all duration-500"
                style={{ width: `${(dataStats.historical / dataStats.total) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex justify-between mt-2 text-xs">
            <span className="text-success-600">正常 {((dataStats.normal / dataStats.total) * 100).toFixed(1)}%</span>
            <span className="text-warning-600">待确认 {((dataStats.pending / dataStats.total) * 100).toFixed(1)}%</span>
            <span className="text-historical-600">历史 {((dataStats.historical / dataStats.total) * 100).toFixed(1)}%</span>
          </div>

          {renderWhySuggestion(
            '数据质量直接影响拟合结果的可靠性。建议待确认数据占比控制在10%以内。历史数据可作为参考，但权重应适当降低，以反映最新的材料性能。'
          )}
        </div>
      </div>

      <div className="card bg-white border-engineering-200 border p-6 shadow-engineering hover:shadow-engineering-hover transition-shadow">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-engineering-100 rounded-engineering">
            <Target className="w-5 h-5 text-engineering-700" />
          </div>
          <div>
            <h3 className="text-lg font-serif-cn font-semibold text-engineering-800">预测寿命示例</h3>
            <p className="text-xs text-engineering-500">输入应力值，预测对应的疲劳寿命</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-engineering-700 mb-2">
              输入应力 (MPa)
            </label>
            <input
              type="number"
              value={inputStress}
              onChange={(e) => setInputStress(e.target.value)}
              className="w-full px-4 py-3 text-xl font-mono-num font-semibold text-engineering-800 border-2 border-engineering-300 rounded-engineering focus:border-engineering-500 focus:outline-none transition-colors text-center"
              placeholder="输入应力值"
              min="0"
              step="10"
            />
            <div className="mt-3 p-3 bg-engineering-50 rounded-engineering">
              <p className="text-xs text-engineering-600 mb-1">有效范围</p>
              <p className="text-sm font-mono-num font-semibold text-engineering-700">
                {formatNumber(boundaryStatus.minStress)} ~ {formatNumber(boundaryStatus.maxStress)} MPa
              </p>
            </div>
          </div>

          <div className="md:col-span-2">
            {prediction ? (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-engineering-50 to-engineering-100 p-6 rounded-engineering text-center">
                  <p className="text-sm text-engineering-600 mb-2">预测疲劳寿命</p>
                  <p className="text-5xl font-mono-num font-bold text-engineering-800">
                    {formatNumber(prediction.life)}
                  </p>
                  <p className="text-lg text-engineering-600 mt-1">次</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-warning-50 border border-warning-200 rounded-engineering text-center">
                    <p className="text-xs text-warning-600 mb-1">置信区间下限 (95%)</p>
                    <p className="text-2xl font-mono-num font-bold text-warning-700">
                      {formatNumber(prediction.lower)}
                    </p>
                    <p className="text-xs text-warning-600">次</p>
                  </div>
                  <div className="p-4 bg-success-50 border border-success-200 rounded-engineering text-center">
                    <p className="text-xs text-success-600 mb-1">置信区间上限 (95%)</p>
                    <p className="text-2xl font-mono-num font-bold text-success-700">
                      {formatNumber(prediction.upper)}
                    </p>
                    <p className="text-xs text-success-600">次</p>
                  </div>
                </div>

                {(parseFloat(inputStress) < boundaryStatus.minStress || parseFloat(inputStress) > boundaryStatus.maxStress) && (
                  <div className="p-3 bg-danger-50 border border-danger-200 rounded-engineering flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-danger-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-danger-700">警告：输入应力超出有效范围</p>
                      <p className="text-xs text-danger-600 mt-1">
                        预测结果可能不准确，请在 {formatNumber(boundaryStatus.minStress)} ~ {formatNumber(boundaryStatus.maxStress)} MPa 范围内使用
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-engineering-50 rounded-engineering">
                <div className="text-center p-8">
                  <Info className="w-12 h-12 text-engineering-300 mx-auto mb-3" />
                  <p className="text-engineering-500">请输入有效的应力值进行寿命预测</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {renderWhySuggestion(
          '寿命预测基于当前拟合模型，在有效应力范围内具有较高可信度。95%置信区间表示有95%的概率真实寿命落在该范围内。设计时建议取下限作为安全评估依据。'
        )}
      </div>
    </div>
  );
};

export default ReportSummary;
