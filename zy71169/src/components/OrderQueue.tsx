import React from 'react';
import { AlertTriangle, Clock, User, UtensilsCrossed } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { GRADE_COLORS, GRADE_NAMES } from '../game/levels';
import { getAllergenLabel } from '../game/meals';

export default function OrderQueue() {
  const { ordersForPrep, gameTime, setDraggedMeal } = useGameStore();
  const [isExpanded, setIsExpanded] = React.useState(true);

  const getUrgencyColor = (order: typeof ordersForPrep[number]) => {
    const timeLeft = order.pickupTime - gameTime;
    if (timeLeft <= 5) return 'border-red-500 bg-red-50';
    if (timeLeft <= 15) return 'border-yellow-500 bg-yellow-50';
    return 'border-green-500 bg-green-50';
  };

  const getUrgencyBarColor = (order: typeof ordersForPrep[number]) => {
    const timeLeft = order.pickupTime - gameTime;
    if (timeLeft <= 5) return 'bg-red-500';
    if (timeLeft <= 15) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const handleDragStart = (e: React.DragEvent, orderId: string, mealId: string) => {
    e.dataTransfer.setData('orderId', orderId);
    e.dataTransfer.setData('mealId', mealId);
    setDraggedMeal(mealId);
  };

  const handleDragEnd = () => {
    setDraggedMeal(null);
  };

  const sortedOrders = [...ordersForPrep].sort((a, b) => a.pickupTime - b.pickupTime);

  return (
    <div
      className={`fixed left-0 top-20 bottom-20 z-40 transition-all duration-300 ${
        isExpanded ? 'w-72' : 'w-12'
      }`}
    >
      <div className="h-full flex">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-12 bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center rounded-r-lg shadow-lg transition-colors"
          title={isExpanded ? '收起面板' : '展开面板'}
        >
          <span className="writing-mode-vertical text-lg font-bold">
            {isExpanded ? '◀' : '▶'}
          </span>
        </button>

        {isExpanded && (
          <div className="flex-1 bg-white/95 backdrop-blur-sm border-l-2 border-amber-500 shadow-xl overflow-hidden flex flex-col">
            <div className="bg-amber-500 text-white px-4 py-3 flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5" />
              <span className="font-bold">待处理订单</span>
              <span className="ml-auto bg-amber-400 px-2 py-0.5 rounded-full text-sm font-medium">
                {ordersForPrep.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {sortedOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Clock className="w-12 h-12 mb-2 opacity-50" />
                  <p className="text-sm">暂无待处理订单</p>
                </div>
              ) : (
                sortedOrders.map((order) => {
                  const timeLeft = Math.max(0, Math.ceil(order.pickupTime - gameTime));
                  const isUrgent = timeLeft <= 5;
                  const isWarning = timeLeft <= 15;

                  return (
                    <div
                      key={order.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, order.id, order.meal.id)}
                      onDragEnd={handleDragEnd}
                      className={`border-l-4 rounded-lg p-3 cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${getUrgencyColor(
                        order
                      )}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-500" />
                          <span className="font-medium text-gray-800">
                            {order.student.name}
                          </span>
                          <span
                            className="text-xs px-1.5 py-0.5 rounded text-white font-medium"
                            style={{ backgroundColor: GRADE_COLORS[order.student.grade] }}
                          >
                            {GRADE_NAMES[order.student.grade]}
                          </span>
                        </div>
                        <div
                          className={`flex items-center gap-1 font-bold text-sm ${isUrgent ? 'text-red-600' : isWarning ? 'text-yellow-600' : 'text-green-600'}`}
                        >
                          {isUrgent && <AlertTriangle className="w-4 h-4" />}
                          <Clock className="w-4 h-4" />
                          {timeLeft}s
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{order.meal.emoji}</span>
                        <div>
                          <p className="font-medium text-gray-700 text-sm">
                            {order.meal.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {GRADE_NAMES[order.meal.grade]} · {order.meal.type}
                          </p>
                        </div>
                      </div>

                      {order.student.allergens.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-xs text-gray-500">过敏原:</span>
                          {order.student.allergens.map((allergen) => (
                            <span
                              key={allergen}
                              className="text-sm"
                              title={allergen}
                            >
                              {getAllergenLabel(allergen)}
                            </span>
                          ))}
                        </div>
                      )}

                      {order.meal.containsAllergens.length > 0 && (
                        <div className="mt-1 flex items-center gap-1 flex-wrap">
                          <span className="text-xs text-gray-500">含:</span>
                          {order.meal.containsAllergens.map((allergen) => (
                            <span
                              key={allergen}
                              className="text-sm"
                              title={allergen}
                            >
                              {getAllergenLabel(allergen)}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${getUrgencyBarColor(
                            order
                          )}`}
                          style={{
                            width: `${Math.max(0, Math.min(100, (timeLeft / 15) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}