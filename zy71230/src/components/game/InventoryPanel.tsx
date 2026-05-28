import { motion } from 'framer-motion';
import { Package, AlertTriangle, TrendingDown, TrendingUp, DollarSign, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MerchItem } from '@/types/tour';

interface InventoryPanelProps {
  items: MerchItem[];
  onItemClick?: (item: MerchItem) => void;
}

function getStockStatus(currentStock: number, initialStock: number) {
  const percentage = (currentStock / initialStock) * 100;
  if (percentage <= 10) return { status: 'critical', label: '库存告急', color: 'text-danger-red', bgColor: 'bg-danger-red' };
  if (percentage <= 30) return { status: 'low', label: '库存不足', color: 'text-warning-orange', bgColor: 'bg-warning-orange' };
  if (percentage >= 90) return { status: 'overstock', label: '积压风险', color: 'text-neon-purple', bgColor: 'bg-neon-purple' };
  return { status: 'normal', label: '正常', color: 'text-success-green', bgColor: 'bg-success-green' };
}

export default function InventoryPanel({ items, onItemClick }: InventoryPanelProps) {
  const totalValue = items.reduce((sum, item) => sum + item.currentStock * item.costPrice, 0);
  const totalPotentialProfit = items.reduce((sum, item) => sum + item.currentStock * (item.sellingPrice - item.costPrice), 0);
  const lowStockItems = items.filter(item => (item.currentStock / item.initialStock) <= 0.3).length;
  const overstockItems = items.filter(item => (item.currentStock / item.initialStock) >= 0.9).length;

  return (
    <div className="w-full p-6 bg-rock-dark/80 backdrop-blur-sm border border-rock-light rounded-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-neon-pink" />
          <h2 className="text-xl font-rock text-white tracking-wider">库存管理</h2>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-warning-orange" />
            <span className="text-rock-light">库存不足: <span className="text-warning-orange font-bold">{lowStockItems}</span></span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-neon-purple" />
            <span className="text-rock-light">积压风险: <span className="text-neon-purple font-bold">{overstockItems}</span></span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <motion.div
          className="p-4 bg-rock-darker/50 border border-rock-light rounded-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-neon-cyan" />
            <span className="text-xs text-rock-light">库存总价值</span>
          </div>
          <div className="text-xl font-bold text-neon-cyan font-mono">
            ¥{totalValue.toLocaleString('zh-CN')}
          </div>
        </motion.div>

        <motion.div
          className="p-4 bg-rock-darker/50 border border-rock-light rounded-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-success-green" />
            <span className="text-xs text-rock-light">潜在利润</span>
          </div>
          <div className="text-xl font-bold text-success-green font-mono">
            ¥{totalPotentialProfit.toLocaleString('zh-CN')}
          </div>
        </motion.div>

        <motion.div
          className="p-4 bg-rock-darker/50 border border-rock-light rounded-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart className="w-4 h-4 text-neon-purple" />
            <span className="text-xs text-rock-light">商品种类</span>
          </div>
          <div className="text-xl font-bold text-neon-purple font-mono">
            {items.length} 种
          </div>
        </motion.div>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => {
          const stockPercentage = (item.currentStock / item.initialStock) * 100;
          const stockStatus = getStockStatus(item.currentStock, item.initialStock);
          const profitPerItem = item.sellingPrice - item.costPrice;
          const profitMargin = ((profitPerItem / item.sellingPrice) * 100).toFixed(1);

          return (
            <motion.div
              key={item.id}
              className="relative p-4 bg-rock-darker/50 border border-rock-light rounded-lg overflow-hidden group cursor-pointer hover:border-neon-cyan/50 transition-all duration-300"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => onItemClick?.(item)}
              whileHover={{ scale: 1.01 }}
            >
              <div className={cn(
                'absolute top-0 left-0 w-1 h-full transition-all duration-300',
                stockStatus.bgColor,
                'group-hover:w-1.5'
              )} />

              <div className="flex items-start gap-4">
                <div className={cn(
                  'p-3 rounded-lg bg-opacity-20',
                  stockStatus.bgColor
                )}>
                  <Package className={cn('w-6 h-6', stockStatus.color)} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white truncate">{item.name}</h3>
                      {item.sku && (
                        <span className="text-xs text-rock-light bg-rock-gray px-2 py-0.5 rounded">
                          {item.sku}
                        </span>
                      )}
                    </div>
                    <div className={cn(
                      'text-xs px-2 py-0.5 rounded-full bg-opacity-20',
                      stockStatus.bgColor,
                      stockStatus.color
                    )}>
                      {stockStatus.label}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-3 text-xs">
                    <div>
                      <span className="text-rock-light">成本价</span>
                      <div className="font-mono text-white">¥{item.costPrice}</div>
                    </div>
                    <div>
                      <span className="text-rock-light">售价</span>
                      <div className="font-mono text-neon-cyan">¥{item.sellingPrice}</div>
                    </div>
                    <div>
                      <span className="text-rock-light">利润</span>
                      <div className="font-mono text-success-green">
                        ¥{profitPerItem} <span className="text-xs">({profitMargin}%)</span>
                      </div>
                    </div>
                  </div>

                  <div className="relative">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-rock-light">库存状态</span>
                      <span className={cn('font-bold font-mono', stockStatus.color)}>
                        {item.currentStock} / {item.initialStock}
                        <span className="text-rock-light ml-1">({stockPercentage.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-rock-gray rounded-full overflow-hidden">
                      <motion.div
                        className={cn('h-full rounded-full', stockStatus.bgColor)}
                        initial={{ width: 0 }}
                        animate={{ width: `${stockPercentage}%` }}
                        transition={{ duration: 1, delay: index * 0.1 + 0.3 }}
                      />
                    </div>

                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                      <div className="absolute top-full left-[30%] w-px h-3 bg-warning-orange/50" />
                      <div className="absolute top-full left-[10%] w-px h-4 bg-danger-red/50" />
                      <div className="absolute top-full left-[90%] w-px h-3 bg-neon-purple/50" />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-rock-light/30 text-xs">
                    <div className="flex items-center gap-1 text-warning-orange">
                      <div className="w-2 h-2 rounded-full bg-warning-orange" />
                      <span>警戒线 30%</span>
                    </div>
                    <div className="flex items-center gap-1 text-danger-red">
                      <div className="w-2 h-2 rounded-full bg-danger-red" />
                      <span>危险线 10%</span>
                    </div>
                    <div className="flex items-center gap-1 text-neon-purple">
                      <div className="w-2 h-2 rounded-full bg-neon-purple" />
                      <span>积压线 90%</span>
                    </div>
                  </div>
                </div>

                {stockStatus.status === 'critical' && (
                  <motion.div
                    className="absolute top-2 right-2"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <AlertTriangle className="w-5 h-5 text-danger-red" />
                  </motion.div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {items.length === 0 && (
        <div className="text-center py-12 text-rock-light">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>暂无库存商品</p>
        </div>
      )}
    </div>
  );
}
