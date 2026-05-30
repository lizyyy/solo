import React from 'react';
import { LayoutDashboard, ShoppingCart, Package, BookOpen, AlertTriangle, BarChart3, ChevronRight } from 'lucide-react';
import { useGame } from '../GameContext';

const tabs = [
  { id: 'dashboard', label: '经营仪表盘', icon: LayoutDashboard },
  { id: 'orders', label: '订单管理', icon: ShoppingCart, badge: true },
  { id: 'inventory', label: '库存管理', icon: Package },
  { id: 'ledger', label: '交易账本', icon: BookOpen },
  { id: 'exceptions', label: '异常清单', icon: AlertTriangle, badge: true },
  { id: 'review', label: '月底复盘', icon: BarChart3 },
] as const;

export const Sidebar: React.FC = () => {
  const { state, dispatch } = useGame();

  const pendingExceptions = state.exceptions.filter((e) => e.status === 'pending').length;
  const pendingOrders = state.orders.filter((o) => o.status === 'pending').length;

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-80px)]">
      <nav className="p-4">
        <ul className="space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = state.selectedTab === tab.id;
            let badgeCount = 0;
            
            if (tab.id === 'exceptions') badgeCount = pendingExceptions;
            if (tab.id === 'orders') badgeCount = pendingOrders;

            return (
              <li key={tab.id}>
                <button
                  onClick={() => dispatch({ type: 'SET_TAB', payload: tab.id })}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-600'}`}
                  />
                  <span className="font-medium flex-1 text-left">{tab.label}</span>
                  {'badge' in tab && tab.badge && badgeCount > 0 && (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full bg-red-500 text-white">
                      {badgeCount}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-4 h-4 text-primary-500" />}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-8 p-4 bg-gradient-to-br from-primary-50 to-blue-50 rounded-xl border border-primary-100">
          <h4 className="font-semibold text-primary-900 mb-2">💡 经营提示</h4>
          <p className="text-sm text-primary-700 leading-relaxed">
            {state.currentRound <= 2
              ? '前期建议适量备货，关注汇率走势，优先选择低违约风险客户。'
              : state.currentRound <= 5
              ? '中期注意控制库存积压风险，及时处理异常订单，合理安排结汇时机。'
              : '后期重点关注应收账款回收，优化资金结构，确保达成经营目标。'}
          </p>
        </div>
      </nav>
    </aside>
  );
};
