import React from 'react';
import { Package, AlertTriangle, TrendingDown, TrendingUp, ShoppingCart } from 'lucide-react';
import { useGame } from '../GameContext';
import { formatCurrency } from '../utils';

export const Inventory: React.FC = () => {
  const { state, dispatch } = useGame();

  const totalItems = state.inventory.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = state.inventory.reduce(
    (sum, item) => sum + item.totalValue * state.currentRate.rate,
    0
  );
  const overstockItems = state.inventory.filter((item) => item.isOverstock);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">库存管理</h2>
          <p className="text-gray-500 mt-1">监控库存水平，避免积压风险</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">库存总数量</p>
              <p className="text-2xl font-bold text-gray-900">{totalItems} 件</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">库存总价值</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalValue)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">积压预警</p>
              <p className="text-2xl font-bold text-orange-600">{overstockItems.length} 项</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">库存周转</p>
              <p className="text-2xl font-bold text-gray-900">
                {state.roundHistory.length > 0 ? ((state.orders.filter((o) => o.status === 'delivered').length / state.inventory.length).toFixed(1)) : '0.0'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">库存明细</h3>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">商品</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">数量</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">单位成本</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">总价值（外币）</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">总价值（人民币）</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">积压预警线</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">状态</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {state.inventory.map((item) => {
              const usagePercent = (item.quantity / item.overstockThreshold) * 100;
              const cnyValue = item.totalValue * state.currentRate.rate;

              return (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                        <ShoppingCart className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{item.productName}</p>
                        <p className="text-sm text-gray-500">第{item.purchaseRound}回合采购</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-gray-900">{item.quantity} 件</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-900">{formatCurrency(item.unitCost, item.currency)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{formatCurrency(item.totalValue, item.currency)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-primary-600">{formatCurrency(cnyValue)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">{item.quantity} / {item.overstockThreshold}</span>
                        <span className="text-gray-600">{usagePercent.toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            item.isOverstock
                              ? 'bg-red-500'
                              : usagePercent >= 80
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(usagePercent, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {item.isOverstock ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        <AlertTriangle className="w-3 h-3" /> 积压风险
                      </span>
                    ) : usagePercent >= 80 ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                        <AlertTriangle className="w-3 h-3" /> 接近警戒线
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        库存健康
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {overstockItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> 库存积压预警
          </h3>
          <div className="space-y-3">
            {overstockItems.map((item) => (
              <div key={item.id} className="bg-white rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{item.productName}</p>
                    <p className="text-sm text-gray-500">
                      当前库存 {item.quantity} 件，超出警戒线 {item.quantity - item.overstockThreshold} 件
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">占用资金</p>
                    <p className="font-semibold text-red-600">
                      {formatCurrency(item.totalValue * state.currentRate.rate)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => dispatch({ type: 'SET_TAB', payload: 'exceptions' })}
                    className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    查看异常详情
                  </button>
                  <button className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    降价促销
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
