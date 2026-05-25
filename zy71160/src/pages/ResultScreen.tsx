import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, RotateCcw, Download, Play, ChevronLeft, ChevronRight, Trophy, Target, Flame, Clock, XCircle, CheckCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import { useGameStore } from '../store/gameStore';
import { getCategoryBin } from '../data/items';
import { ErrorRecord, GameResult } from '../types';

const ResultScreen: React.FC = () => {
  const navigate = useNavigate();
  const { getResult, resetGame, startGame, currentLevel } = useGameStore();
  const [selectedErrorIndex, setSelectedErrorIndex] = useState<number | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);

  const result = getResult();

  if (!result || !currentLevel) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-white text-xl">没有找到游戏记录</div>
      </div>
    );
  }

  const isPassed = result.accuracy >= currentLevel.requiredAccuracy;
  const stars = result.accuracy >= 0.9 ? 3 : result.accuracy >= 0.8 ? 2 : result.accuracy >= currentLevel.requiredAccuracy ? 1 : 0;

  const getErrorTypeLabel = (type: string) => {
    switch (type) {
      case 'misclassified': return '分类错误';
      case 'missed': return '漏分拣';
      case 'danger_missed': return '危险品漏拦';
      default: return type;
    }
  };

  const getErrorTypeColor = (type: string) => {
    switch (type) {
      case 'misclassified': return 'text-yellow-400';
      case 'missed': return 'text-orange-400';
      case 'danger_missed': return 'text-red-500';
      default: return 'text-gray-400';
    }
  };

  const handleReplayError = (index: number) => {
    setSelectedErrorIndex(index);
    setIsReplaying(true);
    setTimeout(() => setIsReplaying(false), 2000);
  };

  const handleExportReport = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(24);
    doc.setTextColor(34, 197, 94);
    doc.text('回收分拣产线 - 游戏报告', 105, 30, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text(`关卡: ${result.level.name}`, 20, 50);
    doc.text(`日期: ${new Date().toLocaleDateString('zh-CN')}`, 20, 60);
    doc.text(`用时: ${result.duration}秒`, 20, 70);
    
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text('成绩统计', 20, 90);
    
    doc.setFontSize(12);
    doc.text(`最终得分: ${result.score}`, 20, 105);
    doc.text(`正确率: ${Math.round(result.accuracy * 100)}%`, 20, 118);
    doc.text(`最高连击: x${result.maxCombo}`, 20, 131);
    doc.text(`正确分类: ${result.correctCount}个`, 20, 144);
    doc.text(`错误分类: ${result.wrongCount}个`, 20, 157);
    doc.text(`漏分拣: ${result.missedCount}个`, 20, 170);
    
    doc.setFontSize(14);
    doc.setTextColor(isPassed ? 34 : 239, isPassed ? 197 : 68, isPassed ? 94 : 68);
    doc.text(isPassed ? '✓ 关卡通过!' : '✗ 未通过，再接再厉!', 105, 195, { align: 'center' });
    
    if (result.errors.length > 0) {
      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(0);
      doc.text('错误详情', 20, 30);
      
      result.errors.slice(0, 15).forEach((error, index) => {
        const y = 45 + index * 12;
        const correctBin = getCategoryBin(error.correctCategory);
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text(`${index + 1}. ${error.item.name} (${error.item.emoji})`, 20, y);
        doc.setTextColor(100);
        doc.text(`正确: ${correctBin?.name || error.correctCategory}`, 80, y);
        if (error.wrongCategory) {
          const wrongBin = getCategoryBin(error.wrongCategory);
          doc.text(`错误: ${wrongBin?.name || error.wrongCategory}`, 130, y);
        }
        doc.text(getErrorTypeLabel(error.type), 180, y);
      });
    }
    
    doc.save(`分拣报告_${result.level.name}_${new Date().toLocaleDateString('zh-CN')}.pdf`);
  };

  const handleRestart = () => {
    startGame(currentLevel);
    navigate('/game');
  };

  const handleHome = () => {
    resetGame();
    navigate('/');
  };

  const selectedError = selectedErrorIndex !== null ? result.errors[selectedErrorIndex] : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-8xl mb-4">
            {isPassed ? '🎉' : '💪'}
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">
            {isPassed ? '关卡通过!' : '继续加油!'}
          </h1>
          <p className="text-slate-400 text-lg">{currentLevel.name}</p>
          
          <div className="flex justify-center gap-2 mt-4">
            {[1, 2, 3].map((star) => (
              <span
                key={star}
                className={`text-4xl transition-all duration-500 ${
                  star <= stars ? 'text-yellow-400 scale-110' : 'text-slate-600'
                }`}
                style={{ animationDelay: `${star * 0.2}s` }}
              >
                ★
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800/50 rounded-2xl p-5 text-center border border-slate-700">
            <Trophy className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <div className="text-3xl font-bold text-white">{result.score}</div>
            <div className="text-slate-400 text-sm">最终得分</div>
          </div>
          <div className="bg-slate-800/50 rounded-2xl p-5 text-center border border-slate-700">
            <Target className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <div className="text-3xl font-bold text-white">{Math.round(result.accuracy * 100)}%</div>
            <div className="text-slate-400 text-sm">正确率</div>
          </div>
          <div className="bg-slate-800/50 rounded-2xl p-5 text-center border border-slate-700">
            <Flame className="w-8 h-8 text-orange-400 mx-auto mb-2" />
            <div className="text-3xl font-bold text-white">x{result.maxCombo}</div>
            <div className="text-slate-400 text-sm">最高连击</div>
          </div>
          <div className="bg-slate-800/50 rounded-2xl p-5 text-center border border-slate-700">
            <Clock className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <div className="text-3xl font-bold text-white">{result.duration}s</div>
            <div className="text-slate-400 text-sm">用时</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-green-900/30 rounded-xl p-4 text-center border border-green-700/50">
            <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-1" />
            <div className="text-2xl font-bold text-green-400">{result.correctCount}</div>
            <div className="text-green-300 text-sm">正确分类</div>
          </div>
          <div className="bg-yellow-900/30 rounded-xl p-4 text-center border border-yellow-700/50">
            <XCircle className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
            <div className="text-2xl font-bold text-yellow-400">{result.wrongCount}</div>
            <div className="text-yellow-300 text-sm">错误分类</div>
          </div>
          <div className="bg-orange-900/30 rounded-xl p-4 text-center border border-orange-700/50">
            <XCircle className="w-6 h-6 text-orange-400 mx-auto mb-1" />
            <div className="text-2xl font-bold text-orange-400">{result.missedCount}</div>
            <div className="text-orange-300 text-sm">漏分拣</div>
          </div>
        </div>

        {result.errors.length > 0 && (
          <div className="bg-slate-800/50 rounded-2xl p-6 mb-8 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-400" />
              错误记录 ({result.errors.length})
            </h2>
            
            {selectedError && (
              <div className="bg-slate-900/80 rounded-xl p-6 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`text-6xl ${isReplaying ? 'animate-bounce' : ''}`}>
                    {selectedError.item.emoji}
                  </div>
                  <div>
                    <div className="text-xl font-bold text-white">{selectedError.item.name}</div>
                    <div className={`${getErrorTypeColor(selectedError.type)} text-sm`}>
                      {getErrorTypeLabel(selectedError.type)}
                    </div>
                    <div className="text-slate-400 text-sm mt-1">
                      正确分类: <span className="text-green-400">{getCategoryBin(selectedError.correctCategory)?.name}</span>
                      {selectedError.wrongCategory && (
                        <> | 错误分类: <span className="text-red-400">{getCategoryBin(selectedError.wrongCategory)?.name}</span></>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => selectedErrorIndex !== null && setSelectedErrorIndex(Math.max(0, selectedErrorIndex - 1))}
                    disabled={selectedErrorIndex === 0}
                    className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-white"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleReplayError(selectedErrorIndex!)}
                    className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white"
                  >
                    <Play className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => selectedErrorIndex !== null && setSelectedErrorIndex(Math.min(result.errors.length - 1, selectedErrorIndex + 1))}
                    disabled={selectedErrorIndex === result.errors.length - 1}
                    className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-white"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-48 overflow-y-auto">
              {result.errors.map((error, index) => (
                <div
                  key={error.id}
                  onClick={() => handleReplayError(index)}
                  className={`p-3 rounded-xl cursor-pointer transition-all ${
                    selectedErrorIndex === index
                      ? 'bg-blue-600/30 ring-2 ring-blue-500'
                      : 'bg-slate-700/50 hover:bg-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{error.item.emoji}</span>
                    <span className="text-white text-sm font-medium truncate">{error.item.name}</span>
                  </div>
                  <div className={`text-xs ${getErrorTypeColor(error.type)}`}>
                    {getErrorTypeLabel(error.type)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-center gap-4">
          <button
            onClick={handleHome}
            className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-colors"
          >
            <Home className="w-5 h-5" />
            返回主页
          </button>
          <button
            onClick={handleRestart}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            再玩一次
          </button>
          <button
            onClick={handleExportReport}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors"
          >
            <Download className="w-5 h-5" />
            导出报告
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultScreen;
