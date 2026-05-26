import React, { useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ArrowLeft, Star, TrendingDown, AlertTriangle, CheckCircle, XCircle, RotateCcw } from 'lucide-react';

interface ReportScreenProps {
  onBack: () => void;
  onReplay: () => void;
  onReturnMenu: () => void;
}

export const ReportScreen: React.FC<ReportScreenProps> = ({
  onBack,
  onReplay,
  onReturnMenu
}) => {
  const { gameState, currentLevel } = useGame();

  const result = useMemo(() => {
    if (!currentLevel) return null;

    const isWin = gameState.status === 'completed' && 
                  gameState.costs.total <= currentLevel.targetCost;
    
    const ratio = gameState.costs.total / currentLevel.targetCost;
    let score = 'D';
    if (isWin) {
      if (ratio <= 0.7) score = 'S';
      else if (ratio <= 0.85) score = 'A';
      else if (ratio <= 1.0) score = 'B';
      else if (ratio <= 1.2) score = 'C';
    }

    const stars = score === 'S' ? 3 : score === 'A' ? 2 : score === 'B' ? 1 : 0;

    return { isWin, score, stars, ratio };
  }, [gameState, currentLevel]);

  if (!currentLevel || !result) {
    return <div>数据加载中...</div>;
  }

  const { costs } = gameState;
  const totalOrders = currentLevel.orders.length;
  const completedOrders = gameState.completedOrders.length;
  const onTimeOrders = gameState.completedOrders.filter(orderId => {
    const order = currentLevel.orders.find(o => o.id === orderId);
    if (!order) return false;
    const orderIndex = gameState.scheduledOrders.indexOf(orderId);
    let finishTime = 0;
    for (let i = 0; i <= orderIndex; i++) {
      const o = currentLevel.orders.find(o => o.id === gameState.scheduledOrders[i]);
      if (o) finishTime += o.productionTime;
    }
    return finishTime <= order.deadline;
  }).length;

  const renderCostBreakdown = () => {
    const items = [
      { label: '换模成本', value: costs.changeover, color: 'text-amber-400' },
      { label: '清洗成本', value: costs.cleaning, color: 'text-blue-400' },
      { label: '延迟成本', value: costs.delay, color: 'text-red-400' },
      { label: '闲置成本', value: costs.idle, color: 'text-gray-400' }
    ];

    return items.map(item => {
      const percentage = costs.total > 0 ? (item.value / costs.total) * 100 : 0;
      return (
        <div key={item.label} className="mb-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">{item.label}</span>
            <span className={`font-mono ${item.color}`}>¥{Math.floor(item.value)}</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${
                item.color === 'text-amber-400' ? 'bg-amber-500' :
                item.color === 'text-blue-400' ? 'bg-blue-500' :
                item.color === 'text-red-400' ? 'bg-red-500' : 'bg-gray-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      );
    });
  };

  const getScoreColor = (score: string) => {
    switch (score) {
      case 'S': return 'text-green-400';
      case 'A': return 'text-blue-400';
      case 'B': return 'text-amber-400';
      case 'C': return 'text-orange-400';
      default: return 'text-red-400';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Button onClick={onBack} variant="ghost">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回游戏
          </Button>
          
          <h1 className="text-2xl font-bold text-white">结算报告</h1>
          
          <div className="w-24" />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <div className="text-center mb-6">
              <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full mb-4 ${
                result.isWin ? 'bg-green-900/50' : 'bg-red-900/50'
              }`}>
                {result.isWin ? (
                  <CheckCircle className="w-12 h-12 text-green-400" />
                ) : (
                  <XCircle className="w-12 h-12 text-red-400" />
                )}
              </div>
              
              <h2 className={`text-3xl font-bold mb-2 ${getScoreColor(result.score)}`}>
                {result.score}
              </h2>
              
              <div className="flex justify-center mb-4">
                {[1, 2, 3].map(i => (
                  <Star
                    key={i}
                    className={`w-8 h-8 ${
                      i <= result.stars ? 'text-amber-400 fill-amber-400' : 'text-gray-600'
                    }`}
                  />
                ))}
              </div>
              
              <p className={`text-lg ${result.isWin ? 'text-green-400' : 'text-red-400'}`}>
                {result.isWin ? '挑战成功!' : '挑战失败'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-900 rounded-lg p-4 text-center">
                <p className="text-gray-400 text-sm mb-1">目标成本</p>
                <p className="text-xl font-bold text-white font-mono">
                  ¥{currentLevel.targetCost.toLocaleString()}
                </p>
              </div>
              
              <div className="bg-gray-900 rounded-lg p-4 text-center">
                <p className="text-gray-400 text-sm mb-1">实际成本</p>
                <p className={`text-xl font-bold font-mono ${
                  costs.total <= currentLevel.targetCost ? 'text-green-400' : 'text-red-400'
                }`}>
                  ¥{Math.floor(costs.total).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mt-4 text-center">
              <Badge variant={costs.total <= currentLevel.targetCost ? 'success' : 'danger'}>
                {costs.total <= currentLevel.targetCost ? (
                  <>节省: ¥{Math.floor(currentLevel.targetCost - costs.total).toLocaleString()}</>
                ) : (
                  <>超支: ¥{Math.floor(costs.total - currentLevel.targetCost).toLocaleString()}</>
                )}
              </Badge>
            </div>
          </Card>

          <Card title="成本明细">
            {renderCostBreakdown()}
            
            <div className="mt-6 pt-4 border-t border-gray-700">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">总成本</span>
                <span className={`text-2xl font-bold font-mono ${
                  costs.total <= currentLevel.targetCost ? 'text-green-400' : 'text-red-400'
                }`}>
                  ¥{Math.floor(costs.total).toLocaleString()}
                </span>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-6">
          <Card title="订单完成情况">
            <div className="text-center">
              <p className="text-4xl font-bold text-white mb-2">
                {completedOrders} / {totalOrders}
              </p>
              <p className="text-gray-400 text-sm">已完成订单</p>
            </div>
          </Card>

          <Card title="准时交付">
            <div className="text-center">
              <p className="text-4xl font-bold text-green-400 mb-2">
                {onTimeOrders}
              </p>
              <p className="text-gray-400 text-sm">准时交付订单数</p>
            </div>
          </Card>

          <Card title="总用时">
            <div className="text-center">
              <p className="text-4xl font-bold text-blue-400 mb-2">
                {Math.floor(gameState.currentTime)}
              </p>
              <p className="text-gray-400 text-sm">分钟</p>
            </div>
          </Card>
        </div>

        {gameState.status === 'failed' && gameState.failReason && (
          <Card title="失败原因" className="mt-6">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6" />
              <p>{gameState.failReason}</p>
            </div>
          </Card>
        )}

        <div className="flex justify-center gap-4 mt-8">
          <Button onClick={onReplay} variant="primary" size="lg">
            <RotateCcw className="w-5 h-5 mr-2" />
            重新挑战
          </Button>
          <Button onClick={onReturnMenu} variant="secondary" size="lg">
            返回主菜单
          </Button>
        </div>
      </div>
    </div>
  );
};
