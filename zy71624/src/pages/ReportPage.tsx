import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useGameStore } from '@/store/gameStore';
import { NeonButton } from '@/components/ui/NeonButton';
import { GlowCard } from '@/components/ui/GlowCard';
import {
  formatTime,
  formatVoltage,
  exportReportAsJSON,
  exportReportAsCSV,
  downloadFile,
  DIFFICULTY_LABELS,
  loadGameData,
} from '@/utils/gameConfig';
import {
  HomeIcon,
  PlayIcon,
  DownloadIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  BarChartIcon,
  ScoreIcon,
  AlertTriangleIcon,
  ZapIcon,
  FlameIcon,
  GitBranchIcon,
} from '@/components/circuit/CircuitIcons';
import type { GameReport, Order, Incident, GameState } from '@/types';

const STATUS_COLORS = {
  processed: '#10B981',
  pending: '#F59E0B',
  returned: '#EF4444',
};

const INCIDENT_COLORS: Record<Incident['type'], string> = {
  short_circuit: '#EF4444',
  overvoltage: '#F59E0B',
  undervoltage: '#F59E0B',
  overcurrent: '#EF4444',
  timeout: '#8B5CF6',
  parallel_current_error: '#06B6D4',
};

const INCIDENT_LABELS: Record<Incident['type'], string> = {
  short_circuit: '短路',
  overvoltage: '过压',
  undervoltage: '欠压',
  overcurrent: '过流',
  timeout: '超时',
  parallel_current_error: '并联电流错误',
};

function OrderCard({ order, status }: { order: Order; status: 'processed' | 'pending' | 'returned' }) {
  const statusConfig = {
    processed: { color: 'border-neon-green', bg: 'bg-neon-green/10', text: 'text-neon-green', label: '已处理' },
    pending: { color: 'border-neon-orange', bg: 'bg-neon-orange/10', text: 'text-neon-orange', label: '待确认' },
    returned: { color: 'border-neon-red', bg: 'bg-neon-red/10', text: 'text-neon-red', label: '退回补材料' },
  };
  const config = statusConfig[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-3 rounded-lg border ${config.color} ${config.bg} mb-2`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-sm text-neon-silver">{order.barName}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.text}`}>
          {config.label}
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs text-neon-silver/70 mb-2">
        <span>要求电压: {formatVoltage(order.requiredVoltage)}</span>
        <span>得分: +{order.score}</span>
      </div>
      <div className="text-xs text-neon-silver/50">
        创建: {new Date(order.createdAt).toLocaleTimeString('zh-CN')}
        {order.completedAt && ` · 完成: ${new Date(order.completedAt).toLocaleTimeString('zh-CN')}`}
      </div>
      {order.problemType && (
        <div className="mt-1 text-xs text-neon-cyan">
          问题类型: {order.problemType === 'normal' ? '正常' : order.problemType}
        </div>
      )}
    </motion.div>
  );
}

function IncidentCard({ incident }: { incident: Incident }) {
  const config = {
    short_circuit: { icon: FlameIcon, color: 'text-neon-red', border: 'border-neon-red' },
    overvoltage: { icon: ZapIcon, color: 'text-neon-orange', border: 'border-neon-orange' },
    undervoltage: { icon: ZapIcon, color: 'text-neon-yellow', border: 'border-neon-yellow' },
    overcurrent: { icon: FlameIcon, color: 'text-neon-red', border: 'border-neon-red' },
    timeout: { icon: ClockIcon, color: 'text-neon-purple', border: 'border-neon-purple' },
    parallel_current_error: { icon: GitBranchIcon, color: 'text-neon-cyan', border: 'border-neon-cyan' },
  };
  const { icon: Icon, color, border } = config[incident.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`p-3 rounded-lg border ${border} bg-neon-card/30 mb-2`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className={`font-bold text-sm ${color}`}>
          {INCIDENT_LABELS[incident.type]}
        </span>
        <span className="text-xs text-neon-silver/60 ml-auto">
          {formatTime(incident.gameTime)}
        </span>
      </div>
      <p className="text-xs text-neon-silver/70">{incident.description}</p>
      <div className="flex items-center justify-between mt-2 text-xs">
        <span className="text-neon-red">扣 {incident.penalty} 分</span>
        <span className={incident.resolved ? 'text-neon-green' : 'text-neon-red/70'}>
          {incident.resolved ? '已解决' : '未解决'}
        </span>
      </div>
    </motion.div>
  );
}

export default function ReportPage() {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();
  const { getReport, id: currentGameId } = useGameStore();
  const [report, setReport] = useState<GameReport | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'incidents'>('overview');

  useEffect(() => {
    if (gameId) {
      const data = loadGameData(gameId) as { state: GameState; report: GameReport } | null;
      if (data?.report) {
        setReport(data.report);
      }
    } else {
      const currentReport = getReport();
      if (currentReport) {
        setReport(currentReport);
      }
    }
  }, [gameId, getReport]);

  const handleExportJSON = () => {
    if (!report) return;
    const json = exportReportAsJSON(report);
    downloadFile(json, `circuit-bar-report-${report.gameId.slice(0, 8)}.json`, 'application/json');
  };

  const handleExportCSV = () => {
    if (!report) return;
    const csv = exportReportAsCSV(report);
    downloadFile(csv, `circuit-bar-report-${report.gameId.slice(0, 8)}.csv`, 'text/csv');
  };

  if (!report) {
    return (
      <div className="min-h-screen bg-neon-bg flex items-center justify-center">
        <div className="text-center">
          <AlertTriangleIcon className="w-16 h-16 text-neon-orange mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-neon-orange mb-2">暂无报告数据</h2>
          <p className="text-neon-silver/70 mb-4">请先完成一局游戏</p>
          <NeonButton color="purple" onClick={() => navigate('/')}>
            返回首页
          </NeonButton>
        </div>
      </div>
    );
  }

  const pieData = [
    { name: '已处理', value: report.statistics.processed.count, color: STATUS_COLORS.processed },
    { name: '待确认', value: report.statistics.pending.count, color: STATUS_COLORS.pending },
    { name: '退回补材料', value: report.statistics.returned.count, color: STATUS_COLORS.returned },
  ];

  const incidentCounts = report.incidents.reduce((acc, incident) => {
    acc[incident.type] = (acc[incident.type] || 0) + 1;
    return acc;
  }, {} as Record<Incident['type'], number>);

  const barData = Object.entries(incidentCounts).map(([type, count]) => ({
    name: INCIDENT_LABELS[type as Incident['type']],
    count,
    fill: INCIDENT_COLORS[type as Incident['type']],
  }));

  const totalOrders = report.statistics.processed.count + report.statistics.pending.count + report.statistics.returned.count;

  return (
    <div className="min-h-screen bg-neon-bg p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="glass-card px-6 py-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <BarChartIcon className="w-6 h-6 text-neon-cyan" />
              <h1 className="font-display font-bold text-2xl text-neon-cyan text-neon-glow-cyan">
                运营报告
              </h1>
            </div>
            <span className="px-3 py-1 bg-neon-purple/20 text-neon-purple rounded-full text-sm">
              {DIFFICULTY_LABELS[report.difficulty]}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <NeonButton color="green" onClick={handleExportJSON}>
              <DownloadIcon className="w-4 h-4 mr-2" />
              导出 JSON
            </NeonButton>
            <NeonButton color="cyan" onClick={handleExportCSV}>
              <DownloadIcon className="w-4 h-4 mr-2" />
              导出 CSV
            </NeonButton>
            {!gameId && currentGameId === report.gameId && (
              <NeonButton color="purple" onClick={() => navigate('/replay')}>
                <PlayIcon className="w-4 h-4 mr-2" />
                事故回放
              </NeonButton>
            )}
            <NeonButton color="purple" variant="outline" onClick={() => navigate('/')}>
              <HomeIcon className="w-4 h-4" />
            </NeonButton>
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-4 gap-4"
        >
          <GlowCard color="orange" className="p-4">
            <div className="flex items-center gap-3">
              <ScoreIcon className="w-8 h-8 text-neon-orange" />
              <div>
                <div className="text-sm text-neon-silver/70">总分</div>
                <div className="font-display font-bold text-2xl text-neon-orange">{report.totalScore}</div>
              </div>
            </div>
          </GlowCard>

          <GlowCard color="cyan" className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircleIcon className="w-8 h-8 text-neon-cyan" />
              <div>
                <div className="text-sm text-neon-silver/70">准确率</div>
                <div className="font-display font-bold text-2xl text-neon-cyan">
                  {(report.accuracy * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </GlowCard>

          <GlowCard color="purple" className="p-4">
            <div className="flex items-center gap-3">
              <ClockIcon className="w-8 h-8 text-neon-purple" />
              <div>
                <div className="text-sm text-neon-silver/70">游戏时长</div>
                <div className="font-display font-bold text-2xl text-neon-purple">
                  {formatTime(Math.floor(report.duration / 1000))}
                </div>
              </div>
            </div>
          </GlowCard>

          <GlowCard color="red" className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangleIcon className="w-8 h-8 text-neon-red" />
              <div>
                <div className="text-sm text-neon-silver/70">事故数</div>
                <div className="font-display font-bold text-2xl text-neon-red">{report.incidents.length}</div>
              </div>
            </div>
          </GlowCard>
        </motion.div>

        <div className="flex gap-2">
          {(['overview', 'orders', 'incidents'] as const).map((tab) => (
            <NeonButton
              key={tab}
              color={activeTab === tab ? 'purple' : 'cyan'}
              variant={activeTab === tab ? 'solid' : 'outline'}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'overview' && '概览'}
              {tab === 'orders' && `订单详情 (${totalOrders})`}
              {tab === 'incidents' && `事故记录 (${report.incidents.length})`}
            </NeonButton>
          ))}
        </div>

        {activeTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 gap-6"
          >
            <GlowCard color="purple" className="p-6">
              <h3 className="font-display font-bold text-neon-purple mb-4 flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5" />
                订单状态分布
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </GlowCard>

            <GlowCard color="red" className="p-6">
              <h3 className="font-display font-bold text-neon-red mb-4 flex items-center gap-2">
                <AlertTriangleIcon className="w-5 h-5" />
                事故类型分布
              </h3>
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="count" name="次数">
                      {barData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-neon-silver/50">
                  暂无事故记录
                </div>
              )}
            </GlowCard>
          </motion.div>
        )}

        {activeTab === 'orders' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-3 gap-6"
          >
            <div>
              <h3 className="font-display font-bold text-neon-green mb-4 flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5" />
                已处理 ({report.statistics.processed.count})
              </h3>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                {report.statistics.processed.orders.map((order) => (
                  <OrderCard key={order.id} order={order} status="processed" />
                ))}
                {report.statistics.processed.count === 0 && (
                  <div className="text-center text-neon-silver/50 py-8">
                    暂无已处理订单
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-display font-bold text-neon-orange mb-4 flex items-center gap-2">
                <ClockIcon className="w-5 h-5" />
                待确认 ({report.statistics.pending.count})
              </h3>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                {report.statistics.pending.orders.map((order) => (
                  <OrderCard key={order.id} order={order} status="pending" />
                ))}
                {report.statistics.pending.count === 0 && (
                  <div className="text-center text-neon-silver/50 py-8">
                    暂无待确认订单
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-display font-bold text-neon-red mb-4 flex items-center gap-2">
                <XCircleIcon className="w-5 h-5" />
                退回补材料 ({report.statistics.returned.count})
              </h3>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                {report.statistics.returned.orders.map((order) => (
                  <OrderCard key={order.id} order={order} status="returned" />
                ))}
                {report.statistics.returned.count === 0 && (
                  <div className="text-center text-neon-silver/50 py-8">
                    暂无退回订单
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'incidents' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 gap-6"
          >
            <GlowCard color="red" className="p-6">
              <h3 className="font-display font-bold text-neon-red mb-4 flex items-center gap-2">
                <AlertTriangleIcon className="w-5 h-5" />
                事故记录
              </h3>
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {report.incidents.map((incident) => (
                  <IncidentCard key={incident.id} incident={incident} />
                ))}
                {report.incidents.length === 0 && (
                  <div className="text-center text-neon-silver/50 py-8">
                    <div className="text-4xl mb-2">✨</div>
                    完美！没有发生任何事故
                  </div>
                )}
              </div>
            </GlowCard>

            <div className="space-y-4">
              <GlowCard color="purple" className="p-6">
                <h3 className="font-display font-bold text-neon-purple mb-4">统计摘要</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-neon-silver">总订单数</span>
                    <span className="font-bold text-neon-purple">{totalOrders}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neon-silver">已处理订单</span>
                    <span className="font-bold text-neon-green">{report.statistics.processed.count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neon-silver">待确认订单</span>
                    <span className="font-bold text-neon-orange">{report.statistics.pending.count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neon-silver">退回订单</span>
                    <span className="font-bold text-neon-red">{report.statistics.returned.count}</span>
                  </div>
                  <div className="border-t border-neon-silver/20 pt-3 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-neon-silver">事故总数</span>
                      <span className="font-bold text-neon-red">{report.incidents.length}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-neon-silver">已解决事故</span>
                      <span className="font-bold text-neon-green">
                        {report.incidents.filter(i => i.resolved).length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-neon-silver">待解决事故</span>
                      <span className="font-bold text-neon-orange">
                        {report.incidents.filter(i => !i.resolved).length}
                      </span>
                    </div>
                  </div>
                </div>
              </GlowCard>

              <GlowCard color="cyan" className="p-6">
                <h3 className="font-display font-bold text-neon-cyan mb-4">游戏信息</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neon-silver/70">游戏ID</span>
                    <span className="font-mono text-neon-cyan">{report.gameId.slice(0, 16)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neon-silver/70">开始时间</span>
                    <span className="text-neon-silver">{new Date(report.startTime).toLocaleString('zh-CN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neon-silver/70">结束时间</span>
                    <span className="text-neon-silver">{new Date(report.endTime).toLocaleString('zh-CN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neon-silver/70">导出时间</span>
                    <span className="text-neon-silver">{new Date(report.exportTime).toLocaleString('zh-CN')}</span>
                  </div>
                </div>
              </GlowCard>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
