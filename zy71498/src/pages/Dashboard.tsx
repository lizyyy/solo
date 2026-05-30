import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Music,
  AlertTriangle,
  CheckCircle,
  Copyright,
  Clock,
  Upload,
  BarChart3,
  Download,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import StatCard from '@/components/StatCard';
import LoadingSpinner, { SkeletonCard } from '@/components/LoadingSpinner';
import { useAppStore, fetchDashboardStats } from '@/store';
import { EMOTION_TAG_LABELS, EMOTION_TAG_COLORS } from '@/../shared/types';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

export default function Dashboard() {
  const navigate = useNavigate();
  const { dashboardStats, loading } = useAppStore();

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const isLoading = loading.dashboard || !dashboardStats;

  const quickActions = [
    {
      title: '导入数据',
      description: '上传曲库情绪标签数据',
      icon: Upload,
      path: '/import',
      color: 'purple',
    },
    {
      title: '标签对比',
      description: '查看算法与人工标签差异',
      icon: BarChart3,
      path: '/compare',
      color: 'green',
    },
    {
      title: '导出结果',
      description: '生成复核报告并下载',
      icon: Download,
      path: '/export',
      color: 'yellow',
    },
  ];

  const radarData = dashboardStats
    ? Object.entries(dashboardStats.emotionDistribution).map(([key, value]) => ({
        emotion: EMOTION_TAG_LABELS[key as keyof typeof EMOTION_TAG_LABELS],
        algorithm: value.algorithm,
        manual: value.manual,
        fullMark: Math.max(...Object.values(dashboardStats.emotionDistribution).map(v => Math.max(v.algorithm, v.manual))) + 5,
      }))
    : [];

  const barData = dashboardStats
    ? Object.entries(dashboardStats.emotionDistribution).map(([key, value]) => ({
        emotion: EMOTION_TAG_LABELS[key as keyof typeof EMOTION_TAG_LABELS],
        algorithm: value.algorithm,
        manual: value.manual,
        fill: EMOTION_TAG_COLORS[key as keyof typeof EMOTION_TAG_COLORS],
      }))
    : [];

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="mb-8 animate-fade-in">
        <h1 className="font-display text-3xl font-bold text-white mb-2">仪表盘</h1>
        <p className="text-deep-blue-300">曲库情绪标签复核数据概览</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              title="总曲目数"
              value={dashboardStats!.totalTracks}
              icon={<Music className="w-6 h-6" />}
              color="purple"
              delay={0}
            />
            <StatCard
              title="待处理冲突"
              value={dashboardStats!.conflictCount}
              icon={<AlertTriangle className="w-6 h-6" />}
              color="red"
              delay={100}
              trend={{ value: 12, isPositive: false }}
            />
            <StatCard
              title="已解决冲突"
              value={dashboardStats!.resolvedCount}
              icon={<CheckCircle className="w-6 h-6" />}
              color="green"
              delay={200}
              trend={{ value: 8, isPositive: true }}
            />
            <StatCard
              title="版权下架"
              value={dashboardStats!.copyrightRemoved}
              icon={<Copyright className="w-6 h-6" />}
              color="yellow"
              delay={300}
            />
            <StatCard
              title="待处理曲目"
              value={dashboardStats!.pendingCount}
              icon={<Clock className="w-6 h-6" />}
              color="blue"
              delay={400}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {quickActions.map((action, index) => {
          const Icon = action.icon;
          const colorClasses = {
            purple: 'from-neon-purple-600/20 to-neon-purple-800/20 border-neon-purple-500/30 hover:border-neon-purple-400/50',
            green: 'from-emerald-green-600/20 to-emerald-green-800/20 border-emerald-green-500/30 hover:border-emerald-green-400/50',
            yellow: 'from-amber-yellow-600/20 to-amber-yellow-800/20 border-amber-yellow-500/30 hover:border-amber-yellow-400/50',
          };
          const iconColorClasses = {
            purple: 'bg-neon-purple-500/20 text-neon-purple-400',
            green: 'bg-emerald-green-500/20 text-emerald-green-400',
            yellow: 'bg-amber-yellow-500/20 text-amber-yellow-400',
          };

          return (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              className={`card-gradient p-6 text-left border bg-gradient-to-br transition-all duration-300 hover:scale-[1.02] hover:shadow-card-hover animate-stagger group ${colorClasses[action.color as keyof typeof colorClasses]}`}
              style={{ animationDelay: `${index * 80 + 500}ms` }}
            >
              <div className="flex items-start justify-between">
                <div className={`p-3 rounded-lg ${iconColorClasses[action.color as keyof typeof iconColorClasses]}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <ArrowRight className="w-5 h-5 text-deep-blue-400 group-hover:text-neon-purple-400 group-hover:translate-x-1 transition-all duration-200" />
              </div>
              <h3 className="font-display font-semibold text-white text-lg mt-4 mb-1">
                {action.title}
              </h3>
              <p className="text-deep-blue-300 text-sm">{action.description}</p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6 animate-stagger" style={{ animationDelay: '700ms' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display font-semibold text-white text-lg">情绪标签分布对比</h2>
            <div className="flex items-center gap-1 text-emerald-green-400 text-sm">
              <TrendingUp className="w-4 h-4" />
              <span>算法 vs 人工</span>
            </div>
          </div>
          {isLoading ? (
            <div className="h-80 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#475569" />
                <PolarAngleAxis dataKey="emotion" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <PolarRadiusAxis tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} />
                <Radar
                  name="算法标签"
                  dataKey="algorithm"
                  stroke="#9333EA"
                  fill="#9333EA"
                  fillOpacity={0.4}
                />
                <Radar
                  name="人工标签"
                  dataKey="manual"
                  stroke="#10B981"
                  fill="#10B981"
                  fillOpacity={0.4}
                />
                <Legend
                  wrapperStyle={{ color: '#CBD5E1' }}
                  iconType="circle"
                />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-6 animate-stagger" style={{ animationDelay: '800ms' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display font-semibold text-white text-lg">标签数量统计</h2>
          </div>
          {isLoading ? (
            <div className="h-80 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="emotion" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748B', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: '#CBD5E1',
                  }}
                />
                <Legend
                  wrapperStyle={{ color: '#CBD5E1' }}
                  iconType="circle"
                />
                <Bar dataKey="algorithm" name="算法标签" fill="#9333EA" radius={[4, 4, 0, 0]} />
                <Bar dataKey="manual" name="人工标签" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
