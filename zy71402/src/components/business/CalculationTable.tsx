import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { CalculationSteps } from './CalculationSteps';
import { EvidenceDisplay } from './EvidenceDisplay';
import type { CalculationResult } from '@/types';

interface CalculationTableProps {
  calculations: CalculationResult[];
}

export const CalculationTable: React.FC<CalculationTableProps> = ({ calculations }) => {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const getReturnIcon = (rate: number) => {
    if (rate > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (rate < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  if (calculations.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">暂无计算结果</p>
        <p className="text-xs text-gray-400 mt-1">请先完成条款解析和档位试算</p>
      </div>
    );
  }

  const totalPrincipal = calculations.reduce((sum, c) => sum + c.principal, 0);
  const totalPayout = calculations.reduce((sum, c) => sum + c.payoutAmount, 0);
  const totalReturn = totalPayout - totalPrincipal;
  const avgReturnRate = totalReturn / totalPrincipal;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">本金合计</p>
          <p className="text-lg font-semibold text-gray-900 font-mono">{formatCurrency(totalPrincipal)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">兑付合计</p>
          <p className="text-lg font-semibold text-gray-900 font-mono">{formatCurrency(totalPayout)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">收益合计</p>
          <p className="text-lg font-semibold text-green-600 font-mono">{formatCurrency(totalReturn)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">平均收益率</p>
          <p className="text-lg font-semibold text-primary-700 font-mono">{formatPercent(avgReturnRate)}</p>
        </div>
      </div>

      <Table bordered>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>客户姓名</TableHead>
            <TableHead className="text-right">本金</TableHead>
            <TableHead>观察日价格</TableHead>
            <TableHead>匹配档位</TableHead>
            <TableHead className="text-right">收益率</TableHead>
            <TableHead className="text-right">收益</TableHead>
            <TableHead className="text-right">兑付金额</TableHead>
            <TableHead>状态</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {calculations.map((calc) => {
            const isExpanded = expandedRow === calc.id;
            const isBoundaryRisk = calc.matchedTierDescription.includes('边界') || 
              calc.calculationSteps.some(s => s.description.includes('边界'));

            return (
              <React.Fragment key={calc.id}>
                <TableRow className={calc.earlyTerminated ? 'bg-yellow-50/50' : ''}>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-0 h-6 w-6"
                      onClick={() => setExpandedRow(isExpanded ? null : calc.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-gray-900">{calc.customerName}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(calc.principal)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-sm">{calc.observationPrice.toFixed(2)}</span>
                      {isBoundaryRisk && (
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                    <div className="text-xs text-gray-400">{calc.observationDate}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="default" size="sm">
                      {calc.matchedTierDescription}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {getReturnIcon(calc.returnRate)}
                      <span className="font-mono text-sm font-medium">
                        {formatPercent(calc.returnRate)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-green-600">
                    {formatCurrency(calc.calculatedReturn)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold">
                    {formatCurrency(calc.payoutAmount)}
                  </TableCell>
                  <TableCell>
                    {calc.earlyTerminated ? (
                      <StatusIndicator status="warning" label="提前终止" size="sm" />
                    ) : (
                      <StatusIndicator status="success" label="正常到期" size="sm" />
                    )}
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={9} className="bg-white border-t-0">
                      <div className="p-4 grid grid-cols-2 gap-4">
                        <CalculationSteps result={calc} />
                        <div className="space-y-3">
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">计算摘要</h4>
                            <dl className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <dt className="text-gray-500">持仓ID:</dt>
                                <dd className="font-mono text-gray-700">{calc.positionId}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-gray-500">观察价格:</dt>
                                <dd className="font-mono text-gray-700">{calc.observationPrice.toFixed(2)}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-gray-500">匹配档位ID:</dt>
                                <dd className="font-mono text-gray-700">{calc.matchedTierId || '-'}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-gray-500">计算时间:</dt>
                                <dd className="text-gray-700">
                                  {new Date(calc.calculatedAt).toLocaleString('zh-CN')}
                                </dd>
                              </div>
                            </dl>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
CalculationTable.displayName = 'CalculationTable';
