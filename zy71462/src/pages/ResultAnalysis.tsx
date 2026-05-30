import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useBatchStore } from '@/store/batchStore';
import { HoldingCompareChart } from '@/components/charts/HoldingCompareChart';
import { TaxWaterfallChart } from '@/components/charts/TaxWaterfallChart';
import { TradeSuggestion, EvidenceRecord } from '@/types';
import { TrendingUp, TrendingDown, Minus, Eye, Download, ArrowRight, FileText, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp, Calculator } from 'lucide-react';

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(value);
};

const formatPercent = (value: number): string => {
  return `${(value * 100).toFixed(2)}%`;
};

const ResultAnalysis: React.FC = () => {
  const { currentTask, trades, evidenceRecords, currentBatch, materials, holdings, targetWeights } = useBatchStore();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<TradeSuggestion | null>(null);
  const [showEvidence, setShowEvidence] = useState<EvidenceRecord | null>(null);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'buy': return <TrendingUp className="w-4 h-4 text-emerald-500" />;
      case 'sell': return <TrendingDown className="w-4 h-4 text-red-500" />;
      default: return <Minus className="w-4 h-4 text-slate-500" />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'buy': return '买入';
      case 'sell': return '卖出';
      default: return '持有';
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'buy': return <Badge variant="success">{getActionLabel(action)}</Badge>;
      case 'sell': return <Badge variant="danger">{getActionLabel(action)}</Badge>;
      default: return <Badge variant="secondary">{getActionLabel(action)}</Badge>;
    }
  };

  const getEvidenceForTrade = (tradeId: string): EvidenceRecord | undefined => {
    return evidenceRecords.find(e => e.targetId === tradeId);
  };

  const toggleRow = (tradeId: string) => {
    setExpandedRow(expandedRow === tradeId ? null : tradeId);
  };

  if (!currentTask) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white">结果分析</h1>
            <p className="mt-1 text-sm text-slate-400">
              查看再平衡优化结果、交易建议和税费明细
            </p>
          </div>
          <Card className="p-8 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-slate-500" />
            <h2 className="text-lg font-semibold text-white mb-2">暂无计算结果</h2>
            <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
              请先导入材料并完成再平衡优化计算，然后在此查看结果。
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link to="/import">
                <Button variant="secondary">导入材料</Button>
              </Link>
              <Link to="/configure">
                <Button variant="primary">开始计算</Button>
              </Link>
            </div>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">结果分析</h1>
            <p className="mt-1 text-sm text-slate-400">
              批次号：{currentBatch?.id.slice(-8)} · 计算时间：{currentTask.completedAt ? new Date(currentTask.completedAt).toLocaleString('zh-CN') : '进行中'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/diagnose">
              <Button variant="secondary">
                <AlertTriangle className="w-4 h-4 mr-2" />
                错误诊断
              </Button>
            </Link>
            <Link to="/export">
              <Button variant="primary">
                <Download className="w-4 h-4 mr-2" />
                导出报告
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-xs text-slate-500 mb-1">总税费</div>
            <div className="text-2xl font-bold text-red-400 font-mono">{formatCurrency(currentTask.totalTax)}</div>
            <div className="text-xs text-slate-500 mt-1">
              佣金 {formatCurrency(currentTask.totalCommission)} · 印花税 {formatCurrency(currentTask.totalStampDuty)}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-slate-500 mb-1">亏损抵扣</div>
            <div className="text-2xl font-bold text-emerald-400 font-mono">-{formatCurrency(currentTask.totalLossOffset)}</div>
            <div className="text-xs text-slate-500 mt-1">已抵扣应纳税所得额</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-slate-500 mb-1">税后收益</div>
            <div className={`text-2xl font-bold font-mono ${currentTask.afterTaxReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {currentTask.afterTaxReturn >= 0 ? '+' : ''}{formatCurrency(currentTask.afterTaxReturn)}
            </div>
            <div className="text-xs text-slate-500 mt-1">考虑税费后的净收益</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-slate-500 mb-1">跟踪误差</div>
            <div className="text-2xl font-bold text-blue-400 font-mono">{formatPercent(currentTask.trackingError)}</div>
            <div className="text-xs text-slate-500 mt-1">与目标权重的偏差</div>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <h3 className="font-medium text-white mb-4">持仓权重对比</h3>
            <HoldingCompareChart 
              holdings={holdings}
              targetWeights={targetWeights}
              trades={trades}
            />
          </Card>
          <Card className="p-4">
            <h3 className="font-medium text-white mb-4">税费构成瀑布图</h3>
            <TaxWaterfallChart 
              task={currentTask}
              trades={trades}
            />
          </Card>
        </div>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-white">交易建议明细</h3>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-emerald-500" /> 买入 {trades.filter(t => t.action === 'buy').length} 笔</span>
              <span className="flex items-center gap-1"><TrendingDown className="w-3 h-3 text-red-500" /> 卖出 {trades.filter(t => t.action === 'sell').length} 笔</span>
              <span className="flex items-center gap-1"><Minus className="w-3 h-3 text-slate-500" /> 持有 {trades.filter(t => t.action === 'hold').length} 笔</span>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium"></th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">证券代码</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">证券名称</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">操作</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">数量</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">价格</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">交易金额</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">预估税费</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">亏损抵扣</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">持有天数</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">当前权重</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">目标权重</th>
                  <th className="text-center py-2 px-3 text-slate-400 font-medium">证据链</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => {
                  const evidence = getEvidenceForTrade(trade.id);
                  const isExpanded = expandedRow === trade.id;
                  
                  return (
                    <React.Fragment key={trade.id}>
                      <tr 
                        className={`border-b border-slate-800 hover:bg-slate-800/30 cursor-pointer transition-colors ${
                          isExpanded ? 'bg-slate-800/50' : ''
                        }`}
                        onClick={() => toggleRow(trade.id)}
                      >
                        <td className="py-2 px-3">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        </td>
                        <td className="py-2 px-3 font-mono text-white">{trade.symbol}</td>
                        <td className="py-2 px-3 text-slate-300">{trade.name}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1">
                            {getActionIcon(trade.action)}
                            {getActionBadge(trade.action)}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-300">{trade.quantity.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-300">{trade.price.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono text-white">{formatCurrency(trade.estimatedValue)}</td>
                        <td className="py-2 px-3 text-right font-mono text-red-400">{formatCurrency(trade.estimatedTotalTax)}</td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-400">-{formatCurrency(trade.lossOffsetApplied)}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-300">{trade.holdingDays} 天</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-300">{formatPercent(trade.currentWeight)}</td>
                        <td className="py-2 px-3 text-right font-mono text-blue-400">{formatPercent(trade.targetWeight)}</td>
                        <td className="py-2 px-3 text-center">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (evidence) {
                                setShowEvidence(evidence);
                              }
                            }}
                            disabled={!evidence}
                          >
                            <Calculator className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-800/30">
                          <td colSpan={13} className="py-4 px-6">
                            <div className="grid grid-cols-3 gap-6">
                              <div>
                                <h4 className="text-sm font-medium text-slate-300 mb-2">交易原因</h4>
                                <p className="text-sm text-slate-400">{trade.reason}</p>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-slate-300 mb-2">约束条件</h4>
                                <div className="flex flex-wrap gap-1">
                                  {trade.constraints.length > 0 ? (
                                    trade.constraints.map((c, i) => (
                                      <Badge key={i} variant="secondary" size="sm">{c}</Badge>
                                    ))
                                  ) : (
                                    <span className="text-xs text-slate-500">无特殊约束</span>
                                  )}
                                </div>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-slate-300 mb-2">边际税率</h4>
                                <p className="text-2xl font-bold text-white font-mono">{formatPercent(trade.marginalTaxRate)}</p>
                              </div>
                            </div>
                            
                            <div className="mt-4 pt-4 border-t border-slate-700/50">
                              <h4 className="text-sm font-medium text-slate-300 mb-2">税费明细</h4>
                              <div className="grid grid-cols-4 gap-4">
                                <div className="bg-slate-900/50 rounded-md p-3">
                                  <div className="text-xs text-slate-500">佣金</div>
                                  <div className="text-lg font-mono text-white">{formatCurrency(trade.estimatedCommission)}</div>
                                </div>
                                <div className="bg-slate-900/50 rounded-md p-3">
                                  <div className="text-xs text-slate-500">印花税</div>
                                  <div className="text-lg font-mono text-white">{formatCurrency(trade.estimatedStampDuty)}</div>
                                </div>
                                <div className="bg-slate-900/50 rounded-md p-3">
                                  <div className="text-xs text-slate-500">资本利得税</div>
                                  <div className="text-lg font-mono text-white">{formatCurrency(trade.estimatedCapitalGainsTax)}</div>
                                </div>
                                <div className="bg-slate-900/50 rounded-md p-3">
                                  <div className="text-xs text-slate-500">净收入</div>
                                  <div className={`text-lg font-mono ${trade.netProceeds >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {formatCurrency(trade.netProceeds)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {showEvidence && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <Card className="w-full max-w-3xl max-h-[80vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-slate-800">
                <div>
                  <h3 className="font-medium text-white">计算证据链</h3>
                  <div className="text-xs text-slate-500 mt-0.5">
                    每一步计算均可追溯到原始材料
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowEvidence(null)}>
                  关闭
                </Button>
              </div>
              <div className="p-4 overflow-auto max-h-[60vh]">
                <div className="space-y-4">
                  {showEvidence.calculationSteps
                    .sort((a, b) => a.order - b.order)
                    .map((step, index) => (
                      <div key={index} className="relative pl-8 pb-4 border-l-2 border-slate-700 last:border-l-0 last:pb-0">
                        <div className="absolute left-0 top-0 w-4 h-4 -ml-[9px] rounded-full bg-slate-700 border-2 border-slate-600" />
                        <div className="bg-slate-800/50 rounded-md p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-white">{step.operation}</span>
                            <span className="text-xs text-slate-500 font-mono">
                              {new Date(step.timestamp).toLocaleTimeString('zh-CN')}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mb-2 font-mono bg-slate-900/50 rounded px-2 py-1">
                            {step.formula}
                          </div>
                          <div className="space-y-1 text-xs">
                            <div className="text-slate-500">输入参数：</div>
                            {Object.entries(step.inputs).map(([key, value]) => (
                              <div key={key} className="flex items-center justify-between pl-3">
                                <span className="text-slate-400">{key} = {value.value}</span>
                                <span className="text-slate-600 text-xs">
                                  {value.source}
                                  {value.materialId && ` · 材料行${value.rowIndex !== undefined ? value.rowIndex + 1 : ''}`}
                                </span>
                              </div>
                            ))}
                            <div className="flex items-center justify-between pt-1 mt-1 border-t border-slate-700/50">
                              <span className="text-slate-300 font-medium">计算结果</span>
                              <span className="text-emerald-400 font-mono font-bold">{step.result.toFixed(4)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default ResultAnalysis;
