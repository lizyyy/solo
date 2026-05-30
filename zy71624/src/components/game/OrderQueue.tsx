import { motion, AnimatePresence } from 'framer-motion';
import type { Order } from '@/types';
import { useGameStore } from '@/store/gameStore';
import { formatVoltage, formatTime } from '@/utils/gameConfig';
import { getOrderStatusColor, getOrderStatusText } from '@/utils/orderGenerator';
import { ClockIcon, VoltageIcon, ScoreIcon } from '../circuit/CircuitIcons';

function OrderCard({ order }: { order: Order }) {
  const now = Date.now();
  const elapsed = (now - order.createdAt) / 1000;
  const remaining = Math.max(0, order.timeoutSeconds - elapsed);
  const progress = (remaining / order.timeoutSeconds) * 100;
  const isUrgent = remaining < 10;

  const statusColor = getOrderStatusColor(order.status);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className={`p-3 rounded-lg border-2 bg-neon-card/50 transition-all duration-300 ${
        order.status === 'pending'
          ? isUrgent
            ? 'border-neon-red shadow-neon-red/30'
            : 'border-neon-purple/50 hover:border-neon-purple'
          : `border-[${statusColor}]/50 opacity-60`
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-sm" style={{ color: statusColor }}>
            {order.barName}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${statusColor}30`, color: statusColor }}
          >
            {getOrderStatusText(order.status)}
          </span>
        </div>
        <div className="flex items-center gap-1 text-neon-orange">
          <ScoreIcon className="w-3 h-3" />
          <span className="text-xs font-bold">+{order.score}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs mb-2">
        <div className="flex items-center gap-1">
          <VoltageIcon className="w-3 h-3 text-neon-cyan" />
          <span className="text-neon-cyan">{formatVoltage(order.requiredVoltage)}</span>
        </div>
        <div className={`flex items-center gap-1 ${isUrgent && order.status === 'pending' ? 'text-neon-red animate-flicker' : 'text-neon-silver'}`}>
          <ClockIcon className="w-3 h-3" />
          <span>{formatTime(Math.ceil(remaining))}</span>
        </div>
      </div>

      {order.status === 'pending' && (
        <div className="h-1.5 bg-neon-bgSecondary rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${isUrgent ? 'bg-neon-red' : 'bg-neon-purple'}`}
            initial={{ width: '100%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      )}

      {order.status === 'completed' && order.completedAt && (
        <div className="text-xs text-neon-green">
          完成时间: {new Date(order.completedAt).toLocaleTimeString('zh-CN')}
        </div>
      )}

      {order.status === 'returned' && (
        <div className="text-xs text-neon-red">
          超时退回，请重新处理
        </div>
      )}
    </motion.div>
  );
}

export function OrderQueue() {
  const orders = useGameStore(state => state.orders);
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'confirmed');
  const returnedOrders = orders.filter(o => o.status === 'returned' || o.status === 'timeout');

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-neon-orange font-display font-bold text-sm text-neon-glow-cyan">
          订单队列
        </h3>
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-1 bg-neon-orange/20 text-neon-orange rounded">
            待处理 {pendingOrders.length}
          </span>
          <span className="px-2 py-1 bg-neon-green/20 text-neon-green rounded">
            已完成 {completedOrders.length}
          </span>
          <span className="px-2 py-1 bg-neon-red/20 text-neon-red rounded">
            退回 {returnedOrders.length}
          </span>
        </div>
      </div>
      
      <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
        <AnimatePresence>
          {[...pendingOrders, ...returnedOrders, ...completedOrders].map(order => (
            <OrderCard key={order.id} order={order} />
          ))}
        </AnimatePresence>
        {orders.length === 0 && (
          <div className="text-center text-neon-silver/50 py-8">
            暂无订单
          </div>
        )}
      </div>
    </div>
  );
}
