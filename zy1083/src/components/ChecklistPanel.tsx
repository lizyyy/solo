import React, { useState, useMemo } from 'react';
import { useApp, useShortlist } from '../context/AppContext';
import { FollowUpItem, ShortlistItem } from '../types';
import { calculateMonthlyHiddenCost, calculateCommuteTimeCost } from '../utils/scoring';

const ChecklistPanel: React.FC = () => {
  const { state, dispatch } = useApp();
  const { shortlist, addToShortlist, removeFromShortlist, updateShortlistItem } = useShortlist();
  const [selectedHouseId, setSelectedHouseId] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState('');

  const sortedShortlist = useMemo(() => {
    const priorityOrder: Record<string, number> = { '高': 0, '中': 1, '低': 2 };
    return [...shortlist].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }, [shortlist]);

  const selectedItem = useMemo(() => {
    return shortlist.find((s) => s.houseId === selectedHouseId);
  }, [shortlist, selectedHouseId]);

  const housesNotInShortlist = useMemo(() => {
    const shortlistIds = new Set(shortlist.map((s) => s.houseId));
    return state.scoredHouses.filter((h) => !shortlistIds.has(h.id));
  }, [state.scoredHouses, shortlist]);

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

  const addFollowUpQuestion = () => {
    if (!selectedHouseId || !newQuestion.trim()) return;

    const newFollowUp: FollowUpItem = {
      id: `followup_${Date.now()}`,
      houseId: selectedHouseId,
      question: newQuestion.trim(),
      status: '待确认',
      answer: '',
      updatedAt: new Date().toISOString(),
    };

    dispatch({ type: 'ADD_FOLLOW_UP', payload: newFollowUp });
    setNewQuestion('');
  };

  const updateFollowUpStatus = (followUp: FollowUpItem, status: FollowUpItem['status']) => {
    dispatch({
      type: 'UPDATE_FOLLOW_UP',
      payload: { ...followUp, status, updatedAt: new Date().toISOString() },
    });
  };

  const updateFollowUpAnswer = (followUp: FollowUpItem, answer: string) => {
    dispatch({
      type: 'UPDATE_FOLLOW_UP',
      payload: { ...followUp, answer, updatedAt: new Date().toISOString() },
    });
  };

  const deleteFollowUp = (houseId: string, followUpId: string) => {
    dispatch({ type: 'DELETE_FOLLOW_UP', payload: { houseId, followUpId } });
  };

  const essentialQuestions = [
    '物业费、取暖费等杂费由谁承担？',
    '退租时押金退还的具体条件是什么？',
    '房东口头承诺的内容是否写入合同？',
    '合同到期后续租租金是否会涨？涨幅多少？',
    '是否允许转租？转租需要什么条件？',
    '房屋维修责任如何划分？哪些由房东承担？',
    '提前解约需要支付多少违约金？',
    '水电燃气的计费标准是什么？是否为民用？',
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">签约前核对区</h1>
          <p className="text-gray-500 mt-1">
            管理您的短名单，记录待确认问题，避免签约后踩坑
          </p>
        </div>
        <div className="text-sm text-gray-500">
          短名单: <span className="font-semibold text-gray-900">{shortlist.length}</span> 套
        </div>
      </div>

      {shortlist.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 mb-4">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">暂无短名单</h3>
          <p className="text-gray-500 mb-6">
            从房源列表中选择感兴趣的房源加入短名单，以便进行签约前的仔细核对
          </p>
          {housesNotInShortlist.length > 0 && (
            <div className="mt-6">
              <p className="text-sm text-gray-500 mb-3">快速添加到短名单:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {housesNotInShortlist.slice(0, 5).map((house) => (
                  <button
                    key={house.id}
                    onClick={() => addToShortlist(house.id, '中')}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    + {house.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">短名单 ({shortlist.length})</h3>
              <div className="space-y-2">
                {sortedShortlist.map((item) => {
                  if (!item.house) return null;
                  
                  return (
                    <div
                      key={item.houseId}
                      onClick={() => setSelectedHouseId(item.houseId)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedHouseId === item.houseId
                          ? 'bg-blue-50 border-blue-300'
                          : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {item.house.name}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          item.priority === '高' ? 'bg-red-100 text-red-700' :
                          item.priority === '中' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {item.priority}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>¥{item.house.monthlyRent.toLocaleString()}/月</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${getGradeColor(item.house.overallGrade)}`}>
                          {item.house.overallScore.toFixed(1)}分
                        </span>
                      </div>
                      {item.followUps.length > 0 && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                          <span>
                            {item.followUps.filter((f) => f.status === '待确认').length} 个待确认
                          </span>
                          <span>·</span>
                          <span>
                            {item.followUps.filter((f) => f.status === '已确认').length} 个已确认
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {housesNotInShortlist.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">可添加的房源</h3>
                <div className="space-y-2">
                  {housesNotInShortlist.slice(0, 5).map((house) => (
                    <div
                      key={house.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{house.name}</p>
                        <p className="text-xs text-gray-500">
                          ¥{house.monthlyRent.toLocaleString()} · {house.overallScore.toFixed(1)}分
                        </p>
                      </div>
                      <button
                        onClick={() => addToShortlist(house.id, '中')}
                        className="ml-2 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        + 添加
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            {selectedItem && selectedItem.house ? (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-gray-900">{selectedItem.house.name}</h2>
                        <span className={`px-2 py-0.5 rounded text-sm font-medium ${getGradeColor(selectedItem.house.overallGrade)}`}>
                          {getGradeText(selectedItem.house.overallGrade)} · {selectedItem.house.overallScore.toFixed(1)}分
                        </span>
                      </div>
                      <p className="text-gray-500 mt-1">{selectedItem.house.address}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedItem.priority}
                        onChange={(e) =>
                          updateShortlistItem({
                            houseId: selectedItem.houseId,
                            priority: e.target.value as '高' | '中' | '低',
                          })
                        }
                        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="高">高优先级</option>
                        <option value="中">中优先级</option>
                        <option value="低">低优先级</option>
                      </select>
                      <button
                        onClick={() => {
                          removeFromShortlist(selectedItem.houseId);
                          setSelectedHouseId(null);
                        }}
                        className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 border border-red-200 rounded-md transition-colors"
                      >
                        移出短名单
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">月租金</div>
                      <div className="text-lg font-semibold text-gray-900">
                        ¥{selectedItem.house.monthlyRent.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">通勤时间</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {selectedItem.house.commuteTime}分钟
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">面积</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {selectedItem.house.area}㎡
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">押金</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {selectedItem.house.depositType}
                      </div>
                    </div>
                  </div>
                </div>

                {selectedItem.house.riskFactors.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">主要风险点</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedItem.house.riskFactors.map((risk, idx) => (
                        <div
                          key={idx}
                          className={`p-4 rounded-lg border ${getRiskLevelColor(risk.level)}`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium">{risk.category}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              risk.level === '高' ? 'bg-red-200' :
                              risk.level === '中' ? 'bg-yellow-200' :
                              'bg-green-200'
                            }`}>
                              {risk.level}风险
                            </span>
                          </div>
                          <p className="text-sm">{risk.description}</p>
                          <p className="text-sm mt-2 opacity-80">💡 {risk.suggestion}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">待确认问题</h3>
                    <span className="text-sm text-gray-500">
                      {selectedItem.followUps.filter((f) => f.status === '待确认').length} 个待确认 / 共 {selectedItem.followUps.length}
                    </span>
                  </div>

                  <div className="flex gap-2 mb-6">
                    <input
                      type="text"
                      value={newQuestion}
                      onChange={(e) => setNewQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addFollowUpQuestion();
                      }}
                      placeholder="输入需要确认的问题..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={addFollowUpQuestion}
                      disabled={!newQuestion.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      添加
                    </button>
                  </div>

                  <div className="mb-6">
                    <p className="text-sm text-gray-500 mb-2">快速添加常用问题:</p>
                    <div className="flex flex-wrap gap-2">
                      {essentialQuestions.map((q, idx) => (
                        <button
                          key={idx}
                          onClick={() => setNewQuestion(q)}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        >
                          + {q}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedItem.followUps.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>暂无待确认问题</p>
                      <p className="text-sm mt-1">添加问题以便签约前逐一确认</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedItem.followUps.map((followUp) => (
                        <div
                          key={followUp.id}
                          className={`p-4 rounded-lg border ${
                            followUp.status === '已确认'
                              ? 'bg-green-50 border-green-200'
                              : followUp.status === '放弃'
                              ? 'bg-gray-50 border-gray-200'
                              : 'bg-yellow-50 border-yellow-200'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-2 flex-1">
                              <span className={`mt-0.5 text-lg ${
                                followUp.status === '待确认' ? 'text-yellow-500' :
                                followUp.status === '已确认' ? 'text-green-500' :
                                'text-gray-400'
                              }`}>
                                {followUp.status === '待确认' && '⏳'}
                                {followUp.status === '已确认' && '✅'}
                                {followUp.status === '放弃' && '❌'}
                              </span>
                              <div className="flex-1">
                                <p className={`font-medium ${
                                  followUp.status === '放弃' ? 'text-gray-400 line-through' : 'text-gray-900'
                                }`}>
                                  {followUp.question}
                                </p>
                                {followUp.answer && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    <span className="font-medium">回答:</span> {followUp.answer}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 ml-4">
                              <select
                                value={followUp.status}
                                onChange={(e) =>
                                  updateFollowUpStatus(followUp, e.target.value as FollowUpItem['status'])
                                }
                                className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="待确认">待确认</option>
                                <option value="已确认">已确认</option>
                                <option value="放弃">放弃</option>
                              </select>
                              <button
                                onClick={() => deleteFollowUp(selectedItem.houseId, followUp.id)}
                                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {followUp.status === '已确认' && (
                            <div className="mt-2 ml-7">
                              <input
                                type="text"
                                value={followUp.answer}
                                onChange={(e) => updateFollowUpAnswer(followUp, e.target.value)}
                                placeholder="记录确认结果..."
                                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">备注</h3>
                  <textarea
                    value={selectedItem.notes}
                    onChange={(e) =>
                      updateShortlistItem({ houseId: selectedItem.houseId, notes: e.target.value })
                    }
                    placeholder="记录关于这套房的想法、对比其他房源的优缺点、签约前的最后提醒等..."
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <p className="text-gray-500">点击左侧短名单中的房源查看详情</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChecklistPanel;
