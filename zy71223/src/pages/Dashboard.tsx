import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useVoucherStore } from '../store/voucherStore';
import { formatStatus, formatMoney, formatDate } from '../components/Layout';
import { Receipt, AlertTriangle, CheckCircle, Clock, TrendingUp, FileBarChart } from 'lucide-react';

export default function Dashboard() {
  const { vouchers, summary, fetchVouchers, loading } = useVoucherStore();

  useEffect(() => {
    fetchVouchers();
  }, [fetchVouchers]);

  const exceptionVouchers = vouchers.filter(v => v.status === 'exception' || v.status === 'reviewing').slice(0, 5);

  const statCards = [
    { label: '凭证总数', value: summary.total, icon: Receipt, color: 'bg-blue-50 text-blue-600' },
    { label: '待处理', value: summary.reviewing + summary.exception, icon: Clock, color: 'bg-yellow-50 text-yellow-600' },
    { label: '异常凭证', value: summary.exception, icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
    { label: '已完成', value: summary.completed, icon: CheckCircle, color: 'bg-green-50 text-green-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">工作台</h2>
          <p className="text-gray-500 text-sm mt-1">代账会计现金凭证处理中心</p>
        </div>
        <Link
          to="/vouchers"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <Receipt size={16} />
          上传新凭证
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {statCards.map((card, idx) => (
          <div key={idx} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">{card.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${card.color}`}>
                <card.icon size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">待处理凭证</h3>
            <Link to="/vouchers?status=exception" className="text-primary-600 text-sm hover:underline">
              查看全部
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {loading ? (
              <div className="p-8 text-center text-gray-400">加载中...</div>
            ) : exceptionVouchers.length === 0 ? (
              <div className="p-8 text-center text-gray-400">暂无待处理凭证</div>
            ) : (
              exceptionVouchers.map(v => {
                const status = formatStatus(v.status);
                return (
                  <Link
                    key={v.id}
                    to={`/vouchers/${v.id}`}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Receipt size={20} className="text-gray-500" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{v.customerName}</p>
                        <p className="text-sm text-gray-500">{v.description || '待识别'} · {formatDate(v.date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-gray-900">{formatMoney(v.amount)}</span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${status.class}`}>
                        {status.label}
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">快捷操作</h3>
            <div className="space-y-2">
              <Link
                to="/vouchers?status=exception"
                className="flex items-center gap-3 p-3 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
              >
                <AlertTriangle size={18} />
                <div>
                  <p className="font-medium text-sm">处理异常凭证</p>
                  <p className="text-xs opacity-75">{summary.exception} 张需要关注</p>
                </div>
              </Link>
              <Link
                to="/balance"
                className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <TrendingUp size={18} />
                <div>
                  <p className="font-medium text-sm">余额校验</p>
                  <p className="text-xs opacity-75">检查借贷平衡</p>
                </div>
              </Link>
              <Link
                to="/reports"
                className="flex items-center gap-3 p-3 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
              >
                <FileBarChart size={18} />
                <div>
                  <p className="font-medium text-sm">生成整理报告</p>
                  <p className="text-xs opacity-75">导出可追溯凭证</p>
                </div>
              </Link>
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl p-5 text-white">
            <h3 className="font-semibold mb-2">本月统计</h3>
            <p className="text-3xl font-bold mt-3">
              {formatMoney(vouchers.filter(v => v.status === 'completed').reduce((sum, v) => sum + v.amount, 0))}
            </p>
            <p className="text-primary-200 text-sm mt-1">已完成凭证总金额</p>
            <div className="mt-4 pt-4 border-t border-primary-500/30">
              <p className="text-sm text-primary-200">
                完成率：{summary.total > 0 ? Math.round(summary.completed / summary.total * 100) : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
