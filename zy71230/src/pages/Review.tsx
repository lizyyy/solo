import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import {
  Trophy,
  XCircle,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  MapPin,
  BarChart3,
  Shield,
  Brain,
  RotateCcw,
  Download,
  ChevronRight,
  Clock,
  CheckCircle,
  X as XIcon,
  Lightbulb,
  Target,
  Zap,
} from 'lucide-react';
import { useReviewAnalysis } from '../hooks/useReviewAnalysis';
import { useGameEngine } from '../hooks/useGameEngine';
import NeonButton from '../components/ui/NeonButton';
import NeonCard from '../components/ui/NeonCard';
import RiskBadge from '../components/ui/RiskBadge';
import type { ReviewReport, AlternativePath } from '../types';

const TAB_COLORS = ['#e94560', '#00d4ff', '#9d4edd', '#ff9a3c', '#4ade80', '#ef4444', '#8b5cf6'];

const CHART_COLORS = ['#e94560', '#00d4ff', '#9d4edd', '#ff9a3c', '#4ade80', '#f59e0b', '#8b5cf6', '#ec4899'];

const tabs = [
  { id: 'financial', label: '财务总览', icon: DollarSign },
  { id: 'stops', label: '站点分析', icon: MapPin },
  { id: 'risks', label: '风险分析', icon: Shield },
  { id: 'decisions', label: '决策分析', icon: Brain },
  { id: 'playback', label: '失败回放', icon: RotateCcw },
  { id: 'recommendations', label: '改进建议', icon: Lightbulb },
];

function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getRatingColor(rating: string): string {
  switch (rating) {
    case 'excellent': return 'text-success-green';
    case 'good': return 'text-neon-cyan';
    case 'average': return 'text-warning-orange';
    case 'poor': return 'text-danger-red';
    default: return 'text-gray-400';
  }
}

function getRatingLabel(rating: string): string {
  switch (rating) {
    case 'excellent': return '优秀';
    case 'good': return '良好';
    case 'average': return '一般';
    case 'poor': return '较差';
    default: return rating;
  }
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'high': return 'border-danger-red text-danger-red';
    case 'medium': return 'border-warning-orange text-warning-orange';
    case 'low': return 'border-neon-cyan text-neon-cyan';
    default: return 'border-gray-400 text-gray-400';
  }
}

function getPriorityLabel(priority: string): string {
  switch (priority) {
    case 'high': return '高优先级';
    case 'medium': return '中优先级';
    case 'low': return '低优先级';
    default: return priority;
  }
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    financial: '财务',
    route: '路线',
    inventory: '库存',
    marketing: '营销',
    risk_management: '风险管理',
  };
  return labels[category] || category;
}

export default function Review() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('financial');
  const [simulatedPaths, setSimulatedPaths] = useState<AlternativePath[]>([]);
  const [selectedDecision, setSelectedDecision] = useState<string | null>(null);

  const {
    currentTour,
    stops,
    merchItems,
    decisions,
    riskEvents,
    stopResults,
    cashFlow,
    riskIndex,
    resetGame,
  } = useGameEngine();

  const { generateReviewReport, simulateAlternativePath } = useReviewAnalysis();

  const gameState = useMemo(() => ({
    currentTour,
    stops,
    merchItems,
    currentStopIndex: stops.findIndex(s => s.status === 'current'),
    currentStopPhase: 'settled' as const,
    gamePhase: 'review' as const,
    cashFlow,
    totalRevenue: stopResults.reduce((sum, r) => sum + r.totalRevenue, 0),
    totalExpense: stopResults.reduce((sum, r) => sum + r.totalExpense, 0),
    riskIndex,
    decisions,
    riskEvents,
    stopResults,
    isPaused: false,
    isGameOver: true,
    dailySalesRate: {},
  }), [currentTour, stops, merchItems, cashFlow, riskIndex, decisions, riskEvents, stopResults]);

  const report: ReviewReport | null = useMemo(() => {
    if (!currentTour) return null;
    try {
      return generateReviewReport(
        gameState,
        currentTour,
        stops,
        merchItems,
        decisions,
        riskEvents,
        stopResults
      );
    } catch (error) {
      console.error('Failed to generate review report:', error);
      return null;
    }
  }, [gameState, currentTour, stops, merchItems, decisions, riskEvents, stopResults, generateReviewReport]);

  const handleSimulatePath = (decisionId: string) => {
    const decision = decisions.find(d => d.id === decisionId);
    if (!decision) return;

    const alternative = decision.alternatives.find(a => a.id !== decision.chosenOption.id);
    if (!alternative) return;

    const path = simulateAlternativePath(gameState, decision, alternative);
    setSimulatedPaths(prev => {
      const existing = prev.find(p => p.decisionPointId === decisionId);
      if (existing) return prev;
      return [...prev, path];
    });
    setSelectedDecision(decisionId);
  };

  const handleRestart = () => {
    resetGame();
    navigate('/');
  };

  const handleExport = () => {
    navigate('/export');
  };

  if (!report) {
    return (
      <div className="min-h-screen bg-rock-dark flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-warning-orange mx-auto mb-4" />
          <p className="text-gray-400 text-lg">暂无复盘数据</p>
          <NeonButton className="mt-6" onClick={() => navigate('/')}>
            返回首页
          </NeonButton>
        </div>
      </div>
    );
  }

  const { executionSummary, financialOverview, stopAnalysis, riskAnalysis, decisionAnalysis, recommendations } = report;

  return (
    <div className="min-h-screen bg-rock-dark p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="font-rock text-4xl uppercase tracking-wider text-neon-pink mb-8 text-center">
          巡演复盘报告
        </h1>

        <NeonCard
          borderColor={executionSummary.isSuccess ? 'success-green' : 'danger-red'}
          className="mb-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${executionSummary.isSuccess ? 'bg-success-green/20' : 'bg-danger-red/20'}`}>
                {executionSummary.isSuccess ? (
                  <Trophy className="w-8 h-8 text-success-green" />
                ) : (
                  <XCircle className="w-8 h-8 text-danger-red" />
                )}
              </div>
              <div>
                <p className="text-gray-400 text-sm">巡演名称</p>
                <p className="font-rock text-xl text-white">{executionSummary.tourName}</p>
                <p className={`text-sm ${executionSummary.isSuccess ? 'text-success-green' : 'text-danger-red'}`}>
                  {executionSummary.isSuccess ? '巡演成功' : '巡演失败'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-neon-cyan/20">
                <DollarSign className="w-8 h-8 text-neon-cyan" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">最终现金流</p>
                <p className="font-rock text-xl text-neon-cyan">
                  {formatCurrency(executionSummary.finalCashFlow)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-neon-purple/20">
                <TrendingUp className="w-8 h-8 text-neon-purple" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">净利润</p>
                <p className={`font-rock text-xl ${executionSummary.netProfit >= 0 ? 'text-success-green' : 'text-danger-red'}`}>
                  {formatCurrency(executionSummary.netProfit)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-warning-orange/20">
                <AlertTriangle className="w-8 h-8 text-warning-orange" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">风险等级</p>
                <RiskBadge level={executionSummary.riskLevel} size="lg" />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-rock-light/30 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-400">巡演时长：</span>
              <span className="text-white">{executionSummary.tourDuration}</span>
            </div>
            <div>
              <span className="text-gray-400">完成站数：</span>
              <span className="text-white">{executionSummary.completedStops}/{executionSummary.totalStops}</span>
            </div>
            <div>
              <span className="text-gray-400">初始预算：</span>
              <span className="text-white">{formatCurrency(executionSummary.initialBudget)}</span>
            </div>
            <div>
              <span className="text-gray-400">利润率：</span>
              <span className={financialOverview.profitMargin >= 0 ? 'text-success-green' : 'text-danger-red'}>
                {formatPercentage(financialOverview.profitMargin)}
              </span>
            </div>
          </div>
        </NeonCard>

        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 font-rock uppercase tracking-wider text-sm transition-all duration-300 border-2 rounded-sm ${
                activeTab === tab.id
                  ? 'border-neon-pink text-neon-pink bg-neon-pink/10'
                  : 'border-rock-light/30 text-gray-400 hover:border-neon-pink/50 hover:text-neon-pink/70'
              }`}
              style={activeTab === tab.id ? { boxShadow: `0 0 10px ${TAB_COLORS[index]}` } : undefined}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mb-8">
          {activeTab === 'financial' && (
            <div className="space-y-6">
              <NeonCard borderColor="neon-cyan" title="现金流趋势" subtitle="各站现金流变化">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={financialOverview.cashFlowTimeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="stop" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #e94560', borderRadius: '4px' }}
                        labelStyle={{ color: '#e94560' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="cashFlow" name="净利润" stroke="#00d4ff" strokeWidth={2} dot={{ fill: '#00d4ff' }} />
                      <Line type="monotone" dataKey="revenue" name="收入" stroke="#4ade80" strokeWidth={2} dot={{ fill: '#4ade80' }} />
                      <Line type="monotone" dataKey="expense" name="支出" stroke="#e94560" strokeWidth={2} dot={{ fill: '#e94560' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </NeonCard>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <NeonCard borderColor="neon-pink" title="收入构成">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={financialOverview.revenueBreakdown}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ payload }) => `${payload.category} ${formatPercentage(payload.percentage)}`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="amount"
                        >
                          {financialOverview.revenueBreakdown.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #e94560', borderRadius: '4px' }}
                          formatter={(value: number) => formatCurrency(value)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 space-y-2">
                    {financialOverview.revenueBreakdown.map((item, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                          <span className="text-gray-400">{item.category}</span>
                        </div>
                        <span className="text-white">{formatCurrency(item.amount)} ({formatPercentage(item.percentage)})</span>
                      </div>
                    ))}
                  </div>
                </NeonCard>

                <NeonCard borderColor="neon-purple" title="支出构成">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={financialOverview.expenseBreakdown}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ payload }) => `${payload.category} ${formatPercentage(payload.percentage)}`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="amount"
                        >
                          {financialOverview.expenseBreakdown.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[(index + 2) % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #9d4edd', borderRadius: '4px' }}
                          formatter={(value: number) => formatCurrency(value)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 space-y-2">
                    {financialOverview.expenseBreakdown.map((item, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[(index + 2) % CHART_COLORS.length] }} />
                          <span className="text-gray-400">{item.category}</span>
                        </div>
                        <span className="text-white">{formatCurrency(item.amount)} ({formatPercentage(item.percentage)})</span>
                      </div>
                    ))}
                  </div>
                </NeonCard>
              </div>

              <NeonCard borderColor="success-green" title="各站利润对比">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={financialOverview.perStopFinancials}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="city" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #4ade80', borderRadius: '4px' }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend />
                      <Bar dataKey="profit" name="利润" fill="#4ade80" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="revenue" name="收入" fill="#00d4ff" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" name="支出" fill="#e94560" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </NeonCard>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <NeonCard borderColor="neon-cyan" className="text-center">
                  <p className="text-gray-400 text-sm">总收入</p>
                  <p className="font-rock text-2xl text-neon-cyan mt-2">{formatCurrency(financialOverview.totalRevenue)}</p>
                </NeonCard>
                <NeonCard borderColor="danger-red" className="text-center">
                  <p className="text-gray-400 text-sm">总支出</p>
                  <p className="font-rock text-2xl text-danger-red mt-2">{formatCurrency(financialOverview.totalExpense)}</p>
                </NeonCard>
                <NeonCard borderColor="success-green" className="text-center">
                  <p className="text-gray-400 text-sm">净利润</p>
                  <p className={`font-rock text-2xl mt-2 ${financialOverview.netProfit >= 0 ? 'text-success-green' : 'text-danger-red'}`}>
                    {formatCurrency(financialOverview.netProfit)}
                  </p>
                </NeonCard>
                <NeonCard borderColor="neon-purple" className="text-center">
                  <p className="text-gray-400 text-sm">利润率</p>
                  <p className={`font-rock text-2xl mt-2 ${financialOverview.profitMargin >= 0 ? 'text-neon-purple' : 'text-danger-red'}`}>
                    {formatPercentage(financialOverview.profitMargin)}
                  </p>
                </NeonCard>
              </div>
            </div>
          )}

          {activeTab === 'stops' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {stopAnalysis.map((stop, index) => (
                  <NeonCard
                    key={stop.stop.id}
                    borderColor={
                      stop.performanceRating === 'excellent' ? 'success-green' :
                      stop.performanceRating === 'good' ? 'neon-cyan' :
                      stop.performanceRating === 'average' ? 'warning-orange' : 'danger-red'
                    }
                    title={`${stop.stop.city} - ${stop.stop.venue}`}
                    subtitle={stop.stop.date}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 border-2 rounded-sm font-rock text-sm uppercase ${getRatingColor(stop.performanceRating)} border-current`}>
                          {getRatingLabel(stop.performanceRating)}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className={`font-rock text-xl ${stop.result.netProfit >= 0 ? 'text-success-green' : 'text-danger-red'}`}>
                          {stop.result.netProfit >= 0 ? '+' : ''}{formatCurrency(stop.result.netProfit)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center p-3 bg-rock-light/10 rounded-sm">
                        <p className="text-gray-400 text-xs">上座率</p>
                        <p className={`font-rock text-lg ${stop.attendanceRate >= 80 ? 'text-success-green' : stop.attendanceRate >= 50 ? 'text-warning-orange' : 'text-danger-red'}`}>
                          {formatPercentage(stop.attendanceRate)}
                        </p>
                      </div>
                      <div className="text-center p-3 bg-rock-light/10 rounded-sm">
                        <p className="text-gray-400 text-xs">人均利润</p>
                        <p className={`font-rock text-lg ${stop.profitPerAttendee >= 0 ? 'text-success-green' : 'text-danger-red'}`}>
                          {formatCurrency(stop.profitPerAttendee)}
                        </p>
                      </div>
                      <div className="text-center p-3 bg-rock-light/10 rounded-sm">
                        <p className="text-gray-400 text-xs">周边转化率</p>
                        <p className={`font-rock text-lg ${stop.merchConversionRate >= 20 ? 'text-neon-cyan' : stop.merchConversionRate >= 10 ? 'text-warning-orange' : 'text-danger-red'}`}>
                          {formatPercentage(stop.merchConversionRate)}
                        </p>
                      </div>
                    </div>

                    <div className="h-40 mb-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={[
                          { subject: '上座率', A: stop.attendanceRate, fullMark: 100 },
                          { subject: '利润率', A: Math.min(100, Math.max(0, (stop.result.netProfit / Math.max(1, stop.result.totalRevenue)) * 100 + 50)), fullMark: 100 },
                          { subject: '周边转化', A: stop.merchConversionRate * 2, fullMark: 100 },
                          { subject: '风险控制', A: Math.max(0, 100 - stop.risks.length * 20), fullMark: 100 },
                        ]}>
                          <PolarGrid stroke="#374151" />
                          <PolarAngleAxis dataKey="subject" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                          <PolarRadiusAxis stroke="#374151" />
                          <Radar name="表现" dataKey="A" stroke={CHART_COLORS[index % CHART_COLORS.length]} fill={CHART_COLORS[index % CHART_COLORS.length]} fillOpacity={0.3} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-2">
                      <p className="text-neon-pink text-sm font-rock uppercase">关键洞察</p>
                      {stop.keyInsights.map((insight, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-gray-300">
                          <ChevronRight className="w-4 h-4 text-neon-pink mt-0.5 flex-shrink-0" />
                          <span>{insight}</span>
                        </div>
                      ))}
                    </div>

                    {stop.risks.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-rock-light/30">
                        <p className="text-warning-orange text-sm font-rock uppercase mb-2">风险事件 ({stop.risks.length})</p>
                        <div className="space-y-1">
                          {stop.risks.slice(0, 2).map((risk) => (
                            <div key={risk.id} className="text-xs text-gray-400 flex items-center gap-2">
                              <AlertTriangle className="w-3 h-3 text-warning-orange" />
                              <span className="truncate">{risk.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </NeonCard>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'risks' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <NeonCard borderColor="warning-orange" className="text-center">
                  <p className="text-gray-400 text-sm">风险总数</p>
                  <p className="font-rock text-3xl text-warning-orange mt-2">{riskAnalysis.totalRisks}</p>
                </NeonCard>
                <NeonCard borderColor="danger-red" className="text-center">
                  <p className="text-gray-400 text-sm">高风险事件</p>
                  <p className="font-rock text-3xl text-danger-red mt-2">{riskAnalysis.highRiskEvents.length}</p>
                </NeonCard>
                <NeonCard borderColor="neon-cyan" className="text-center">
                  <p className="text-gray-400 text-sm">未解决风险</p>
                  <p className="font-rock text-3xl text-neon-cyan mt-2">{riskAnalysis.unresolvedRisks.length}</p>
                </NeonCard>
                <NeonCard borderColor="success-green" className="text-center">
                  <p className="text-gray-400 text-sm">已处置风险</p>
                  <p className="font-rock text-3xl text-success-green mt-2">
                    {'resolvedRisks' in riskAnalysis ? riskAnalysis.resolvedRisks.length : 0}
                  </p>
                </NeonCard>
                <NeonCard borderColor="danger-red" className="text-center">
                  <p className="text-gray-400 text-sm">已忽略风险</p>
                  <p className="font-rock text-3xl text-danger-red mt-2">
                    {'dismissedRisks' in riskAnalysis ? riskAnalysis.dismissedRisks.length : 0}
                  </p>
                  {'totalDismissedImpact' in riskAnalysis && riskAnalysis.totalDismissedImpact < 0 && (
                    <p className="text-xs text-danger-red mt-1">
                      损失: -{formatCurrency(Math.abs(riskAnalysis.totalDismissedImpact))}
                    </p>
                  )}
                </NeonCard>
                <NeonCard borderColor="neon-purple" className="text-center">
                  <p className="text-gray-400 text-sm">风险类型</p>
                  <p className="font-rock text-3xl text-neon-purple mt-2">{Object.keys(riskAnalysis.risksByType).length}</p>
                </NeonCard>
              </div>

              <NeonCard borderColor="warning-orange" title="风险事件时间轴">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={riskAnalysis.riskTimeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="stop" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #ff9a3c', borderRadius: '4px' }}
                      />
                      <Legend />
                      <Bar dataKey="riskCount" name="风险数量" fill="#ff9a3c" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="riskIndex" name="风险指数" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </NeonCard>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <NeonCard borderColor="neon-pink" title="风险类型分布">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(riskAnalysis.risksByType).map(([type, count]) => ({ type, count }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ payload }) => `${payload.type} (${payload.count})`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {Object.entries(riskAnalysis.risksByType).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #e94560', borderRadius: '4px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </NeonCard>

                <NeonCard borderColor="neon-purple" title="风险严重程度分布">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(riskAnalysis.risksBySeverity).map(([severity, count]) => ({ severity, count }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ payload }) => `${payload.severity === 'critical' ? '严重' : '警告'} (${payload.count})`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {Object.entries(riskAnalysis.risksBySeverity).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : '#ff9a3c'} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #9d4edd', borderRadius: '4px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </NeonCard>
              </div>

              {riskAnalysis.highRiskEvents.length > 0 && (
                <NeonCard borderColor="danger-red" title="高风险事件详情">
                  <div className="space-y-4">
                    {riskAnalysis.highRiskEvents.map((event) => (
                      <div key={event.id} className="p-4 bg-danger-red/10 border border-danger-red/30 rounded-sm">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-danger-red" />
                            <span className="font-rock uppercase text-danger-red text-sm">
                              {event.type === 'box_office' ? '票房风险' :
                               event.type === 'inventory' ? '库存风险' :
                               event.type === 'route' ? '路线风险' : '现金流风险'}
                            </span>
                            <span className="px-2 py-0.5 bg-danger-red/20 text-danger-red text-xs rounded-sm">
                              {event.severity === 'critical' ? '严重' : '警告'}
                            </span>
                          </div>
                          <span className="text-danger-red font-rock">
                            -{formatCurrency(Math.abs(event.impact))}
                          </span>
                        </div>
                        <p className="text-gray-300 text-sm">{event.description}</p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(event.triggeredAt).toLocaleDateString('zh-CN')}
                          </span>
                          {event.resolvedAt && (
                            <span className="flex items-center gap-1 text-success-green">
                              <CheckCircle className="w-3 h-3" />
                              已解决
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </NeonCard>
              )}
            </div>
          )}

          {activeTab === 'decisions' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <NeonCard borderColor="neon-cyan" className="text-center">
                  <p className="text-gray-400 text-sm">决策总数</p>
                  <p className="font-rock text-3xl text-neon-cyan mt-2">{decisionAnalysis.totalDecisions}</p>
                </NeonCard>
                <NeonCard borderColor="success-green" className="text-center">
                  <p className="text-gray-400 text-sm">平均影响</p>
                  <p className={`font-rock text-3xl mt-2 ${decisionAnalysis.averageImpact >= 0 ? 'text-success-green' : 'text-danger-red'}`}>
                    {formatCurrency(decisionAnalysis.averageImpact)}
                  </p>
                </NeonCard>
                <NeonCard borderColor="neon-purple" className="text-center">
                  <p className="text-gray-400 text-sm">决策类型</p>
                  <p className="font-rock text-3xl text-neon-purple mt-2">{Object.keys(decisionAnalysis.decisionsByType).length}</p>
                </NeonCard>
                <NeonCard borderColor="warning-orange" className="text-center">
                  <p className="text-gray-400 text-sm">激进决策</p>
                  <p className="font-rock text-3xl text-warning-orange mt-2">{decisionAnalysis.decisionsByRiskLevel['aggressive'] || 0}</p>
                </NeonCard>
              </div>

              <NeonCard borderColor="neon-purple" title="决策影响分析">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={decisionAnalysis.decisionImpactChart} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis type="number" stroke="#9ca3af" />
                      <YAxis dataKey="description" type="category" stroke="#9ca3af" width={200} tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #9d4edd', borderRadius: '4px' }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend />
                      <Bar dataKey="impact" name="影响金额" radius={[0, 4, 4, 0]}>
                        {decisionAnalysis.decisionImpactChart.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.impact >= 0 ? '#4ade80' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </NeonCard>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {decisionAnalysis.bestDecisions.length > 0 && (
                  <NeonCard borderColor="success-green" title="最佳决策">
                    <div className="space-y-3">
                      {decisionAnalysis.bestDecisions.map((decision) => (
                        <div key={decision.id} className="p-3 bg-success-green/10 border border-success-green/30 rounded-sm">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                              <Trophy className="w-4 h-4 text-success-green" />
                              <span className="text-sm text-gray-300">{decision.description}</span>
                            </div>
                            <span className="text-success-green font-rock text-sm">
                              +{formatCurrency(decision.outcome.actualImpact)}
                            </span>
                          </div>
                          <div className="mt-2 text-xs text-gray-500">
                            风险等级: {decision.chosenOption.riskLevel === 'conservative' ? '保守' :
                                      decision.chosenOption.riskLevel === 'balanced' ? '平衡' : '激进'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </NeonCard>
                )}

                {decisionAnalysis.worstDecisions.length > 0 && (
                  <NeonCard borderColor="danger-red" title="最差决策">
                    <div className="space-y-3">
                      {decisionAnalysis.worstDecisions.map((decision) => (
                        <div key={decision.id} className="p-3 bg-danger-red/10 border border-danger-red/30 rounded-sm">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                              <XIcon className="w-4 h-4 text-danger-red" />
                              <span className="text-sm text-gray-300">{decision.description}</span>
                            </div>
                            <span className="text-danger-red font-rock text-sm">
                              {formatCurrency(decision.outcome.actualImpact)}
                            </span>
                          </div>
                          <div className="mt-2 text-xs text-gray-500">
                            风险等级: {decision.chosenOption.riskLevel === 'conservative' ? '保守' :
                                      decision.chosenOption.riskLevel === 'balanced' ? '平衡' : '激进'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </NeonCard>
                )}
              </div>

              <NeonCard borderColor="neon-cyan" title="所有决策记录">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-rock-light/30">
                        <th className="text-left py-3 px-4 text-gray-400 font-rock uppercase">决策</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-rock uppercase">类型</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-rock uppercase">风险等级</th>
                        <th className="text-right py-3 px-4 text-gray-400 font-rock uppercase">影响</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-rock uppercase">时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {decisions.map((decision) => (
                        <tr key={decision.id} className="border-b border-rock-light/10 hover:bg-rock-light/5">
                          <td className="py-3 px-4 text-gray-300">{decision.description}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 bg-neon-purple/20 text-neon-purple text-xs rounded-sm">
                              {decision.decisionType === 'risk_mitigation' ? '风险缓解' :
                               decision.decisionType === 'inventory' ? '库存' :
                               decision.decisionType === 'pricing' ? '定价' :
                               decision.decisionType === 'marketing' ? '营销' : '路线'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 text-xs rounded-sm ${
                              decision.chosenOption.riskLevel === 'conservative' ? 'bg-success-green/20 text-success-green' :
                              decision.chosenOption.riskLevel === 'balanced' ? 'bg-neon-cyan/20 text-neon-cyan' :
                              'bg-warning-orange/20 text-warning-orange'
                            }`}>
                              {decision.chosenOption.riskLevel === 'conservative' ? '保守' :
                               decision.chosenOption.riskLevel === 'balanced' ? '平衡' : '激进'}
                            </span>
                          </td>
                          <td className={`py-3 px-4 text-right font-rock ${decision.outcome.actualImpact >= 0 ? 'text-success-green' : 'text-danger-red'}`}>
                            {decision.outcome.actualImpact >= 0 ? '+' : ''}{formatCurrency(decision.outcome.actualImpact)}
                          </td>
                          <td className="py-3 px-4 text-gray-500 text-xs">
                            {new Date(decision.createdAt).toLocaleString('zh-CN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </NeonCard>
            </div>
          )}

          {activeTab === 'playback' && (
            <div className="space-y-6">
              <NeonCard borderColor="warning-orange" title="关键决策点">
                <p className="text-gray-400 text-sm mb-6">
                  点击"模拟替代选择"查看如果当时做出不同决策可能产生的结果
                </p>
                <div className="space-y-4">
                  {decisions.map((decision, index) => (
                    <div
                      key={decision.id}
                      className={`p-4 border-2 rounded-sm transition-all duration-300 ${
                        selectedDecision === decision.id
                          ? 'border-warning-orange bg-warning-orange/10'
                          : 'border-rock-light/30 bg-rock-light/5 hover:border-warning-orange/50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-neon-pink/20 flex items-center justify-center flex-shrink-0 mt-1">
                            <span className="font-rock text-neon-pink text-sm">{index + 1}</span>
                          </div>
                          <div>
                            <p className="text-white font-medium">{decision.description}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className={`px-2 py-0.5 text-xs rounded-sm ${
                                decision.chosenOption.riskLevel === 'conservative' ? 'bg-success-green/20 text-success-green' :
                                decision.chosenOption.riskLevel === 'balanced' ? 'bg-neon-cyan/20 text-neon-cyan' :
                                'bg-warning-orange/20 text-warning-orange'
                              }`}>
                                已选: {decision.chosenOption.name}
                              </span>
                              <span className={`px-2 py-0.5 text-xs rounded-sm font-rock ${
                                decision.outcome.actualImpact >= 0 ? 'bg-success-green/20 text-success-green' : 'bg-danger-red/20 text-danger-red'
                              }`}>
                                实际影响: {decision.outcome.actualImpact >= 0 ? '+' : ''}{formatCurrency(decision.outcome.actualImpact)}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-gray-500">
                              {new Date(decision.createdAt).toLocaleString('zh-CN')}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          {decision.alternatives.length > 0 && (
                            <NeonButton
                              size="sm"
                              variant="warning"
                              onClick={() => handleSimulatePath(decision.id)}
                              disabled={simulatedPaths.some(p => p.decisionPointId === decision.id)}
                            >
                              <Zap className="w-4 h-4 mr-1" />
                              {simulatedPaths.some(p => p.decisionPointId === decision.id) ? '已模拟' : '模拟替代选择'}
                            </NeonButton>
                          )}
                        </div>
                      </div>

                      {decision.alternatives.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-rock-light/30">
                          <p className="text-xs text-gray-400 mb-2">可选方案:</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {decision.alternatives.map((alt) => (
                              <div
                                key={alt.id}
                                className={`p-3 rounded-sm border ${
                                  alt.id === decision.chosenOption.id
                                    ? 'border-neon-pink bg-neon-pink/10'
                                    : 'border-rock-light/30 bg-rock-light/5'
                                }`}
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className={`text-sm font-medium ${alt.id === decision.chosenOption.id ? 'text-neon-pink' : 'text-gray-300'}`}>
                                      {alt.name}
                                      {alt.id === decision.chosenOption.id && (
                                        <span className="ml-2 text-xs">(已选择)</span>
                                      )}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">{alt.description}</p>
                                  </div>
                                  <span className={`px-2 py-0.5 text-xs rounded-sm ${
                                    alt.riskLevel === 'conservative' ? 'bg-success-green/20 text-success-green' :
                                    alt.riskLevel === 'balanced' ? 'bg-neon-cyan/20 text-neon-cyan' :
                                    'bg-warning-orange/20 text-warning-orange'
                                  }`}>
                                    {alt.riskLevel === 'conservative' ? '保守' :
                                     alt.riskLevel === 'balanced' ? '平衡' : '激进'}
                                  </span>
                                </div>
                                <div className="mt-2 flex gap-4 text-xs">
                                  <span className="text-gray-400">
                                    现金流影响: <span className={alt.immediateImpact.cashFlow >= 0 ? 'text-success-green' : 'text-danger-red'}>
                                      {alt.immediateImpact.cashFlow >= 0 ? '+' : ''}{formatCurrency(alt.immediateImpact.cashFlow)}
                                    </span>
                                  </span>
                                  <span className="text-gray-400">
                                    风险变化: <span className={alt.immediateImpact.riskIndex <= 0 ? 'text-success-green' : 'text-danger-red'}>
                                      {alt.immediateImpact.riskIndex > 0 ? '+' : ''}{alt.immediateImpact.riskIndex}
                                    </span>
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </NeonCard>

              {simulatedPaths.length > 0 && (
                <NeonCard borderColor="neon-purple" title='"如果当时..." 分析'>
                  <p className="text-gray-400 text-sm mb-6">
                    模拟不同决策对最终结果的影响
                  </p>
                  <div className="space-y-4">
                    {simulatedPaths.map((path) => {
                      const originalDecision = decisions.find(d => d.id === path.decisionPointId);
                      const diff = path.simulatedResult.netProfit - executionSummary.netProfit;
                      return (
                        <div key={path.decisionPointId} className="p-4 bg-neon-purple/10 border border-neon-purple/30 rounded-sm">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <p className="text-neon-purple font-rock">
                                替代选择: {path.alternativeOptionName}
                              </p>
                              <p className="text-sm text-gray-400 mt-1">
                                {originalDecision?.description}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`font-rock text-xl ${diff >= 0 ? 'text-success-green' : 'text-danger-red'}`}>
                                {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                              </p>
                              <p className="text-xs text-gray-500">与实际结果差异</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center p-3 bg-rock-dark/50 rounded-sm">
                              <p className="text-xs text-gray-400">模拟最终现金流</p>
                              <p className="font-rock text-lg text-neon-cyan mt-1">
                                {formatCurrency(path.simulatedResult.finalCashFlow)}
                              </p>
                            </div>
                            <div className="text-center p-3 bg-rock-dark/50 rounded-sm">
                              <p className="text-xs text-gray-400">模拟净利润</p>
                              <p className={`font-rock text-lg mt-1 ${path.simulatedResult.netProfit >= 0 ? 'text-success-green' : 'text-danger-red'}`}>
                                {formatCurrency(path.simulatedResult.netProfit)}
                              </p>
                            </div>
                            <div className="text-center p-3 bg-rock-dark/50 rounded-sm">
                              <p className="text-xs text-gray-400">模拟结果</p>
                              <p className={`font-rock text-lg mt-1 ${path.simulatedResult.isSuccess ? 'text-success-green' : 'text-danger-red'}`}>
                                {path.simulatedResult.isSuccess ? '成功' : '失败'}
                              </p>
                            </div>
                            <div className="text-center p-3 bg-rock-dark/50 rounded-sm">
                              <p className="text-xs text-gray-400">风险变化</p>
                              <p className={`font-rock text-lg mt-1 ${path.simulatedResult.risksAvoided.length > 0 ? 'text-success-green' : 'text-warning-orange'}`}>
                                {path.simulatedResult.risksAvoided.length > 0
                                  ? `避免 ${path.simulatedResult.risksAvoided.length} 个风险`
                                  : path.simulatedResult.risksCreated.length > 0
                                    ? `新增 ${path.simulatedResult.risksCreated.length} 个风险`
                                    : '无变化'}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-rock-light/30">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-success-green mb-2">实际结果</p>
                                <div className="p-3 bg-success-green/10 rounded-sm border border-success-green/30">
                                  <p className="text-sm text-white">选择: {originalDecision?.chosenOption.name}</p>
                                  <p className="text-sm text-gray-400 mt-1">
                                    净利润: <span className={executionSummary.netProfit >= 0 ? 'text-success-green' : 'text-danger-red'}>
                                      {formatCurrency(executionSummary.netProfit)}
                                    </span>
                                  </p>
                                </div>
                              </div>
                              <div>
                                <p className="text-xs text-neon-purple mb-2">模拟结果</p>
                                <div className="p-3 bg-neon-purple/10 rounded-sm border border-neon-purple/30">
                                  <p className="text-sm text-white">选择: {path.alternativeOptionName}</p>
                                  <p className="text-sm text-gray-400 mt-1">
                                    净利润: <span className={path.simulatedResult.netProfit >= 0 ? 'text-success-green' : 'text-danger-red'}>
                                      {formatCurrency(path.simulatedResult.netProfit)}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </NeonCard>
              )}
            </div>
          )}

          {activeTab === 'recommendations' && (
            <div className="space-y-6">
              {recommendations.length === 0 ? (
                <NeonCard borderColor="success-green" className="text-center py-12">
                  <CheckCircle className="w-16 h-16 text-success-green mx-auto mb-4" />
                  <p className="text-xl text-white font-rock">表现优秀！</p>
                  <p className="text-gray-400 mt-2">本次巡演没有需要特别改进的地方</p>
                </NeonCard>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="w-5 h-5 text-neon-pink" />
                    <p className="text-gray-400">
                      共 <span className="text-neon-pink font-rock">{recommendations.length}</span> 条改进建议
                    </p>
                  </div>

                  <div className="space-y-4">
                    {recommendations
                      .sort((a, b) => {
                        const priorityOrder = { high: 0, medium: 1, low: 2 };
                        return priorityOrder[a.priority] - priorityOrder[b.priority];
                      })
                      .map((rec) => (
                      <NeonCard
                        key={rec.id}
                        borderColor={
                          rec.priority === 'high' ? 'danger-red' :
                          rec.priority === 'medium' ? 'warning-orange' : 'neon-cyan'
                        }
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-full ${
                              rec.priority === 'high' ? 'bg-danger-red/20' :
                              rec.priority === 'medium' ? 'bg-warning-orange/20' : 'bg-neon-cyan/20'
                            }`}>
                              <Lightbulb className={`w-5 h-5 ${
                                rec.priority === 'high' ? 'text-danger-red' :
                                rec.priority === 'medium' ? 'text-warning-orange' : 'text-neon-cyan'
                              }`} />
                            </div>
                            <div>
                              <h4 className="font-rock text-lg text-white">{rec.title}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-0.5 border-2 text-xs rounded-sm uppercase ${getPriorityColor(rec.priority)}`}>
                                  {getPriorityLabel(rec.priority)}
                                </span>
                                <span className="px-2 py-0.5 bg-neon-purple/20 text-neon-purple text-xs rounded-sm">
                                  {getCategoryLabel(rec.category)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <p className="text-gray-300 mb-4">{rec.description}</p>

                        <div className="mb-4">
                          <p className="text-neon-pink text-sm font-rock uppercase mb-2">可执行步骤</p>
                          <div className="space-y-2">
                            {rec.actionableSteps.map((step, index) => (
                              <div key={index} className="flex items-start gap-2">
                                <div className="w-6 h-6 rounded-full bg-neon-pink/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <span className="text-xs text-neon-pink font-rock">{index + 1}</span>
                                </div>
                                <span className="text-sm text-gray-300">{step}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="p-3 bg-success-green/10 border border-success-green/30 rounded-sm">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-success-green" />
                            <span className="text-success-green text-sm font-rock">预期影响</span>
                          </div>
                          <p className="text-sm text-gray-300 mt-1">{rec.expectedImpact}</p>
                        </div>
                      </NeonCard>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-4 pb-8">
          <NeonButton variant="secondary" size="lg" onClick={handleRestart}>
            <RotateCcw className="w-5 h-5 mr-2" />
            重新开始
          </NeonButton>
          <NeonButton variant="primary" size="lg" onClick={handleExport}>
            <Download className="w-5 h-5 mr-2" />
            导出报告
          </NeonButton>
        </div>
      </div>
    </div>
  );
}
