import React from 'react';
import { X, GitCompare, Clock, Users, AlertTriangle, CheckCircle } from 'lucide-react';
import { useSimulationStore } from '@/store/simulationStore';

const CompareModal: React.FC = () => {
  const showCompare = useSimulationStore(state => state.showCompare);
  const setShowCompare = useSimulationStore(state => state.setShowCompare);
  const compareResults = useSimulationStore(state => state.compareResults);
  const setSelectedPlan = useSimulationStore(state => state.setSelectedPlan);
  
  if (!showCompare) return null;
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}分${secs}秒`;
  };
  
  const getScore = (result: typeof compareResults[0]): number => {
    let score = 100;
    score -= result.totalTime / 3;
    score -= result.conflictCount * 10;
    score -= result.maxQueueLength * 0.5;
    return Math.max(0, score);
  };
  
  const sortedResults = [...compareResults].sort((a, b) => getScore(b) - getScore(a));
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-xl shadow-2xl w-[900px] max-h-[85vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-white font-semibold text-lg flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-purple-400" />
            方案对比分析
          </h2>
          <button
            onClick={() => setShowCompare(false)}
            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        
        <div className="overflow-x-auto p-4">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-slate-400 text-sm font-medium py-3 px-4">排名</th>
                <th className="text-left text-slate-400 text-sm font-medium py-3 px-4">方案名称</th>
                <th className="text-center text-slate-400 text-sm font-medium py-3 px-4">
                  <Clock className="w-4 h-4 inline mr-1" />
                  总用时
                </th>
                <th className="text-center text-slate-400 text-sm font-medium py-3 px-4">
                  <Clock className="w-4 h-4 inline mr-1" />
                  平均用时
                </th>
                <th className="text-center text-slate-400 text-sm font-medium py-3 px-4">
                  <Users className="w-4 h-4 inline mr-1" />
                  已疏散
                </th>
                <th className="text-center text-slate-400 text-sm font-medium py-3 px-4">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  冲突数
                </th>
                <th className="text-center text-slate-400 text-sm font-medium py-3 px-4">
                  最大排队
                </th>
                <th className="text-center text-slate-400 text-sm font-medium py-3 px-4">
                  <CheckCircle className="w-4 h-4 inline mr-1" />
                  评分
                </th>
                <th className="text-center text-slate-400 text-sm font-medium py-3 px-4">操作</th>
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((result, idx) => {
                const score = getScore(result);
                const isBest = idx === 0;
                
                return (
                  <tr 
                    key={result.planId}
                    className={`border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors ${
                      isBest ? 'bg-green-500/10' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-sm font-bold ${
                        idx === 0 ? 'bg-yellow-500 text-black' :
                        idx === 1 ? 'bg-slate-400 text-black' :
                        idx === 2 ? 'bg-amber-700 text-white' :
                        'bg-slate-700 text-slate-300'
                      }`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{result.planName}</span>
                        {isBest && (
                          <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded-full font-medium">
                            最优
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-300">
                      {formatTime(result.totalTime)}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-300">
                      {formatTime(result.avgEvacuationTime)}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-300">
                      {result.evacuatedStudents}人
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        result.conflictCount === 0 ? 'bg-green-500/20 text-green-400' :
                        result.conflictCount <= 2 ? 'bg-amber-500/20 text-amber-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {result.conflictCount}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-300">
                      {result.maxQueueLength}人
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${
                              score >= 80 ? 'bg-green-500' :
                              score >= 60 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <span className={`text-sm font-medium ${
                          score >= 80 ? 'text-green-400' :
                          score >= 60 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {score.toFixed(0)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => {
                          setSelectedPlan(result.planId);
                          setShowCompare(false);
                        }}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                      >
                        切换
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 border-t border-slate-700 bg-slate-800/50">
          <div className="text-sm text-slate-400">
            <p className="mb-1">💡 <strong className="text-slate-300">评分说明：</strong></p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li>基础分100分，根据各项指标扣除</li>
              <li>总用时越短、冲突越少、排队越短，评分越高</li>
              <li>建议选择评分最高的方案作为实际演练方案</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompareModal;
