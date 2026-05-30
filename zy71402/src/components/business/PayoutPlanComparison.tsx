import React, { useState } from 'react';
import { TrendingUp, CheckCircle, Circle, ArrowRight, FileText, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import type { PayoutPlan, CalculationResult } from '@/types';

interface PayoutPlanComparisonProps {
  plans: PayoutPlan[];
  onSelect?: (planId: string) => void;
}

export const PayoutPlanComparison: React.FC<PayoutPlanComparisonProps> = ({ plans, onSelect }) => {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    plans.find(p => p.isSelected)?.id || null
  );

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

  const handleSelect = (planId: string) => {
    setSelectedPlanId(planId);
    onSelect?.(planId);
  };

  if (plans.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">暂无兑付方案</p>
        <p className="text-xs text-gray-400 mt-1">请先完成档位试算后生成兑付方案</p>
      </div>
    );
  }

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {plans.map((plan, idx) => (
          <Card
            key={plan.id}
            hover
            className={`cursor-pointer transition-all ${
              selectedPlanId === plan.id
                ? 'ring-2 ring-primary-500 border-primary-500'
                : ''
            }`}
            onClick={() => handleSelect(plan.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center">
                  {selectedPlanId === plan.id ? (
                    <CheckCircle className="w-5 h-5 text-primary-500 mr-2" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-300 mr-2" />
                  )}
                  {plan.name}
                </CardTitle>
                {idx === 0 && (
                  <Badge variant="default" size="sm">推荐</Badge>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">{plan.description}</p>
            </CardHeader>
            <CardContent className="pt-2">
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-gray-500">本金合计</dt>
                  <dd className="font-mono font-medium">{formatCurrency(plan.totalPrincipal)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">兑付合计</dt>
                  <dd className="font-mono font-medium text-green-600">
                    {formatCurrency(plan.totalPayout)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">收益合计</dt>
                  <dd className="font-mono font-medium text-green-600">
                    {formatCurrency(plan.totalReturn)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">平均收益率</dt>
                  <dd className="font-mono font-medium text-primary-700">
                    {formatPercent(plan.averageReturnRate)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedPlan && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center">
                <FileText className="w-4 h-4 mr-2 text-primary-500" />
                {selectedPlan.name} - 客户明细
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="success" size="sm">
                  {selectedPlan.details.length} 位客户
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table bordered>
              <TableHeader>
                <TableRow>
                  <TableHead>客户姓名</TableHead>
                  <TableHead className="text-right">本金</TableHead>
                  <TableHead>观察价格</TableHead>
                  <TableHead>匹配档位</TableHead>
                  <TableHead className="text-right">收益率</TableHead>
                  <TableHead className="text-right">兑付金额</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedPlan.details.map((detail) => (
                  <PlanDetailRow key={detail.id} detail={detail} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
PayoutPlanComparison.displayName = 'PayoutPlanComparison';

interface PlanDetailRowProps {
  detail: CalculationResult;
}

const PlanDetailRow: React.FC<PlanDetailRowProps> = ({ detail }) => {
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

  return (
    <TableRow className={detail.earlyTerminated ? 'bg-yellow-50/50' : ''}>
      <TableCell className="font-medium">{detail.customerName}</TableCell>
      <TableCell className="text-right font-mono text-sm">
        {formatCurrency(detail.principal)}
      </TableCell>
      <TableCell className="font-mono text-sm">
        {detail.observationPrice.toFixed(2)}
      </TableCell>
      <TableCell>
        <Badge variant="default" size="sm">
          {detail.matchedTierDescription}
        </Badge>
      </TableCell>
      <TableCell className="text-right font-mono text-sm">
        {formatPercent(detail.returnRate)}
      </TableCell>
      <TableCell className="text-right font-mono text-sm font-semibold">
        {formatCurrency(detail.payoutAmount)}
      </TableCell>
      <TableCell>
        {detail.earlyTerminated ? (
          <Badge variant="warning" size="sm">提前终止</Badge>
        ) : (
          <Badge variant="success" size="sm">正常到期</Badge>
        )}
      </TableCell>
    </TableRow>
  );
};
