import { useState } from 'react';
import type { CashFlow } from '@/types';
import { Decimal } from 'decimal.js';

interface Props {
  cashFlows: CashFlow[];
}

export default function CashFlowTable({ cashFlows }: Props) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-navy-200">
            <th className="text-left py-3 px-4 font-medium text-navy-600">期数</th>
            <th className="text-left py-3 px-4 font-medium text-navy-600">付息日期</th>
            <th className="text-right py-3 px-4 font-medium text-navy-600">票息支付</th>
            <th className="text-right py-3 px-4 font-medium text-navy-600">本金支付</th>
            <th className="text-right py-3 px-4 font-medium text-navy-600">合计支付</th>
            <th className="text-right py-3 px-4 font-medium text-navy-600">计息天数</th>
            <th className="text-center py-3 px-4 font-medium text-navy-600">状态</th>
            <th className="text-center py-3 px-4 font-medium text-navy-600">详情</th>
          </tr>
        </thead>
        <tbody>
          {cashFlows.map((cf) => (
            <tr 
              key={cf.id} 
              className={`border-b border-navy-100 clickable-row ${
                cf.isException ? 'exception-row animate-pulse-twice' : ''
              }`}
              onClick={() => setExpandedRow(expandedRow === cf.id ? null : cf.id)}
            >
              <td className="py-3 px-4">{cf.period}</td>
              <td className="py-3 px-4">{cf.paymentDate}</td>
              <td className="py-3 px-4 text-right font-mono">
                {new Decimal(cf.couponPayment).toFixed(2)}
              </td>
              <td className="py-3 px-4 text-right font-mono">
                {new Decimal(cf.principalPayment).toFixed(2)}
              </td>
              <td className="py-3 px-4 text-right font-mono font-medium">
                {new Decimal(cf.totalPayment).toFixed(2)}
              </td>
              <td className="py-3 px-4 text-right">{cf.accruedDays}</td>
              <td className="py-3 px-4 text-center">
                {cf.isException ? (
                  <span className="text-red-500 text-xs">异常</span>
                ) : (
                  <span className="text-green-500 text-xs">正常</span>
                )}
              </td>
              <td className="py-3 px-4 text-center text-navy-400">
                {expandedRow === cf.id ? '▲' : '▼'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
