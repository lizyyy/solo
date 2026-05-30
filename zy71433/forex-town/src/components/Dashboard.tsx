import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, DollarSign, Package, ShoppingCart, AlertTriangle, ArrowRight, Sparkles } from 'lucide-react';
import { useGame } from '../GameContext';
import { formatCurrency, formatPercent, getCardTypeLabel, getCardTypeColor, getTrendColor, getOrderStatusLabel, getOrderStatusColor } from '../utils';
import { products } from '../mockData';

export const Dashboard: React.FC = () => {
  const { state, dispatch } = useGame();
  const [purchaseQuantity, setPurchaseQuantity] = useState<Record<string, number>>({});
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  const pendingExceptions = state.exceptions.filter((e) => e.status === 'pending').length;
  const totalInventoryValue = state.inventory.reduce(
    (sum, inv) => sum + inv.totalValue * state.currentRate.rate,
    0
  );
  const totalOrders = state.orders.length;
  const completedOrders = state.orders.filter((o) => o.status === 'delivered').length;
  const defaultedOrders = state.orders.filter((o) => o.status === 'defaulted').length;

  const stats = [
    {
      label: '现金余额',
      value: formatCurrency(state.cash),
      change: state.cash - state.initialCash,
      icon: DollarSign,
      color: 'from-blue-500 to-blue-600',
    },
    {
      label: '库存价值',
      value: formatCurrency(totalInventoryValue),
      change: 0,
      icon: Package,
      color: 'from-purple-500 to-purple-600',
    },
    {
      label: '订单总数',
      value: totalOrders.toString(),
      subValue: `完成 ${completedOrders} / 违约 ${defaultedOrders}`,
      icon: ShoppingCart,
      color: 'from-green-500 to-green-600',
    },
    {
      label: '待处理异常',
      value: pendingExceptions.toString(),
      change: pendingExceptions > 0 ? -pendingExceptions : 0,
      icon: AlertTriangle,
      color: pendingExceptions > 0 ? 'from-red-500 to-red-600' : 'from-gray-500 to-gray-600',
    },
  ];

  const handlePurchase = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const qty = purchaseQuantity[productId] || 10;
    const totalForeign = qty * product.unitCost;
    const cnyAmount = totalForeign * state.currentRate.rate;

    if (state.cash < cnyAmount) {
      alert('现金不足，无法完成采购！');
      return;
    }

    dispatch({
      type: 'PURCHASE_INVENTORY',
      payload: {
        productId: product.id,
        productName: product.name,
        quantity: qty,
        unitCost: product.unitCost,
        currency: product.currency,
      },
    });

    setShowPurchaseModal(false);
    setSelectedProduct(null);
    setPurchaseQuantity({});
  };

  const handleNextRound = () => {
    dispatch({ type: 'NEXT_ROUND' });
  };

  const TrendIcon = state.currentRate.trend === 'up' ? TrendingUp : state.currentRate.trend === 'down' ? TrendingDown : Minus;
  const rateChange = state.currentRate.rate - state.currentRate.previousRate;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">经营仪表盘</h2>
          <p className="text-gray-500 mt-1">第 {state.currentRound} 回合经营概览</p>
        </div>
        <button
          onClick={handleNextRound}
          disabled={state.isGameOver}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-lg shadow-primary-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>进入下一回合</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
                  {stat.subValue && (
                    <p className="text-sm text-gray-400 mt-1">{stat.subValue}</p>
                  )}
                  {stat.change !== undefined && stat.change !== 0 && (
                    <p className={`text-sm font-medium mt-2 ${stat.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stat.change > 0 ? '+' : ''}{formatCurrency(stat.change)}
                    </p>
                  )}
                </div>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">本回合汇率卡</h3>
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getCardTypeColor(state.currentRate.cardType)}`}>
              {getCardTypeLabel(state.currentRate.cardType)}
            </span>
          </div>

          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">1 {state.currentRate.currency} =</p>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="text-4xl font-bold text-gray-900">
                    {state.currentRate.rate.toFixed(4)}
                  </span>
                  <span className="text-gray-500">CNY</span>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <TrendIcon className={`w-5 h-5 ${getTrendColor(state.currentRate.trend)}`} />
                  <span className={`font-medium ${getTrendColor(state.currentRate.trend)}`}>
                    {rateChange > 0 ? '+' : ''}{rateChange.toFixed(4)}
                  </span>
                  <span className="text-gray-400 text-sm">
                    （{formatPercent(Math.abs(rateChange / state.currentRate.previousRate))}）
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 mb-2">市场解读</p>
                <p className="text-sm text-gray-700 max-w-xs leading-relaxed">
                  {state.currentRate.description}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">汇率历史走势</h4>
            <div className="flex items-end gap-2 h-24">
              {state.exchangeRates.slice(0, state.currentRound).map((rate, index) => (
                <div key={rate.id} className="flex-1 flex flex-col items-center">
                  <div
                    className={`w-full rounded-t ${rate.trend === 'up' ? 'bg-green-400' : rate.trend === 'down' ? 'bg-red-400' : 'bg-gray-400'}`}
                    style={{
                      height: `${((rate.rate - 7.0) / 0.5) * 100}%`,
                      minHeight: '20px',
                    }}
                  />
                  <span className="text-xs text-gray-400 mt-2">R{index + 1}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">快速采购</h3>
          <div className="space-y-3">
            {products.map((product) => (
              <div
                key={product.id}
                className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedProduct(product.id);
                  setShowPurchaseModal(true);
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{product.name}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatCurrency(product.unitCost, product.currency)} / 件
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
                    <ShoppingCart className="w-5 h-5 text-primary-500" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">近期订单</h3>
          <div className="space-y-3">
            {state.orders.slice(-4).reverse().map((order) => (
              <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-medium text-gray-900">{order.customerName}</p>
                  <p className="text-sm text-gray-500">
                    {order.productName} × {order.quantity}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(order.totalAmount, order.currency)}
                  </p>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getOrderStatusColor(order.status)}`}>
                    {getOrderStatusLabel(order.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">库存概况</h3>
          <div className="space-y-4">
            {state.inventory.map((item) => (
              <div key={item.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{item.productName}</span>
                  <span className="text-sm text-gray-500">
                    {item.quantity} / {item.overstockThreshold} 件
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      item.isOverstock ? 'bg-red-500' : item.quantity >= item.overstockThreshold * 0.8 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min((item.quantity / item.overstockThreshold) * 100, 100)}%` }}
                  />
                </div>
                {item.isOverstock && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> 库存积压预警
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showPurchaseModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">采购确认</h3>
            {(() => {
              const product = products.find((p) => p.id === selectedProduct);
              if (!product) return null;
              const qty = purchaseQuantity[selectedProduct] || 10;
              const totalForeign = qty * product.unitCost;
              const cnyAmount = totalForeign * state.currentRate.rate;

              return (
                <>
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-500">
                        单价: {formatCurrency(product.unitCost, product.currency)}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        采购数量
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={qty}
                        onChange={(e) => setPurchaseQuantity({ ...purchaseQuantity, [selectedProduct]: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div className="p-4 bg-primary-50 rounded-xl border border-primary-100">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">外币金额</span>
                        <span className="font-medium">{formatCurrency(totalForeign, product.currency)}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">汇率</span>
                        <span className="font-medium">{state.currentRate.rate.toFixed(4)}</span>
                      </div>
                      <div className="border-t border-primary-200 pt-2 mt-2">
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-900">人民币金额</span>
                          <span className="font-bold text-primary-600">{formatCurrency(cnyAmount)}</span>
                        </div>
                      </div>
                    </div>

                    {state.cash < cnyAmount && (
                      <p className="text-red-500 text-sm flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" /> 现金余额不足
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => {
                        setShowPurchaseModal(false);
                        setSelectedProduct(null);
                      }}
                      className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => handlePurchase(selectedProduct)}
                      disabled={state.cash < cnyAmount}
                      className="flex-1 px-4 py-3 bg-primary-500 text-white font-medium rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      确认采购
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
