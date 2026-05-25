import { useState } from 'react';
import { Trophy, XCircle, RotateCcw, ArrowRight, Download, History, Home } from 'lucide-react';
import type { SettlementResult, Grade } from '../types/game';
import { getScoreBreakdown } from '../utils/rules/scoreCalculator';
import { StarRating } from './StarRating';

interface SettlementPanelProps {
  result: SettlementResult;
  levelName: string;
  timeUsed: number;
  hasNextLevel: boolean;
  onRestart: () => void;
  onNextLevel: () => void;
  onBackToMenu: () => void;
  onViewHistory: () => void;
  onExportJSON: () => void;
  onExportText: () => void;
}

const gradeInfo: Record<Grade, { label: string; color: string; stars: number }> = {
  S: { label: 'S级 - 完美', color: 'text-yellow-500', stars: 5 },
  A: { label: 'A级 - 优秀', color: 'text-green-500', stars: 4 },
  B: { label: 'B级 - 良好', color: 'text-blue-500', stars: 3 },
  C: { label: 'C级 - 及格', color: 'text-orange-500', stars: 2 },
  F: { label: 'F级 - 失败', color: 'text-red-500', stars: 0 },
};

export const SettlementPanel = ({
  result,
  levelName,
  timeUsed,
  hasNextLevel,
  onRestart,
  onNextLevel,
  onBackToMenu,
  onViewHistory,
  onExportJSON,
  onExportText,
}: SettlementPanelProps) => {
  const [showDetails, setShowDetails] = useState(false);
  const info = gradeInfo[result.grade];
  const scoreBreakdown = getScoreBreakdown(result);
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className={`p-6 ${result.isPassed ? 'bg-gradient-to-br from-green-50 to-blue-50' : 'bg-gradient-to-br from-red-50 to-orange-50'} rounded-t-2xl`}>
          <div className="text-center">
            <div className="mb-4">
              {result.isPassed ? (
                <Trophy size={64} className="mx-auto text-yellow-500" />
              ) : (
                <XCircle size={64} className="mx-auto text-red-500" />
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {result.isPassed ? '恭喜通过！' : '挑战失败'}
            </h2>
            <p className="text-gray-600 mb-4">{levelName}</p>
            
            <div className="flex justify-center mb-4">
              <StarRating rating={info.stars} size={32} />
            </div>
            
            <div className={`text-5xl font-bold mb-2 ${info.color}`}>
              {result.score}
            </div>
            <div className={`text-lg font-semibold ${info.color}`}>
              {info.label}
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-gray-800">{(result.spaceUtilization * 100).toFixed(1)}%</div>
              <div className="text-xs text-gray-500">空间利用率</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-gray-800">{result.totalWeight.toFixed(1)}</div>
              <div className="text-xs text-gray-500">总重量(kg)</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-gray-800">{formatTime(timeUsed)}</div>
              <div className="text-xs text-gray-500">用时</div>
            </div>
          </div>
          
          {result.fatalViolation && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                <XCircle size={18} /> 失败原因
              </h4>
              <p className="text-red-600 text-sm">{result.fatalViolation.description}</p>
            </div>
          )}
          
          {result.violations.length > 0 && (
            <div>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full text-left text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {showDetails ? '▼ 隐藏详情' : '▶ 查看评分明细'}
              </button>
              
              {showDetails && (
                <div className="mt-3 space-y-2">
                  {scoreBreakdown.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{item.name}</span>
                      <span className={`font-medium ${item.score >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {item.score >= 0 ? '+' : ''}{item.score}
                      </span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2 flex items-center justify-between font-bold">
                    <span>总分</span>
                    <span className={info.color}>{result.score}</span>
                  </div>
                  
                  {result.violations.length > 0 && (
                    <div className="mt-4 border-t pt-4">
                      <h4 className="font-semibold text-gray-700 mb-2">违规记录</h4>
                      {result.violations.map((v, i) => (
                        <div
                          key={v.id}
                          className={`text-sm p-2 rounded mb-1 ${v.isFatal ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'}`}
                        >
                          <span className="font-medium">{v.isFatal ? '[致命] ' : ''}</span>
                          {v.description}
                          <span className="float-right font-bold">{v.penalty}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          <div className="flex gap-2 pt-2">
            <button
              onClick={onExportText}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Download size={16} /> TXT
            </button>
            <button
              onClick={onExportJSON}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Download size={16} /> JSON
            </button>
            <button
              onClick={onViewHistory}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <History size={16} /> 历史
            </button>
          </div>
          
          <div className="flex gap-2 pt-2">
            <button
              onClick={onBackToMenu}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              <Home size={18} /> 返回菜单
            </button>
            <button
              onClick={onRestart}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              <RotateCcw size={18} /> 重玩
            </button>
            {result.isPassed && hasNextLevel && (
              <button
                onClick={onNextLevel}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                下一关 <ArrowRight size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
