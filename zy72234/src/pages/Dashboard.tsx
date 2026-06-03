import { useNavigate } from 'react-router-dom';
import {
  FileText,
  FileCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
  Upload,
  BarChart3,
  List,
} from 'lucide-react';
import { useClearingStore } from '@/store/useClearingStore';
import StatusBadge from '@/components/common/StatusBadge';
import AmountDisplay from '@/components/common/AmountDisplay';
import { isZeroReversed } from '@shared/types';

export default function Dashboard() {
  const navigate = useNavigate();
  const { getOverviewStats, adjustments, currentRole } = useClearingStore();
  const stats = getOverviewStats();

  const pendingItems = adjustments.filter(
    (a) => a.status === 'pending_custody' || a.status === 'pending_review'
  );

  const statCards = [
    {
      label: '总记录数',
      value: stats.total,
      icon: FileText,
      color: 'bg-custody-blue',
      bgColor: 'bg-custody-blue-light',
    },
    {
      label: '待补托管页',
      value: stats.pendingCustody,
      icon: FileCheck,
      color: 'bg-warning-orange',
      bgColor: 'bg-warning-orange-light',
      action: () => navigate('/custody'),
    },
    {
      label: '待风控复核',
      value: stats.pendingReview,
      icon: ShieldAlert,
      color: 'bg-risk-red',
      bgColor: 'bg-risk-red-light',
      action: () => navigate('/review'),
    },
    {
      label: '已复核通过',
      value: stats.completed,
      icon: CheckCircle,
      color: 'bg-finance-green',
      bgColor: 'bg-finance-green-light',
    },
  ];

  const quickActions = [
    {
      label: '导入数据',
      description: '上传CSV/Excel清算文件',
      icon: Upload,
      path: '/import',
      color: 'text-custody-blue',
      bgColor: 'bg-custody-blue-light',
    },
    {
      label: '查看总览',
      description: '3D图表+趋势分析',
      icon: BarChart3,
      path: '/overview',
      color: 'text-carbon-600',
      bgColor: 'bg-carbon-100',
    },
    {
      label: '尾差调整列表',
      description: '查看所有调整记录',
      icon: List,
      path: '/adjustments',
      color: 'text-warning-orange',
      bgColor: 'bg-warning-orange-light',
    },
    {
      label: '负责人摘要',
      description: '待确认事项汇总',
      icon: FileText,
      path: '/summary',
      color: 'text-summary-gold',
      bgColor: 'bg-summary-gold-light',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-carbon-800">
            早上好，{useClearingStore.getState().currentUser} 👋
          </h1>
          <p className="text-carbon-500 mt-1">
            {currentRole === 'risk'
              ? `今天有 ${stats.pendingReview} 条记录等待您的复核，加油！`
              : currentRole === 'executive'
              ? `共有 ${stats.flagged} 条冲正记录需要您关注。`
              : `今天有 ${stats.pendingCustody} 条记录等待补托管页，${stats.pendingReview} 条等待风控复核。`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`bg-white rounded-xl p-5 shadow-card hover:shadow-card-hover transition-all duration-200 cursor-pointer animate-slide-up ${
                card.action ? 'hover:-translate-y-1' : ''
              }`}
              style={{ animationDelay: `${index * 0.1}s` }}
              onClick={card.action}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-carbon-500">{card.label}</p>
                  <p className="text-3xl font-bold text-carbon-800 mt-2">{card.value}</p>
                </div>
                <div className={`w-12 h-12 ${card.bgColor} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${card.color.replace('bg-', 'text-')}`} />
                </div>
              </div>
              {card.value > 0 && card.action && (
                <div className="mt-3 flex items-center text-xs text-carbon-400 hover:text-custody-blue transition-colors">
                  点击处理 <ArrowRight className="w-3 h-3 ml-1" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-carbon-800">待办事项</h2>
            <span className="text-sm text-carbon-400">{pendingItems.length} 条待处理</span>
          </div>
          {pendingItems.length === 0 ? (
            <div className="text-center py-12 text-carbon-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-finance-green opacity-50" />
              <p>太棒了！没有待处理的事项～</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingItems.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-carbon-50 transition-colors cursor-pointer group"
                  onClick={() => {
                    if (item.status === 'pending_custody') {
                      navigate(`/adjustments/${item.id}`);
                    } else {
                      navigate(`/review`);
                    }
                  }}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    item.status === 'pending_custody' ? 'bg-warning-orange-light' : 'bg-risk-red-light'
                  }`}>
                    {item.status === 'pending_custody' ? (
                      <FileCheck className="w-5 h-5 text-warning-orange" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-risk-red" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-carbon-800 truncate">{item.adjustmentNo}</p>
                      <StatusBadge status={item.status} amount={item.amount} remark={item.remark} />
                    </div>
                    <p className="text-sm text-carbon-500 truncate">{item.remark}</p>
                  </div>
                  <div className="text-right">
                    <AmountDisplay amount={item.amount} />
                    <p className="text-xs text-carbon-400 mt-1">{item.tradeDate}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-carbon-300 group-hover:text-carbon-500 transition-colors opacity-0 group-hover:opacity-100" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-card">
          <h2 className="text-lg font-semibold text-carbon-800 mb-4">快捷操作</h2>
          <div className="space-y-3">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.path}
                  onClick={() => navigate(action.path)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-carbon-50 transition-colors text-left group"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className={`w-10 h-10 ${action.bgColor} rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${action.color}`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-carbon-800 group-hover:text-custody-blue transition-colors">
                      {action.label}
                    </p>
                    <p className="text-xs text-carbon-400">{action.description}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-carbon-300 group-hover:text-carbon-500 transition-colors" />
                </button>
              );
            })}
          </div>

          <div className="mt-6 p-4 bg-carbon-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-carbon-400" />
              <span className="text-sm text-carbon-500">系统提示</span>
            </div>
            <p className="text-sm text-carbon-600">
              {currentRole === 'risk'
                ? '风控复核时请务必核对托管凭证的完整性，确认冲正记录的真实性。'
                : currentRole === 'executive'
                ? '摘要页面汇总了所有冲正记录的状态和下一步操作建议。'
                : '金额为0但备注"已冲正"的记录需要人工复核，别忘了补托管确认页哦！'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
