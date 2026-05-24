import React, { useState } from 'react';
import {
  BarChart3,
  AlertTriangle,
  Download,
  TrendingUp,
  Users,
  Clock,
  GitCompare,
  Save,
  Trash2,
  X
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend as RechartsLegend
} from 'recharts';
import { useSimulationStore } from '../../store/useSimulationStore';
import { generatePDFReport, downloadJSONReport } from '../../utils/reportGenerator';

export const StatsPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'bottlenecks' | 'compare' | 'export'>('overview');
  const [strategyName, setStrategyName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const {
    selectedScene,
    statistics,
    currentTime,
    strategyResults,
    saveStrategyResult,
    removeStrategyResult,
    clearStrategyResults
  } = useSimulationStore();

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

  const handleSaveStrategy = () => {
    if (!strategyName.trim()) return;
    saveStrategyResult(strategyName.trim());
    setStrategyName('');
    setShowSaveDialog(false);
  };

  if (!selectedScene) return null;

  const completionRate = (statistics.completionRate * 100).toFixed(1);
  const chartData = statistics.timeSeriesData.slice(-50);

  const comparisonData = strategyResults.map((result, index) => ({
    name: result.name,
    完成率: Number((result.statistics.completionRate * 100).toFixed(1)),
    平均时间: Number(result.statistics.avgEvacuationTime.toFixed(1)),
    瓶颈数: result.statistics.bottleneckRanking.length,
    index
  }));

  return (
    <div className="absolute right-4 top-16 z-10 w-80">
      <div className="bg-slate-800/95 backdrop-blur-sm rounded-lg shadow-xl border border-slate-700 overflow-hidden">
        <div className="flex border-b border-slate-700">
          {[
            { id: 'overview', label: '概览', icon: BarChart3 },
            { id: 'bottlenecks', label: '瓶颈', icon: AlertTriangle },
            { id: 'compare', label: '对比', icon: GitCompare },
            { id: 'export', label: '导出', icon: Download }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'overview' | 'bottlenecks' | 'compare' | 'export')}
              className={`flex-1 flex items-center justify-center gap-1 py-3 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-slate-700 text-blue-400 border-b-2 border-blue-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="p-3 max-h-96 overflow-y-auto">
          {activeTab === 'overview' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-700/50 rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                    <Users className="w-3.5 h-3.5" />
                    总人数
                  </div>
                  <div className="text-xl font-bold text-white">
                    {statistics.totalPassengers}
                  </div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    完成率
                  </div>
                  <div className="text-xl font-bold text-green-400">
                    {completionRate}%
                  </div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                    <Clock className="w-3.5 h-3.5" />
                    平均时间
                  </div>
                  <div className="text-xl font-bold text-blue-400">
                    {statistics.avgEvacuationTime.toFixed(1)}s
                  </div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    最长等待
                  </div>
                  <div className="text-xl font-bold text-yellow-400">
                    {statistics.maxWaitTime.toFixed(1)}s
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-green-500/10 border border-green-500/30 rounded p-2 text-center">
                  <div className="text-lg font-bold text-green-400">{statistics.exitedCount}</div>
                  <div className="text-xs text-slate-400">已疏散</div>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 text-center">
                  <div className="text-lg font-bold text-yellow-400">{statistics.waitingCount}</div>
                  <div className="text-xs text-slate-400">等待中</div>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded p-2 text-center">
                  <div className="text-lg font-bold text-red-400">{statistics.stuckCount}</div>
                  <div className="text-xs text-slate-400">滞留</div>
                </div>
              </div>

              {chartData.length > 1 && (
                <div className="bg-slate-700/30 rounded-lg p-2.5">
                  <h4 className="text-xs font-medium text-slate-300 mb-2">疏散趋势</h4>
                  <ResponsiveContainer width="100%" height={100}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={9} />
                      <YAxis stroke="#64748b" fontSize={9} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          fontSize: '12px'
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
            <div className="space-y-2">
              {statistics.bottleneckRanking.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">当前未检测到瓶颈区域</p>
                </div>
              ) : (
                statistics.bottleneckRanking.map((bn, index) => (
                  <div
                    key={bn.id}
                    className="bg-slate-700/50 rounded-lg p-2.5 border-l-4"
                    style={{
                      borderLeftColor:
                        bn.severity === 'high'
                          ? '#ef4444'
                          : bn.severity === 'medium'
                          ? '#f59e0b'
                          : '#fbbf24'
                    }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-white">
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
                    <div className="grid grid-cols-2 gap-2 text-xs">
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

          {activeTab === 'compare' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-slate-300">策略对比</h4>
                <button
                  onClick={() => setShowSaveDialog(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  保存当前
                </button>
              </div>

              {showSaveDialog && (
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">保存策略结果</span>
                    <button
                      onClick={() => setShowSaveDialog(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="输入策略名称..."
                    value={strategyName}
                    onChange={(e) => setStrategyName(e.target.value)}
                    className="w-full bg-slate-600 border border-slate-500 rounded px-2.5 py-1.5 text-white text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveStrategy}
                      disabled={!strategyName.trim()}
                      className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded text-xs transition-colors"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setShowSaveDialog(false)}
                      className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded text-xs transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}

              {strategyResults.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <GitCompare className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">保存多个策略结果进行对比</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {strategyResults.map((result) => (
                      <div
                        key={result.id}
                        className="bg-slate-700/50 rounded-lg p-2.5"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-white">{result.name}</span>
                          <button
                            onClick={() => removeStrategyResult(result.id)}
                            className="p-1 text-red-400 hover:bg-red-500/20 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-xs">
                          <div>
                            <span className="text-slate-500">完成:</span>
                            <span className="text-green-400 ml-1">
                              {(result.statistics.completionRate * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">时间:</span>
                            <span className="text-blue-400 ml-1">
                              {result.statistics.avgEvacuationTime.toFixed(0)}s
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">瓶颈:</span>
                            <span className="text-yellow-400 ml-1">
                              {result.statistics.bottleneckRanking.length}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {strategyResults.length > 1 && (
                    <div className="bg-slate-700/30 rounded-lg p-2.5">
                      <h4 className="text-xs font-medium text-slate-300 mb-2">对比图表</h4>
                      <ResponsiveContainer width="100%" height={120}>
                        <BarChart data={comparisonData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={9} />
                          <YAxis stroke="#64748b" fontSize={9} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1e293b',
                              border: '1px solid #334155',
                              borderRadius: '6px',
                              fontSize: '12px'
                            }}
                          />
                          <RechartsLegend wrapperStyle={{ fontSize: '10px' }} />
                          <Bar dataKey="完成率" fill="#22c55e" name="完成率(%)" />
                          <Bar dataKey="平均时间" fill="#3b82f6" name="平均时间(s)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <button
                    onClick={clearStrategyResults}
                    className="w-full text-xs text-slate-400 hover:text-red-400 transition-colors py-1"
                  >
                    清空所有对比结果
                  </button>
                </>
              )}
            </div>
          )}

          {activeTab === 'export' && (
            <div className="space-y-3">
              <div className="bg-slate-700/30 rounded-lg p-3">
                <h4 className="text-sm font-medium text-white mb-1">当前场景</h4>
                <p className="text-slate-300 text-xs">{selectedScene.name}</p>
                <p className="text-slate-400 text-xs mt-1">{selectedScene.description}</p>
              </div>

              <div className="bg-slate-700/30 rounded-lg p-3">
                <h4 className="text-sm font-medium text-white mb-2.5">导出报告</h4>
                <div className="space-y-2">
                  <button
                    onClick={handleExportPDF}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium text-sm"
                  >
                    <Download className="w-4 h-4" />
                    导出 PDF 报告
                  </button>
                  <button
                    onClick={handleExportJSON}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-md transition-colors font-medium text-sm"
                  >
                    <Download className="w-4 h-4" />
                    导出 JSON 数据
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-500">
                <p className="font-medium mb-1.5">报告包含:</p>
                <ul className="list-disc list-inside space-y-0.5">
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
