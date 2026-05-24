import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Info, BarChart3, AlertTriangle, Download, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useSceneStore } from '../../store/useSceneStore';
import { getShowcaseStats } from '../../utils/dataValidator';

const RightPanel: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'stats' | 'anomalies'>('info');
  
  const hallData = useSceneStore((state) => state.hallData);
  const trajectories = useSceneStore((state) => state.trajectories);
  const anomalies = useSceneStore((state) => state.anomalies);
  const selectedShowcase = useSceneStore((state) => state.selectedShowcase);
  const currentTime = useSceneStore((state) => state.currentTime);

  if (!hallData) return null;

  const showcaseStats = getShowcaseStats(trajectories, hallData.showcases);
  const selectedShowcaseData = hallData.showcases.find((s) => s.id === selectedShowcase);
  const selectedShowcaseStat = showcaseStats.find((s) => s.showcaseId === selectedShowcase);

  const chartData = showcaseStats
    .filter((s) => s.visitorCount > 0)
    .map((stat) => {
      const showcase = hallData.showcases.find((s) => s.id === stat.showcaseId);
      return {
        name: showcase?.number || stat.showcaseId,
        访客数: stat.visitorCount,
        平均停留: Math.round(stat.avgDuration / 1000),
      };
    })
    .sort((a, b) => b.访客数 - a.访客数);

  const formatDuration = (ms: number): string => {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}秒`;
    return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
  };

  return (
    <div
      className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 transition-all duration-300 ${
        collapsed ? 'w-12' : 'w-80'
      }`}
    >
      <div className="bg-slate-900/95 backdrop-blur-md rounded-l-xl border border-r-0 border-slate-700/50 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-slate-700/50">
          {!collapsed && (
            <div className="flex gap-1">
              {(['info', 'stats', 'anomalies'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  {tab === 'info' && '信息'}
                  {tab === 'stats' && '统计'}
                  {tab === 'anomalies' && '异常'}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            {collapsed ? (
              <ChevronLeft className="w-4 h-4 text-white" />
            ) : (
              <ChevronRight className="w-4 h-4 text-white" />
            )}
          </button>
        </div>

        {!collapsed && (
          <div className="p-4 max-h-96 overflow-y-auto">
            {activeTab === 'info' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-slate-400 text-xs font-medium uppercase mb-2 flex items-center gap-2">
                    <Info className="w-3 h-3" />
                    展厅信息
                  </h4>
                  <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-sm">展厅名称</span>
                      <span className="text-white text-sm">{hallData.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-sm">展柜数量</span>
                      <span className="text-white text-sm">{hallData.showcases.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-sm">观众总数</span>
                      <span className="text-white text-sm">{trajectories.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-sm">当前时间</span>
                      <span className="text-cyan-400 text-sm font-mono">
                        {formatDuration(currentTime)}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedShowcaseData && (
                  <div>
                    <h4 className="text-slate-400 text-xs font-medium uppercase mb-2 flex items-center gap-2">
                      <FileText className="w-3 h-3" />
                      选中展柜
                    </h4>
                    <div className="bg-cyan-900/30 rounded-lg p-3 border border-cyan-600/30 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-sm">编号</span>
                        <span className="text-cyan-400 text-sm font-medium">
                          {selectedShowcaseData.number}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-sm">名称</span>
                        <span className="text-white text-sm">{selectedShowcaseData.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-sm">分类</span>
                        <span className="text-white text-sm">{selectedShowcaseData.category}</span>
                      </div>
                      {selectedShowcaseStat && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-400 text-sm">访客数</span>
                            <span className="text-white text-sm">{selectedShowcaseStat.visitorCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 text-sm">平均停留</span>
                            <span className="text-white text-sm">
                              {formatDuration(selectedShowcaseStat.avgDuration)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="space-y-4">
                <h4 className="text-slate-400 text-xs font-medium uppercase mb-2 flex items-center gap-2">
                  <BarChart3 className="w-3 h-3" />
                  展柜访客统计
                </h4>
                {chartData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} layout="vertical">
                        <XAxis type="number" stroke="#64748b" fontSize={10} />
                        <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={10} width={40} />
                        <Tooltip
                          contentStyle={{
                            background: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            color: '#fff',
                          }}
                        />
                        <Bar dataKey="访客数" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-slate-500 text-sm text-center py-8">
                    暂无统计数据
                  </div>
                )}
              </div>
            )}

            {activeTab === 'anomalies' && (
              <div className="space-y-3">
                <h4 className="text-slate-400 text-xs font-medium uppercase mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-3 h-3" />
                  异常检测报告
                </h4>
                {anomalies.length > 0 ? (
                  <div className="space-y-2">
                    {anomalies.map((anomaly, index) => (
                      <div
                        key={index}
                        className={`rounded-lg p-3 border ${
                          anomaly.severity === 'high'
                            ? 'bg-red-900/30 border-red-600/30'
                            : anomaly.severity === 'medium'
                            ? 'bg-orange-900/30 border-orange-600/30'
                            : 'bg-yellow-900/30 border-yellow-600/30'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded ${
                              anomaly.severity === 'high'
                                ? 'bg-red-600 text-white'
                                : anomaly.severity === 'medium'
                                ? 'bg-orange-600 text-white'
                                : 'bg-yellow-600 text-white'
                            }`}
                          >
                            {anomaly.severity.toUpperCase()}
                          </span>
                          <span className="text-xs text-slate-400">
                            {anomaly.type === 'trajectory_break' && '轨迹断点'}
                            {anomaly.type === 'showcase_mismatch' && '展柜错位'}
                            {anomaly.type === 'congestion_confusion' && '拥堵混淆'}
                          </span>
                        </div>
                        <p className="text-white text-sm">{anomaly.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500 text-sm text-center py-8">
                    未检测到异常
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RightPanel;
