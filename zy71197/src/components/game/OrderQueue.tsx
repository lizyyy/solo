import React, { useState } from 'react';
import { Order, Mold, Level } from '../../game/types';
import { OrderCard } from './OrderCard';
import { Play, RotateCcw, Pause, FastForward, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface OrderQueueProps {
  level: Level;
  scheduledOrders: string[];
  onScheduleChange: (orderIds: string[]) => void;
  isRunning: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  status: string;
}

export const OrderQueue: React.FC<OrderQueueProps> = ({
  level,
  scheduledOrders,
  onScheduleChange,
  isRunning,
  onStart,
  onPause,
  onResume,
  onReset,
  speed,
  onSpeedChange,
  status
}) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const getMoldForOrder = (orderId: string): Mold | undefined => {
    const order = level.orders.find(o => o.id === orderId);
    return order ? level.molds.find(m => m.id === order.moldId) : undefined;
  };

  const unscheduledOrders = level.orders.filter(o => !scheduledOrders.includes(o.id));

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (index: number) => {
    setOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (dragIndex !== null && dragIndex !== index) {
      const newOrders = [...scheduledOrders];
      const [removed] = newOrders.splice(dragIndex, 1);
      newOrders.splice(index, 0, removed);
      onScheduleChange(newOrders);
    }
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleUnscheduledDragStart = (e: React.DragEvent, orderId: string) => {
    e.dataTransfer.setData('orderId', orderId);
    setDragIndex(-1);
  };

  const handleScheduledDrop = (e: React.DragEvent) => {
    const orderId = e.dataTransfer.getData('orderId');
    if (orderId && !scheduledOrders.includes(orderId)) {
      onScheduleChange([...scheduledOrders, orderId]);
    }
    setDragIndex(null);
    setOverIndex(null);
  };

  const removeFromSchedule = (index: number) => {
    const newOrders = scheduledOrders.filter((_, i) => i !== index);
    onScheduleChange(newOrders);
  };

  const getSpeedLabel = (s: number) => {
    switch (s) {
      case 1: return '1x';
      case 2: return '2x';
      case 4: return '4x';
      default: return '1x';
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700 bg-gray-900">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">订单排程</h3>
          <Badge variant={status === 'running' ? 'success' : status === 'paused' ? 'warning' : 'default'}>
            {status === 'running' ? '运行中' : status === 'paused' ? '已暂停' : status === 'completed' ? '已完成' : status === 'failed' ? '失败' : '待开始'}
          </Badge>
        </div>
      </div>

      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          {status === 'idle' || status === 'scheduling' ? (
            <Button
              onClick={onStart}
              disabled={scheduledOrders.length === 0}
              className="flex-1"
            >
              <Play className="w-4 h-4 mr-2" />
              开始生产
            </Button>
          ) : status === 'running' ? (
            <Button onClick={onPause} variant="warning" className="flex-1">
              <Pause className="w-4 h-4 mr-2" />
              暂停
            </Button>
          ) : status === 'paused' ? (
            <Button onClick={onResume} variant="success" className="flex-1">
              <Play className="w-4 h-4 mr-2" />
              继续
            </Button>
          ) : null}
          
          <Button onClick={onReset} variant="secondary" size="md">
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        {isRunning && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">速度:</span>
            {[1, 2, 4].map(s => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                  speed === s
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {getSpeedLabel(s)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
            <span>已排程</span>
            <span className="text-xs">({scheduledOrders.length}/{level.orders.length})</span>
          </h4>
          
          <div
            className="min-h-20 bg-gray-900 rounded-lg p-2 border-2 border-dashed border-gray-600"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleScheduledDrop}
          >
            {scheduledOrders.length === 0 ? (
              <div className="text-center text-gray-500 py-4 text-sm">
                拖拽下方订单到此处排程
              </div>
            ) : (
              scheduledOrders.map((orderId, index) => {
                const order = level.orders.find(o => o.id === orderId);
                if (!order) return null;
                
                return (
                  <div key={orderId} className="relative">
                    <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-xs text-white font-bold">
                      {index + 1}
                    </div>
                    <div 
                      className={`ml-3 ${overIndex === index ? 'border-t-2 border-blue-400' : ''}`}
                      onDragOver={(e) => handleDragOver(index)}
                      onDrop={(e) => handleDrop(index)}
                    >
                      <OrderCard
                        order={order}
                        mold={getMoldForOrder(orderId)}
                        index={index}
                        isScheduled={false}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                      />
                    </div>
                    {!isRunning && (
                      <button
                        onClick={() => removeFromSchedule(index)}
                        className="absolute -right-2 top-2 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-xs"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {!isRunning && (
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-2">待排程</h4>
            {unscheduledOrders.length === 0 ? (
              <div className="text-center text-gray-500 py-4 text-sm">
                所有订单已排程
              </div>
            ) : (
              unscheduledOrders.map(order => (
                <div
                  key={order.id}
                  draggable
                  onDragStart={(e) => handleUnscheduledDragStart(e, order.id)}
                >
                  <OrderCard
                    order={order}
                    mold={getMoldForOrder(order.id)}
                    index={-1}
                    isScheduled={false}
                    onDragStart={() => {}}
                    onDragOver={() => {}}
                    onDrop={() => {}}
                  />
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
