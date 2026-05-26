import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Download, Calendar, Trophy, XCircle, CheckCircle, Trash2 } from 'lucide-react';
import type { GameRecord } from '@/types/game';
import { loadGameRecords, getGameRecord } from '@/utils/reportGenerator';
import { ReportPanel } from '@/components/ui/ReportPanel';
import { useGameStore } from '@/store/useGameStore';

export const HistoryPage = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<GameRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<GameRecord | null>(null);
  const setReplayMode = useGameStore(state => state.setReplayMode);

  useEffect(() => {
    const recs = loadGameRecords();
    setRecords(recs);
  }, []);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleReplay = (record: GameRecord) => {
    setReplayMode(record);
    navigate(`/game/${record.levelId}`);
  };

  const handleClearHistory = () => {
    if (confirm('确定要清空所有历史记录吗？')) {
      localStorage.removeItem('baggage_game_records');
      setRecords([]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950/20 to-gray-950 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            返回主菜单
          </button>
          {records.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-2 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              清空记录
            </button>
          )}
        </div>

        <h1 className="text-3xl font-bold mb-8">游戏历史记录</h1>

        {records.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-10 h-10 text-gray-600" />
            </div>
            <h2 className="text-xl text-gray-400 mb-2">暂无游戏记录</h2>
            <p className="text-gray-500 mb-6">完成一局游戏后，记录会显示在这里</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium transition-colors"
            >
              开始游戏
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map((record) => (
              <div
                key={record.id}
                className="bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-700 overflow-hidden hover:border-gray-600 transition-colors"
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {record.passed ? (
                        <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
                          <CheckCircle className="w-6 h-6 text-green-400" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-red-600/20 rounded-lg flex items-center justify-center">
                          <XCircle className="w-6 h-6 text-red-400" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-lg">{record.levelName}</h3>
                        <p className="text-sm text-gray-400">{formatDate(record.startTime)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-yellow-400 font-mono">
                          {record.score.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-400">
                          用时 {formatTime(record.playTime)}
                        </div>
                      </div>
                      <Trophy className="w-5 h-5 text-yellow-400" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">处理总数</div>
                      <div className="text-xl font-bold font-mono text-white">
                        {record.correctCount + record.errorCount}
                      </div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">正确</div>
                      <div className="text-xl font-bold font-mono text-green-400">
                        {record.correctCount}
                      </div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">错误</div>
                      <div className="text-xl font-bold font-mono text-red-400">
                        {record.errorCount}
                      </div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">准确率</div>
                      <div className="text-xl font-bold font-mono text-blue-400">
                        {(record.accuracy * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {(record.transferTimeoutCount > 0 || record.oversizeErrorCount > 0) && (
                    <div className="flex gap-4 mb-4 text-sm">
                      {record.transferTimeoutCount > 0 && (
                        <span className="text-orange-400">
                          转机超时: {record.transferTimeoutCount}次
                        </span>
                      )}
                      {record.oversizeErrorCount > 0 && (
                        <span className="text-red-400">
                          超规错误: {record.oversizeErrorCount}次
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedRecord(record)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      查看报告
                    </button>
                    <button
                      onClick={() => handleReplay(record)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors font-medium"
                    >
                      <Play className="w-4 h-4" />
                      观看回放
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedRecord && (
        <ReportPanel
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onReplay={() => {
            handleReplay(selectedRecord);
            setSelectedRecord(null);
          }}
        />
      )}
    </div>
  );
};
