import { useEffect, useState } from 'react';
import { useVoucherStore } from '../store/voucherStore';
import { formatMoney } from '../components/Layout';
import { Calculator, AlertTriangle, RefreshCw, TrendingUp, TrendingDown, Minus, CheckCircle } from 'lucide-react';

export default function BalancePage() {
  const { balances, warnings, fetchBalances, checkBalanceWarnings, calculateBalances, loading, error, clearError } = useVoucherStore();
  const [period, setPeriod] = useState('2026-05');

  useEffect(() => {
    fetchBalances(period);
    checkBalanceWarnings(period);
  }, [period, fetchBalances, checkBalanceWarnings]);

  const handleCalculate = async () => {
    await calculateBalances(period);
  };

  const assetBalances = balances.filter(b => {
    const subject = balances.find(s => s.id === b.subjectId);
    return subject?.subjectCode?.startsWith('1');
  });

  const liabilityBalances = balances.filter(b => {
    const subject = balances.find(s => s.id === b.subjectId);
    return subject?.subjectCode?.startsWith('2');
  });

  const equityBalances = balances.filter(b => {
    const subject = balances.find(s => s.id === b.subjectId);
    return subject?.subjectCode?.startsWith('4');
  });

  const revenueBalances = balances.filter(b => {
    const subject = balances.find(s => s.id === b.subjectId);
    return subject?.subjectCode?.startsWith('60') || subject?.subjectCode?.startsWith('605');
  });

  const expenseBalances = balances.filter(b => {
    const subject = balances.find(s => s.id === b.subjectId);
    return subject?.subjectCode?.startsWith('64') || subject?.subjectCode?.startsWith('66');
  });

  const totalDebit = balances.reduce((sum, b) => sum + b.currentDebit, 0);
  const totalCredit = balances.reduce((sum, b) => sum + b.currentCredit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const renderBalanceTable = (title: string, data: typeof balances, icon: React.ReactNode) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        {icon}
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <span className="ml-auto text-sm text-gray-500">{data.length} 个科目</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">科目编码</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">科目名称</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">期初余额</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">本期借方</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">本期贷方</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">期末余额</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">方向</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">暂无数据</td>
              </tr>
            ) : (
              data.map(b => (
                <tr key={b.id} className={`hover:bg-gray-50 transition-colors ${b.closingBalance < 0 ? 'bg-red-50/50' : ''}`}>
                  <td className="px-4 py-3 font-mono text-sm text-gray-700">{b.subjectCode}</td>
                  <td className="px-4 py-3 text-gray-900">{b.subjectName}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatMoney(b.openingBalance)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatMoney(b.currentDebit)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatMoney(b.currentCredit)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${b.closingBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatMoney(Math.abs(b.closingBalance))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 text-xs ${
                      b.closingBalance > 0 ? 'text-amber-700' : b.closingBalance < 0 ? 'text-cyan-700' : 'text-gray-400'
                    }`}>
                      {b.closingBalance > 0 ? <TrendingUp size={12} /> : b.closingBalance < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                      {b.closingBalance > 0 ? '借' : b.closingBalance < 0 ? '贷' : '平'}
                    </span>
                    {b.closingBalance < 0 && (
                      <span className="ml-1 text-xs text-red-500">⚠</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">余额校验</h2>
          <p className="text-gray-500 text-sm mt-1">检查借贷平衡，检测余额倒挂风险</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={handleCalculate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            重新计算
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} />
            {error}
          </div>
          <button onClick={clearError} className="text-sm hover:underline">关闭</button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">本期借方合计</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{formatMoney(totalDebit)}</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 text-amber-600">
              <TrendingUp size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">本期贷方合计</p>
              <p className="text-2xl font-bold text-cyan-600 mt-1">{formatMoney(totalCredit)}</p>
            </div>
            <div className="p-3 rounded-lg bg-cyan-50 text-cyan-600">
              <TrendingDown size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">借贷差额</p>
              <p className={`text-2xl font-bold mt-1 ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                {formatMoney(Math.abs(totalDebit - totalCredit))}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${isBalanced ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              {isBalanced ? <CheckCircle size={24} /> : <AlertTriangle size={24} />}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">风险预警</p>
              <p className={`text-2xl font-bold mt-1 ${warnings.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {warnings.length} 项
              </p>
            </div>
            <div className={`p-3 rounded-lg ${warnings.length > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
              <Calculator size={24} />
            </div>
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <h3 className="font-semibold text-red-800 flex items-center gap-2 mb-3">
            <AlertTriangle size={18} />
            余额风险预警
          </h3>
          <div className="space-y-2">
            {warnings.map((w, idx) => {
              const level = w.type === 'mismatch' ? 'critical' : w.type === 'overdrawn' ? 'critical' : 'warning';
              return (
                <div key={idx} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-red-100">
                  <span className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${
                    level === 'critical' ? 'bg-red-500' : 'bg-amber-500'
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{w.subjectName}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{w.message}</p>
                    <p className="text-xs text-gray-400 mt-1">建议：{w.suggestion}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    level === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {level === 'critical' ? '严重' : '警告'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {renderBalanceTable('资产类', assetBalances, <span className="text-amber-600">◆</span>)}
        {renderBalanceTable('负债类', liabilityBalances, <span className="text-cyan-600">◆</span>)}
        {renderBalanceTable('权益类', equityBalances, <span className="text-purple-600">◆</span>)}
        {renderBalanceTable('收入类', revenueBalances, <span className="text-green-600">◆</span>)}
        {renderBalanceTable('成本费用类', expenseBalances, <span className="text-orange-600">◆</span>)}
      </div>
    </div>
  );
}
