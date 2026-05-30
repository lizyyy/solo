import { AlertTriangle, CheckCircle } from 'lucide-react';
import type { PaymentRecord } from '../types';
import { formatCurrency, formatDate } from '../utils/format';

interface PaymentHistoryProps {
  payments: PaymentRecord[];
}

export function PaymentHistory({ payments }: PaymentHistoryProps) {
  if (payments.length === 0) {
    return <p className="text-gray-500 text-sm">暂无付款记录</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600">付款编号</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">金额</th>
            <th className="px-3 py-2 text-center font-medium text-gray-600">日期</th>
            <th className="px-3 py-2 text-center font-medium text-gray-600">版本</th>
            <th className="px-3 py-2 text-center font-medium text-gray-600">状态</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">操作人</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {payments.map((p) => (
            <tr key={p.id} className={p.isDuplicate ? 'bg-amber-50' : ''}>
              <td className="px-3 py-2 font-mono text-primary-700">
                {p.paymentNo}
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {formatCurrency(p.amount)}
              </td>
              <td className="px-3 py-2 text-center text-gray-600">
                {formatDate(p.paymentDate)}
              </td>
              <td className="px-3 py-2 text-center">
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                  v{p.version}
                </span>
              </td>
              <td className="px-3 py-2 text-center">
                {p.isDuplicate ? (
                  <span className="inline-flex items-center gap-1 text-amber-700">
                    <AlertTriangle size={14} />
                    重复付款
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-success-600">
                    <CheckCircle size={14} />
                    成功
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-gray-600">{p.operator}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
