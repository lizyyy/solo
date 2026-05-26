import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GameRecord, GameEvent } from '../types/game';
import { ScoreBoard } from '../components/ui/ScoreBoard';
import { formatTime } from '../game/engine';
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, Download, FileText } from 'lucide-react';

export function ReportPage() {
  const { recordId } = useParams<{ recordId: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<GameRecord | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);

  useEffect(() => {
    const records = JSON.parse(localStorage.getItem('gameRecords') || '[]');
    const found = records.find((r: GameRecord) => r.id === recordId);
    if (found) {
      setRecord(found);
    }
  }, [recordId]);

  useEffect(() => {
    if (!isPlaying || !record) return;

    const timer = setInterval(() => {
      setCurrentEventIndex((prev) => {
        if (prev >= record.events.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 500);

    return () => clearInterval(timer);
  }, [isPlaying, record]);

  const exportReport = () => {
    if (!record) return;
    
    const report = {
      levelId: record.levelId,
      recordId: record.id,
      gameTime: formatTime(record.endTime - record.startTime),
      score: record.score,
      events: record.events.map((e) => ({
        time: formatTime(e.timestamp),
        type: e.type,
        data: e.data,
      })),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `warehouse-game-report-${record.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getEventIcon = (type: GameEvent['type']) => {
    switch (type) {
      case 'move': return '🚀';
      case 'collision': return '💥';
      case 'pick': return '📦';
      case 'charge': return '⚡';
      case 'order_complete': return '✅';
      case 'battery_dead': return '🔋';
      case 'order_timeout': return '⏰';
      case 'invalid_path': return '❌';
      default: return '📌';
    }
  };

  const getEventLabel = (type: GameEvent['type']) => {
    switch (type) {
      case 'move': return '移动';
      case 'collision': return '碰撞';
      case 'pick': return '拣货';
      case 'charge': return '充电';
      case 'order_complete': return '订单完成';
      case 'battery_dead': return '电量耗尽';
      case 'order_timeout': return '订单超时';
      case 'invalid_path': return '无效路径';
      default: return '事件';
    }
  };

  if (!record) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">未找到记录</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回主菜单
          </button>
          <h1 className="text-2xl font-bold text-white">游戏报告</h1>
          <button
            onClick={exportReport}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            导出JSON
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <ScoreBoard score={record.score} />

          <div className="p-6 rounded-xl bg-gray-800">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              游戏概览
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">关卡</span>
                <span className="text-white font-medium">{record.levelId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">游戏时长</span>
                <span className="text-white font-mono">{formatTime((record.endTime - record.startTime) / 1000)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">事件总数</span>
                <span className="text-white">{record.events.length} 个</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">完成订单</span>
                <span className="text-green-400">
                  {record.finalState.orders.filter((o) => o.status === 'completed').length} / {record.finalState.orders.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-gray-800 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">事件回放</h3>
          
          <div className="flex items-center justify-center gap-4 mb-4">
            <button
              onClick={() => setCurrentEventIndex(0)}
              className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white"
            >
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white"
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>
            <button
              onClick={() => setCurrentEventIndex(record.events.length - 1)}
              className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-4">
            <input
              type="range"
              min={0}
              max={record.events.length - 1}
              value={currentEventIndex}
              onChange={(e) => setCurrentEventIndex(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-sm text-gray-400 mt-1">
              <span>0%</span>
              <span>{Math.round((currentEventIndex / (record.events.length - 1)) * 100)}%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-gray-800">
          <h3 className="text-lg font-semibold text-white mb-4">事件时间线</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {record.events.map((event, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg transition-all ${
                  index === currentEventIndex
                    ? 'bg-blue-900/50 border border-blue-500'
                    : index < currentEventIndex
                    ? 'bg-gray-700/50 opacity-60'
                    : 'bg-gray-700/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{getEventIcon(event.type)}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">{getEventLabel(event.type)}</span>
                      <span className="text-sm text-gray-400 font-mono">
                        {formatTime(event.timestamp)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      {JSON.stringify(event.data)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
