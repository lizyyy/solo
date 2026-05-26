import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ArrowLeft, Calendar, Clock, Star, Play, Trash2 } from 'lucide-react';
import { GameHistory } from '../game/types';
import { HistoryRecorder } from '../game/recorder';
import { LEVELS } from '../game/levels';

interface HistoryScreenProps {
  onBack: () => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ onBack }) => {
  const [history, setHistory] = useState<GameHistory[]>(() => 
    HistoryRecorder.getHistory()
  );
  const [selectedHistory, setSelectedHistory] = useState<GameHistory | null>(null);

  const handleDelete = (id: string) => {
    const updated = history.filter(h => h.id !== id);
    localStorage.setItem('factory_game_history', JSON.stringify(updated));
    setHistory(updated);
  };

  const handleClearAll = () => {
    localStorage.removeItem('factory_game_history');
    setHistory([]);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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

  const getStarCount = (score: string) => {
    switch (score) {
      case 'S': return 3;
      case 'A': return 2;
      case 'B': return 1;
      default: return 0;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Button onClick={onBack} variant="ghost">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回主菜单
          </Button>
          
          <h1 className="text-2xl font-bold text-white">历史记录</h1>
          
          {history.length > 0 && (
            <Button onClick={handleClearAll} variant="danger" size="sm">
              <Trash2 className="w-4 h-4 mr-2" />
              清空
            </Button>
          )}
        </div>

        {history.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <Clock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">暂无游戏记录</p>
              <p className="text-gray-500 text-sm mt-2">
                完成游戏后，记录将显示在这里
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {history.map((item, index) => {
              const level = LEVELS.find(l => l.id === item.levelId);
              
              return (
                <Card key={item.id}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        item.isWin ? 'bg-green-900/50' : 'bg-red-900/50'
                      }`}>
                        <span className={`text-xl font-bold ${
                          item.isWin ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {item.score}
                        </span>
                      </div>
                      
                      <div>
                        <h3 className="font-semibold text-white">
                          {level?.name || `第 ${item.levelId} 关`}
                        </h3>
                        <div className="flex items-center gap-3 text-sm text-gray-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(item.timestamp)}
                          </span>
                          <span>
                            成本: <span className="font-mono">¥{item.finalCost.toLocaleString()}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center">
                        {[1, 2, 3].map(i => (
                          <Star
                            key={i}
                            className={`w-5 h-5 ${
                              i <= getStarCount(item.score) 
                                ? 'text-amber-400 fill-amber-400' 
                                : 'text-gray-600'
                            }`}
                          />
                        ))}
                      </div>
                      
                      <Badge variant={item.isWin ? 'success' : 'danger'}>
                        {item.isWin ? '胜利' : '失败'}
                      </Badge>
                      
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {selectedHistory?.id === item.id && (
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <h4 className="text-sm font-medium text-gray-400 mb-2">生产事件</h4>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {item.events.slice(-10).reverse().map((event, idx) => (
                          <div key={idx} className="text-xs text-gray-400 flex items-start gap-2">
                            <span className="text-gray-500">[{Math.floor(event.time)}分]</span>
                            <span>{event.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
