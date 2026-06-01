import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Target, Zap, AlertTriangle, CheckCircle, Sparkles, RefreshCw } from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import ModelSelector from '../components/modules/ModelSelector';
import FittingChart from '../components/modules/FittingChart';
import TracePanel from '../components/common/TracePanel';
import { suggestBestModel } from '../services/fittingAlgorithm';

const FittingPage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    processedData, 
    fittingResult,
    selectedModel,
    setSelectedModel,
    weightClosureStatus,
    boundaryStatus,
    selectedDataId, 
    isTracePanelOpen, 
    setSelectedDataId,
    setTracePanelOpen,
    runFitting,
    autoSelectBestModel,
    setCurrentStep,
    confirmDataStatus
  } = useDataStore();

  const validData = useMemo(() => 
    processedData.filter(d => 
      d.stressConverted !== null && 
      d.lifeConverted !== null && 
      !d.isNull
    ), [processedData]);

  const suggestedModel = useMemo(() => {
    if (validData.length < 3) return 'power' as const;
    const { model } = suggestBestModel(validData);
    return model;
  }, [validData]);

  const handleModelSelect = (model: any) => {
    setSelectedModel(model);
  };

  const handleRunFitting = () => {
    runFitting();
  };

  const handleAutoSelect = () => {
    autoSelectBestModel();
  };

  const handlePointClick = (dataId: string) => {
    setSelectedDataId(dataId);
  };

  const handleRowClick = (dataId: string) => {
    setSelectedDataId(dataId);
  };

  const handleTraceClose = () => {
    setTracePanelOpen(false);
  };

  const handleConfirm = (status: 'confirmed' | 'normal') => {
    if (selectedDataId) {
      confirmDataStatus(selectedDataId, status, '拟合分析后确认', '分析师');
    }
  };

  const handleGenerateReport = () => {
    setCurrentStep('report');
    navigate('/report');
  };

  const selectedData = processedData.find(d => d.id === selectedDataId);
  const selectedFittingPoint = fittingResult?.points.find(p => p.dataId === selectedDataId);

  const getStatusColorClass = (status: string) => {
    switch (status) {
      case 'normal': return 'bg-success-50 border-success-200 text-success-700';
      case 'warning': return 'bg-warning-50 border-warning-200 text-warning-700';
      case 'error': return 'bg-danger-50 border-danger-200 text-danger-700';
      default: return 'bg-engineering-50 border-engineering-200 text-engineering-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'normal': return <CheckCircle className="w-5 h-5 text-success-600" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-warning-600" />;
      case 'error': return <AlertTriangle className="w-5 h-5 text-danger-600" />;
      default: return <CheckCircle className="w-5 h-5 text-engineering-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-engineering-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif-cn font-bold text-engineering-800">
              拟合分析
            </h1>
            <p className="text-sm text-engineering-500 mt-1">
              选择拟合模型，查看S-N曲线和权重闭合度
            </p>
          </div>
          <div className="flex items-center gap-4">
            {fittingResult && (
              <div className="text-right">
                <p className="text-xs text-engineering-500">当前拟合优度</p>
                <p className="text-2xl font-mono-num font-bold text-success-600">
                  R² = {fittingResult.parameters.r2.toFixed(4)}
                </p>
              </div>
            )}
            <div className="flex items-center gap-2">
              {!fittingResult ? (
                <>
                  <button
                    onClick={handleAutoSelect}
                    className="btn-secondary flex items-center gap-1.5 text-sm"
                  >
                    <Sparkles className="w-4 h-4" />
                    自动选择模型
                  </button>
                  <button
                    onClick={handleRunFitting}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Zap className="w-4 h-4" />
                    开始拟合
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleRunFitting}
                    className="btn-secondary flex items-center gap-1.5 text-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    重新拟合
                  </button>
                  <button
                    onClick={handleGenerateReport}
                    className="btn-primary flex items-center gap-2"
                  >
                    生成报告
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <ModelSelector
            selectedModel={selectedModel}
            onSelect={handleModelSelect}
            suggestedModel={suggestedModel}
          />

          {fittingResult ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`card border-2 p-5 ${getStatusColorClass(weightClosureStatus?.status || 'normal')}`}>
                  <div className="flex items-start gap-4">
                    {getStatusIcon(weightClosureStatus?.status || 'normal')}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          <Target className="w-5 h-5" />
                          权重闭合度
                        </h3>
                        <span className="text-3xl font-mono-num font-bold">
                          {weightClosureStatus?.value.toFixed(4) || '-'}
                        </span>
                      </div>
                      <p className="text-sm opacity-90">
                        {weightClosureStatus?.message || '等待拟合完成后计算'}
                      </p>
                      <div className="mt-3 h-2 bg-white/50 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-current opacity-60 transition-all duration-500"
                          style={{ 
                            width: `${Math.min((weightClosureStatus?.value || 0) * 100, 100)}%` 
                          }}
                        />
                      </div>
                      <p className="text-xs mt-1 opacity-75">
                        理想范围: 0.80 - 1.20
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`card border-2 p-5 ${getStatusColorClass(boundaryStatus?.status || 'normal')}`}>
                  <div className="flex items-start gap-4">
                    {getStatusIcon(boundaryStatus?.status || 'normal')}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          <Zap className="w-5 h-5" />
                          边界阈值状态
                        </h3>
                        <div className="text-right">
                          <p className="text-xs opacity-75">应力范围</p>
                          <p className="font-mono-num font-semibold">
                            {boundaryStatus?.minStress.toFixed(1) || '-'} - {boundaryStatus?.maxStress.toFixed(1) || '-'} MPa
                          </p>
                        </div>
                      </div>
                      <p className="text-sm opacity-90">
                        {boundaryStatus?.message || '等待拟合完成后检测'}
                      </p>
                      {boundaryStatus && boundaryStatus.outOfBounds.length > 0 && (
                        <div className="mt-3 p-2 bg-white/50 rounded-engineering">
                          <p className="text-xs font-medium">
                            超界数据点 ({boundaryStatus.outOfBounds.length}):
                          </p>
                          <p className="text-xs font-mono-num mt-1 truncate">
                            {boundaryStatus.outOfBounds.slice(0, 5).join(', ')}
                            {boundaryStatus.outOfBounds.length > 5 && '...'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <FittingChart
                fittingResult={fittingResult}
                processedData={processedData}
                onPointClick={handlePointClick}
                highlightId={selectedDataId || undefined}
              />

              <div className="card">
                <div className="card-header flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📊</span>
                    <span>拟合点明细</span>
                  </div>
                  <span className="text-xs text-engineering-500">
                    共 {fittingResult.points.length} 个有效数据点
                  </span>
                </div>
                <div className="card-body p-0">
                  <div className="overflow-auto max-h-[300px] scrollbar-thin">
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 z-10">
                        <tr className="table-header">
                          <th className="table-cell text-left w-16">序号</th>
                          <th className="table-cell text-left w-24">记录ID</th>
                          <th className="table-cell text-right w-32">应力 (MPa)</th>
                          <th className="table-cell text-right w-32">实测寿命</th>
                          <th className="table-cell text-right w-32">预测寿命</th>
                          <th className="table-cell text-right w-32">残差</th>
                          <th className="table-cell text-right w-24">相对误差</th>
                          <th className="table-cell text-center w-16">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fittingResult.points.map((point, index) => {
                          const data = processedData.find(d => d.id === point.dataId);
                          const relativeError = Math.abs(point.residual / point.life) * 100;
                          const isHighlight = selectedDataId === point.dataId;
                          
                          return (
                            <tr
                              key={point.dataId}
                              className={`
                                border-b border-engineering-100 transition-colors cursor-pointer
                                ${isHighlight ? 'bg-warning-100' : 'hover:bg-engineering-50'}
                              `}
                              onClick={() => handleRowClick(point.dataId)}
                            >
                              <td className="table-cell text-engineering-500">{index + 1}</td>
                              <td className="table-cell font-mono-num text-sm text-engineering-700">
                                {point.dataId}
                              </td>
                              <td className="table-cell text-right font-mono-num">
                                {point.stress.toFixed(1)}
                              </td>
                              <td className="table-cell text-right font-mono-num">
                                {point.life.toExponential(2)}
                              </td>
                              <td className="table-cell text-right font-mono-num">
                                {point.predictedLife.toExponential(2)}
                              </td>
                              <td className={`table-cell text-right font-mono-num ${
                                Math.abs(point.residual) > point.life * 0.2 ? 'text-danger-600' : 'text-success-600'
                              }`}>
                                {point.residual.toExponential(2)}
                              </td>
                              <td className={`table-cell text-right font-mono-num ${
                                relativeError > 20 ? 'text-danger-600' : 
                                relativeError > 10 ? 'text-warning-600' : 'text-success-600'
                              }`}>
                                {relativeError.toFixed(1)}%
                              </td>
                              <td className="table-cell text-center">
                                <span className="text-xs text-engineering-500">
                                  {data?.status === 'pending' ? '待确认' : 
                                   data?.status === 'confirmed' ? '已确认' : '正常'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="card p-12 text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-engineering-100 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-engineering-400" />
              </div>
              <h3 className="text-lg font-semibold text-engineering-800 mb-2">
                准备进行拟合分析
              </h3>
              <p className="text-engineering-500 mb-6 max-w-md mx-auto">
                已加载 {validData.length} 条有效数据。
                选择合适的拟合模型后，点击"开始拟合"按钮进行S-N曲线拟合分析。
                系统推荐使用 <span className="font-semibold text-warning-600">
                  {suggestedModel === 'power' ? '幂函数模型' : 
                   suggestedModel === 'exponential' ? '指数函数模型' : 'Basquin模型'}
                </span>。
              </p>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={handleAutoSelect}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  自动选择并拟合
                </button>
                <button
                  onClick={handleRunFitting}
                  className="btn-primary flex items-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  开始拟合
                </button>
              </div>
            </div>
          )}
        </div>

        {isTracePanelOpen && selectedData && (
          <TracePanel
            data={selectedData}
            fittingPoint={selectedFittingPoint}
            onClose={handleTraceClose}
            onConfirm={handleConfirm}
          />
        )}
      </div>
    </div>
  );
};

export default FittingPage;
