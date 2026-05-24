import React, { useState } from 'react';
import { BarChart3, AlertTriangle, Download, TrendingUp, Users, Clock, ChevronDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useSimulationStore } from '../../store/useSimulationStore';
import { generatePDFReport, downloadJSONReport } from '../../utils/reportGenerator';

export const StatsPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'bottlenecks' | 'export'>('overview');
  const { selectedScene, statistics, currentTime } = useSimulationStore();

  const handleExportPDF = async () => {
    if (!selectedScene) return;
    await generatePDFReport({
      sceneName: selectedScene.name,
      sceneDescription: selectedScene.description,
      statistics,
      timestamp: new Date(),
      simulationDuration: currentTime
    });
  };

  const handleExportJSON = () => {
    if (!selectedScene) return;
    downloadJSONReport({
      sceneName: selectedScene.name,
      sceneDescription: selectedScene.description,
      statistics,
      timestamp: new Date(),
      simulationDuration: currentTime
    });
  };

  if (!selectedScene) return null;

  const completionRate = (statistics.completionRate * 100).toFixed(1);
  const chartData = statistics.timeSeriesData.slice(-50);

  return (
    <div className="absolute right-4 top-4 z-10 w-80">
      <div className="bg-slate-800/95 backdrop-blur-sm rounded-lg shadow-xl border border-slate-700 overflow-hidden">
        <div className="flex border-b border-slate-700">
          {[
            { id: 'overview', label: '概览', icon: BarChart3 },
            { id: 'bottlenecks', label: '瓶颈', icon: AlertTriangle },
            { id: 'export', label: '导出', icon: Download }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-slate-700 text-blue-400 border-b-2 border-blue-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 max-h-96 overflow-y-auto">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                    <Users className="w-4 h-4" />
                    总人数
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {statistics.totalPassengers}
                  </div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                    <TrendingUp className="w-4 h-4" />
                    完成率
                  </div>
                  <div className="text-2xl font-bold text-green-400">
                    {completionRate}%
                  </div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                    <Clock className="w-4 h-4" />
                    平均时间
                  </div>
                  <div className="text-2xl font-bold text-blue-400">
                    {statistics.avgEvacuationTime.toFixed(1)}s
                  </div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    最长等待
                  </div>
                  <div className="text-2xl font-bold text-yellow-400">
                    {statistics.maxWaitTime.toFixed(1)}s
                  </div>
                </div>
              </div>

              {chartData.length > 1 && (
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-slate-300 mb-2">疏散趋势</h4>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={10} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '6px'
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="exitedCount"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={false}
                        name="已疏散"
                      />
                      <Line
                        type="monotone"
                        dataKey="waitingCount"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                        name="等待中"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {activeTab === 'bottlenecks' && (
            <div className="space-y-3">
              {statistics.bottleneckRanking.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>当前未检测到瓶颈区域</p>
                </div>
              ) : (
                statistics.bottleneckRanking.map((bn, index) => (
                  <div
                    key={bn.id}
                    className="bg-slate-700/50 rounded-lg p-3 border-l-4"
                    style={{
                      borderLeftColor:
                        bn.severity === 'high'
                          ? '#ef4444'
                          : bn.severity === 'medium'
                          ? '#f59e0b'
                          : '#fbbf24'
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-white">
                        #{index + 1} {bn.type === 'stair' ? '楼梯' : bn.type === 'gate' ? '闸机' : '通道'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          bn.severity === 'high'
                            ? 'bg-red-500/20 text-red-400'
                            : bn.severity === 'medium'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-yellow-400/20 text-yellow-300'
                        }`}
                      >
                        {bn.severity === 'high' ? '严重' : bn.severity === 'medium' ? '中等' : '轻微'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-slate-400">排队人数:</span>
                        <span className="text-white ml-1">{bn.queueLength}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">平均等待:</span>
                        <span className="text-white ml-1">{bn.avgWaitTime.toFixed(1)}s</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="bg-slate-700/30 rounded-lg p-4">
                <h4 className="font-medium text-white mb-2">当前场景</h4>
                <p className="text-slate-300 text-sm">{selectedScene.name}</p>
                <p className="text-slate-400 text-xs mt-1">{selectedScene.description}</p>
              </div>

              <div className="bg-slate-700/30 rounded-lg p-4">
                <h4 className="font-medium text-white mb-3">导出报告</h4>
                <div className="space-y-2">
                  <button
                    onClick={handleExportPDF}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium"
                  >
                    <Download className="w-4 h-4" />
                    导出 PDF 报告
                  </button>
                  <button
                    onClick={handleExportJSON}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-600 hover:bg-slate-500 text-white rounded-md transition-colors font-medium"
                  >
                    <Download className="w-4 h-4" />
                    导出 JSON 数据
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-500">
                <p>报告包含:</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>场景基本信息</li>
                  <li>疏散统计数据</li>
                  <li>瓶颈分析排名</li>
                  <li>时间序列数据</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
