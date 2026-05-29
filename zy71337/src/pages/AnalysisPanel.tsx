import React, { useState } from 'react';
import { useAppStore } from '@/store';
import PianoRoll from '@/components/PianoRoll';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const AnalysisPanel: React.FC = () => {
  const { queryNotes, querySegment, selectedResult } = useAppStore();
  const [activeTab, setActiveTab] = useState<'contour' | 'rhythm' | 'similarity'>('contour');

  const contourData = querySegment
    ? querySegment.pitches.map((pitch, i) => ({
        name: `N${i + 1}`,
        pitch: pitch - 60,
        relative: querySegment.contour.relative[i],
      }))
    : [];

  const rhythmData = querySegment
    ? querySegment.durations.map((dur, i) => ({
        name: `N${i + 1}`,
        duration: dur,
        normalized: querySegment.rhythm.normalized[i] * 10,
      }))
    : [];

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-slate-700">
        <h2 className="font-display text-xl font-bold text-white mb-1">分析面板</h2>
        <p className="text-sm text-slate-400">查看音高轮廓编码、节奏归一化过程和相似性计算详情</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">查询旋律</h3>
            {queryNotes.length > 0 ? (
              <PianoRoll
                notes={queryNotes}
                width={400}
                height={180}
                minPitch={55}
                maxPitch={75}
              />
            ) : (
              <div className="h-[180px] flex items-center justify-center text-slate-500 text-sm">
                请先在检索工作台输入旋律
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">选中匹配</h3>
            {selectedResult ? (
              <PianoRoll
                notes={selectedResult.targetSegment.notes}
                width={400}
                height={180}
                minPitch={55}
                maxPitch={75}
                highlightColor="#EC4899"
              />
            ) : (
              <div className="h-[180px] flex items-center justify-center text-slate-500 text-sm">
                请在检索结果中选择一条
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <div className="flex border-b border-slate-700">
            {(['contour', 'rhythm', 'similarity'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium transition-all ${
                  activeTab === tab
                    ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-500/5'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'contour' && '音高轮廓编码'}
                {tab === 'rhythm' && '节奏归一化'}
                {tab === 'similarity' && '相似性计算'}
              </button>
            ))}
          </div>

          <div className="p-4">
            {activeTab === 'contour' && (
              <div className="space-y-4">
                {querySegment ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="h-64">
                        <h4 className="text-xs text-slate-500 mb-2">音高序列</h4>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={contourData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 10 }} />
                            <YAxis tick={{ fill: '#64748B', fontSize: 10 }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#1E293B',
                                border: '1px solid #334155',
                                borderRadius: '8px',
                              }}
                            />
                            <Bar dataKey="pitch" fill="#3D6CB3" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="h-64">
                        <h4 className="text-xs text-slate-500 mb-2">相对音高轮廓</h4>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={contourData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 10 }} />
                            <YAxis tick={{ fill: '#64748B', fontSize: 10 }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#1E293B',
                                border: '1px solid #334155',
                                borderRadius: '8px',
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="relative"
                              stroke="#F59E0B"
                              strokeWidth={2}
                              dot={{ fill: '#F59E0B' }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-900/50 rounded-lg">
                      <h4 className="text-xs text-slate-500 mb-2">编码过程</h4>
                      <div className="text-sm text-slate-400 space-y-1">
                        {querySegment.contour.rawSequence.split('-').map((part, i) => (
                          <div key={i}>
                            <span className="text-amber-400">
                              {['相对音高', '方向', '音程'][i]}:
                            </span>{' '}
                            <code className="text-slate-300">{part}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-80 flex items-center justify-center text-slate-500">
                    暂无数据，请先执行检索
                  </div>
                )}
              </div>
            )}

            {activeTab === 'rhythm' && (
              <div className="space-y-4">
                {querySegment ? (
                  <>
                    <div className="h-64">
                      <h4 className="text-xs text-slate-500 mb-2">时长对比（原始 vs 归一化）</h4>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={rhythmData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 10 }} />
                          <YAxis tick={{ fill: '#64748B', fontSize: 10 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1E293B',
                              border: '1px solid #334155',
                              borderRadius: '8px',
                            }}
                          />
                          <Bar dataKey="duration" name="原始时长" fill="#3D6CB3" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="normalized" name="归一化" fill="#10B981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-900/50 rounded-lg">
                        <h4 className="text-xs text-slate-500 mb-2">节奏型</h4>
                        <code className="text-amber-400 text-lg">
                          {querySegment.rhythm.pattern || '-'}
                        </code>
                      </div>
                      <div className="p-4 bg-slate-900/50 rounded-lg">
                        <h4 className="text-xs text-slate-500 mb-2">平均时长系数</h4>
                        <div className="text-emerald-400 text-lg">
                          {querySegment.rhythm.stretchFactor.toFixed(3)}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-80 flex items-center justify-center text-slate-500">
                    暂无数据，请先执行检索
                  </div>
                )}
              </div>
            )}

            {activeTab === 'similarity' && (
              <div className="space-y-4">
                {selectedResult ? (
                  <>
                    <div className="p-4 bg-slate-900/50 rounded-lg">
                      <h4 className="text-xs text-slate-500 mb-3">DTW 匹配路径</h4>
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <div className="text-xs text-slate-400 space-y-1">
                            <div>
                              <span className="text-slate-500">DTW 距离:</span>{' '}
                              <span className="text-amber-400">
                                {selectedResult.scores.contour.details.distance.toFixed(2)}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">归一化得分:</span>{' '}
                              <span className="text-emerald-400">
                                {(selectedResult.scores.contour.normalized * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">路径点数:</span>{' '}
                              <span className="text-slate-300">
                                {selectedResult.scores.contour.details.path.length}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="w-40 h-40 bg-slate-800 rounded-lg flex items-center justify-center">
                          <span className="text-xs text-slate-500">路径矩阵</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-900/50 rounded-lg">
                      <h4 className="text-xs text-slate-500 mb-3">节奏编辑操作</h4>
                      <div className="text-xs text-slate-400 space-y-1 max-h-32 overflow-y-auto">
                        {selectedResult.scores.rhythm.details.operations.map((op, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-xs ${
                                op.includes('保持')
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : op.includes('替换')
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-rose-500/20 text-rose-400'
                              }`}
                            >
                              {op.split(':')[0]}
                            </span>
                            <span>{op.split(':')[1]}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        编辑距离: {selectedResult.scores.rhythm.details.distance}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-80 flex items-center justify-center text-slate-500">
                    请在检索结果中选择一条进行详细分析
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisPanel;
