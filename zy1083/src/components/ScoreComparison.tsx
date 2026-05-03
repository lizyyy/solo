import React, { useState, useMemo } from 'react';
import { useApp, useShortlist, useWeights } from '../context/AppContext';
import { ScoredHouse } from '../types';
import { calculateMonthlyHiddenCost, calculateCommuteTimeCost } from '../utils/scoring';

const ScoreComparison: React.FC = () => {
  const { state } = useApp();
  const { addToShortlist, removeFromShortlist } = useShortlist();
  const [selectedHouse, setSelectedHouse] = useState<ScoredHouse | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'rent' | 'commute' | 'area'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const sortedHouses = useMemo(() => {
    const houses = [...state.scoredHouses];
    
    houses.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'score':
          comparison = a.overallScore - b.overallScore;
          break;
        case 'rent':
          comparison = a.monthlyRent - b.monthlyRent;
          break;
        case 'commute':
          comparison = a.commuteTime - b.commuteTime;
          break;
        case 'area':
          comparison = a.area - b.area;
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    return houses;
  }, [state.scoredHouses, sortBy, sortOrder]);

  const handleSort = (key: typeof sortBy) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('desc');
    }
  };

  const isInShortlist = (houseId: string) => {
    return state.shortlist.some((s) => s.houseId === houseId);
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'excellent': return 'bg-green-100 text-green-800';
      case 'good': return 'bg-blue-100 text-blue-800';
      case 'fair': return 'bg-yellow-100 text-yellow-800';
      case 'poor': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getGradeText = (grade: string) => {
    switch (grade) {
      case 'excellent': return '优秀';
      case 'good': return '良好';
      case 'fair': return '一般';
      case 'poor': return '较差';
      default: return grade;
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case '高': return 'bg-red-100 text-red-800 border-red-200';
      case '中': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case '低': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (state.scoredHouses.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">暂无房源数据</h2>
        <p className="text-gray-500">请先导入房源数据或加载示例数据</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">房源评分对比</h1>
          <p className="text-gray-500 mt-1">共 {state.scoredHouses.length} 套房源，按综合评分排序</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">排序:</span>
          {(['score', 'rent', 'commute', 'area'] as const).map((key) => (
            <button
              key={key}
              onClick={() => handleSort(key)}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                sortBy === key
                  ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {key === 'score' && '评分'}
              {key === 'rent' && '租金'}
              {key === 'commute' && '通勤'}
              {key === 'area' && '面积'}
              {sortBy === key && (
                <span className="ml-1">{sortOrder === 'desc' ? '↓' : '↑'}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {sortedHouses.map((house, index) => {
            const hiddenCost = calculateMonthlyHiddenCost(house);
            const commuteCost = calculateCommuteTimeCost(house);
            const inShortlist = isInShortlist(house.id);
            
            return (
              <div
                key={house.id}
                onClick={() => setSelectedHouse(house)}
                className={`bg-white rounded-xl shadow-sm border p-5 cursor-pointer transition-all hover:shadow-md ${
                  selectedHouse?.id === house.id
                    ? 'border-blue-500 ring-2 ring-blue-100'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-gray-100 text-gray-600' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-50 text-gray-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900">{house.name}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getGradeColor(house.overallGrade)}`}>
                          {getGradeText(house.overallGrade)}
                        </span>
                        {inShortlist && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                            短名单
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{house.address}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      {house.overallScore.toFixed(1)}
                      <span className="text-sm font-normal text-gray-400">分</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">月租金</div>
                    <div className="text-lg font-semibold text-gray-900">¥{house.monthlyRent.toLocaleString()}</div>
                    {hiddenCost > 0 && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        + ¥{hiddenCost.toFixed(0)} 隐性成本
                      </div>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">通勤时间</div>
                    <div className="text-lg font-semibold text-gray-900">{house.commuteTime}分钟</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      约 ¥{commuteCost.costPerMonth.toFixed(0)}/月
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">面积</div>
                    <div className="text-lg font-semibold text-gray-900">{house.area}㎡</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      单价 ¥{(house.monthlyRent / house.area).toFixed(0)}/㎡
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">押金</div>
                    <div className="text-lg font-semibold text-gray-900">{house.depositType}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      ¥{house.deposit.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-500">综合评分</span>
                    <span className="font-medium text-gray-900">{house.overallScore.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        house.overallScore >= 80 ? 'bg-green-500' :
                        house.overallScore >= 60 ? 'bg-blue-500' :
                        house.overallScore >= 40 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, house.overallScore)}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    {house.riskFactors.slice(0, 3).map((risk, idx) => (
                      <span
                        key={idx}
                        className={`px-2 py-1 rounded text-xs font-medium border ${getRiskLevelColor(risk.level)}`}
                      >
                        {risk.category}
                      </span>
                    ))}
                    {house.riskFactors.length > 3 && (
                      <span className="text-xs text-gray-500">
                        +{house.riskFactors.length - 3} 项
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (inShortlist) {
                        removeFromShortlist(house.id);
                      } else {
                        addToShortlist(house.id, '中');
                      }
                    }}
                    className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                      inShortlist
                        ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {inShortlist ? '从短名单移除' : '加入短名单'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          {selectedHouse ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sticky top-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{selectedHouse.name}</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">评分明细</h4>
                  <div className="space-y-2">
                    {[
                      { label: '月租金', score: selectedHouse.scores.monthlyRentScore, weight: state.ratingConfig.weights.monthlyRent },
                      { label: '押金风险', score: selectedHouse.scores.depositRiskScore, weight: state.ratingConfig.weights.depositRisk },
                      { label: '通勤时间', score: selectedHouse.scores.commuteTimeScore, weight: state.ratingConfig.weights.commuteTime },
                      { label: '采光', score: selectedHouse.scores.lightingScore, weight: state.ratingConfig.weights.lighting },
                      { label: '噪音', score: selectedHouse.scores.noiseScore, weight: state.ratingConfig.weights.noise },
                      { label: '漏水', score: selectedHouse.scores.waterLeakScore, weight: state.ratingConfig.weights.waterLeak },
                      { label: '异味', score: selectedHouse.scores.odorScore, weight: state.ratingConfig.weights.odor },
                      { label: '维修成本', score: selectedHouse.scores.repairCostScore, weight: state.ratingConfig.weights.repairCost },
                      { label: '周边安全', score: selectedHouse.scores.surroundingSafetyScore, weight: state.ratingConfig.weights.surroundingSafety },
                      { label: '中介费', score: selectedHouse.scores.agencyFeeScore, weight: state.ratingConfig.weights.agencyFee },
                      { label: '额外费用', score: selectedHouse.scores.additionalFeesScore, weight: state.ratingConfig.weights.additionalFees },
                    ].map((item, idx) => (
                      <div key={idx}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-600">{item.label}</span>
                          <span className="text-gray-500">
                            {item.score.toFixed(0)}分 (权重 {item.weight})
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              item.score >= 70 ? 'bg-green-500' :
                              item.score >= 40 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${item.score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedHouse.riskFactors.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">风险因素</h4>
                    <div className="space-y-2">
                      {selectedHouse.riskFactors.map((risk, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border ${getRiskLevelColor(risk.level)}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{risk.category}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              risk.level === '高' ? 'bg-red-200' :
                              risk.level === '中' ? 'bg-yellow-200' :
                              'bg-green-200'
                            }`}>
                              {risk.level}风险
                            </span>
                          </div>
                          <p className="text-xs">{risk.description}</p>
                          <p className="text-xs mt-1 opacity-80">💡 {risk.suggestion}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedHouse.notes && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">看房备注</h4>
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                      {selectedHouse.notes}
                    </p>
                  </div>
                )}

                {selectedHouse.visitNote?.pendingQuestions && selectedHouse.visitNote.pendingQuestions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">待确认问题</h4>
                    <div className="space-y-2">
                      {selectedHouse.visitNote.pendingQuestions.map((q, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          <span className={`mt-0.5 ${
                            q.status === '待确认' ? 'text-yellow-500' :
                            q.status === '已确认' ? 'text-green-500' :
                            'text-gray-400'
                          }`}>
                            {q.status === '待确认' && '⏳'}
                            {q.status === '已确认' && '✅'}
                            {q.status === '放弃' && '❌'}
                          </span>
                          <div>
                            <span className="text-gray-700">{q.question}</span>
                            <span className="text-gray-400 text-xs ml-1">({q.status})</span>
                            {q.answer && (
                              <p className="text-gray-500 text-xs mt-0.5">回答: {q.answer}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <p className="text-gray-500">点击房源卡片查看详细信息</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScoreComparison;
