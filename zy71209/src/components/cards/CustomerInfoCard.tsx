import type { Customer, Pledge, PledgeCalculation } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { SpecialFlagsList } from '../common/SpecialFlagBadge';
import { ProgressBar } from '../common/ProgressBar';
import { formatCurrencyFull } from '../../utils/calculator';

interface CustomerInfoCardProps {
  customer: Customer;
  pledge: Pledge;
  calculation: PledgeCalculation | null;
}

export function CustomerInfoCard({ customer, pledge, calculation }: CustomerInfoCardProps) {
  const riskLevelText = {
    low: '低风险',
    medium: '中风险',
    high: '高风险',
  };

  const riskLevelColor = {
    low: 'text-green-600',
    medium: 'text-yellow-600',
    high: 'text-red-600',
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            {customer.customerName}
            <span className="ml-2 text-sm font-normal text-gray-500">
              账户: {customer.accountNo}
            </span>
          </h3>
          <div className="flex items-center gap-4">
            <span className={`text-sm font-medium ${riskLevelColor[customer.riskLevel]}`}>
              {riskLevelText[customer.riskLevel]}
            </span>
            <StatusBadge status={pledge.status} />
            <SpecialFlagsList flags={pledge.specialFlags} />
          </div>
        </div>
        {customer.phone && (
          <div className="text-sm text-gray-600">联系电话: {customer.phone}</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-4">质押合约信息</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">质押股票</span>
              <span className="font-medium">
                {pledge.stockName} ({pledge.stockCode})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">质押股数</span>
              <span className="font-medium" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                {pledge.pledgeShares.toLocaleString()} 股
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">融资本金</span>
              <span className="font-medium" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                ¥{formatCurrencyFull(pledge.principal)}
              </span>
            </div>
            {calculation && (
              <div className="flex justify-between">
                <span className="text-gray-600">质押市值</span>
                <span className="font-medium" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                  ¥{formatCurrencyFull(calculation.marketValue)}
                </span>
              </div>
            )}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-4">合约期限</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">开始日期</span>
              <span className="font-medium">{pledge.startDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">到期日期</span>
              <span className="font-medium">{pledge.endDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">警戒线</span>
              <span className="font-medium text-orange-600">
                {calculation?.effectiveWarningLine.toFixed(2) ?? pledge.warningLine.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">平仓线</span>
              <span className="font-medium text-red-600">{pledge.closeLine.toFixed(2)}%</span>
            </div>
          </div>
        </div>
      </div>

      {calculation && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">质押率监控</h4>
          <ProgressBar
            value={calculation.pledgeRatio}
            warningThreshold={calculation.effectiveWarningLine}
            dangerThreshold={pledge.closeLine}
          />
        </div>
      )}
    </div>
  );
}
