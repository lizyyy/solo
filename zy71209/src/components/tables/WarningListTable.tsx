import { useNavigate } from 'react-router-dom';
import { Eye, Phone, Mail, MessageSquare, TrendingUp, TrendingDown } from 'lucide-react';
import type { Pledge, Customer, PledgeCalculation } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { SpecialFlagsList } from '../common/SpecialFlagBadge';
import { formatCurrencyFull } from '../../utils/calculator';
import { useAppStore } from '../../store/useAppStore';
import { useState } from 'react';

interface WarningListTableProps {
  pledges: Pledge[];
  getCalculation: (pledgeId: string) => PledgeCalculation | null;
  getCustomer: (pledgeId: string) => Customer | undefined;
}

export function WarningListTable({ pledges, getCalculation, getCustomer }: WarningListTableProps) {
  const navigate = useNavigate();
  const sendMarginCall = useAppStore((state) => state.sendMarginCall);
  const [notificationResult, setNotificationResult] = useState<{
    pledgeId: string;
    success: boolean;
    message: string;
  } | null>(null);

  const handleSendNotification = (
    e: React.MouseEvent,
    pledgeId: string,
    method: 'sms' | 'email' | 'phone'
  ) => {
    e.stopPropagation();
    const result = sendMarginCall(pledgeId, method);
    setNotificationResult({
      pledgeId,
      success: result.success,
      message: result.message || '',
    });
    setTimeout(() => setNotificationResult(null), 3000);
  };

  if (pledges.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <p className="text-gray-500">暂无符合条件的预警记录</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {notificationResult && (
        <div
          className={`px-4 py-3 text-sm ${
            notificationResult.success
              ? 'bg-green-50 text-green-800 border-b border-green-200'
              : 'bg-yellow-50 text-yellow-800 border-b border-yellow-200'
          }`}
        >
          {notificationResult.message}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                客户信息
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                质押股票
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                质押率
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                警戒线
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                最新行情
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                状态
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                特殊标记
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {pledges.map((pledge) => {
              const customer = getCustomer(pledge.id);
              const calculation = getCalculation(pledge.id);
              const isWarning = calculation?.isWarning;
              const isClose = calculation?.isClose;

              return (
                <tr
                  key={pledge.id}
                  className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                    isClose
                      ? 'bg-red-50/50'
                      : isWarning
                      ? 'bg-orange-50/30'
                      : ''
                  }`}
                  onClick={() => navigate(`/customer/${pledge.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{customer?.customerName}</div>
                    <div className="text-xs text-gray-500">{customer?.accountNo}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{pledge.stockName}</div>
                    <div className="text-xs text-gray-500">
                      {pledge.stockCode} · {pledge.pledgeShares.toLocaleString()}股
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div
                      className={`font-bold ${
                        isClose
                          ? 'text-red-600'
                          : isWarning
                          ? 'text-orange-600'
                          : 'text-green-600'
                      }`}
                      style={{ fontFamily: '"JetBrains Mono", monospace' }}
                    >
                      {calculation?.pledgeRatio.toFixed(2) ?? '--'}%
                    </div>
                    <div className="flex items-center justify-end gap-1 text-xs text-gray-400">
                      {calculation &&
                        (calculation.warningBuffer < 0 ? (
                          <>
                            <TrendingUp className="w-3 h-3 text-red-500" />
                            <span className="text-red-500">
                              超{Math.abs(calculation.warningBuffer).toFixed(2)}%
                            </span>
                          </>
                        ) : (
                          <>
                            <TrendingDown className="w-3 h-3 text-green-500" />
                            <span className="text-green-500">
                              剩{calculation.warningBuffer.toFixed(2)}%
                            </span>
                          </>
                        ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div
                      className="font-medium text-gray-900"
                      style={{ fontFamily: '"JetBrains Mono", monospace' }}
                    >
                      {calculation?.effectiveWarningLine.toFixed(2) ??
                        pledge.warningLine.toFixed(2)}
                      %
                    </div>
                    <div className="text-xs text-gray-400">
                      平仓线 {pledge.closeLine.toFixed(2)}%
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div
                      className="font-medium text-gray-900"
                      style={{ fontFamily: '"JetBrains Mono", monospace' }}
                    >
                      ¥{calculation?.effectivePrice.toFixed(2) ?? '--'}
                    </div>
                    <div className="text-xs text-gray-400">
                      市值 ¥{formatCurrencyFull(calculation?.marketValue ?? 0)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={pledge.status} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <SpecialFlagsList flags={pledge.specialFlags} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-[#1e3a5f] transition-colors"
                        title="查看详情"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/customer/${pledge.id}`);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-[#1e3a5f] transition-colors"
                        title="发送短信通知"
                        onClick={(e) => handleSendNotification(e, pledge.id, 'sms')}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-[#1e3a5f] transition-colors"
                        title="发送邮件通知"
                        onClick={(e) => handleSendNotification(e, pledge.id, 'email')}
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-[#1e3a5f] transition-colors"
                        title="电话通知"
                        onClick={(e) => handleSendNotification(e, pledge.id, 'phone')}
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
