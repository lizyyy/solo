import { useEffect, useRef, useState } from 'react';
import { useAppStore, formatAmount, formatDate, getRiskLevelText } from '../store';
import { riskApi, versionApi } from '../services/apiClient';
import { PageLoading } from '../components/LoadingSpinner';
import { RiskBadge, RiskScoreBadge } from '../components/RiskBadge';
import { TrendingUp, Users, ShieldAlert, AlertTriangle, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { RiskAnalysisResult, OperationLog, DataImportWarning } from '../../shared/types';

export function Dashboard() {
  const setDashboardStats = useAppStore((state) => state.setDashboardStats);
  const setActiveVersion = useAppStore((state) => state.setActiveVersion);
  const setVersions = useAppStore((state) => state.setVersions);
  const dashboardStats = useAppStore((state) => state.dashboardStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const loadData = async () => {
      setLoading(true);
      try {
        const [statsRes, versionRes] = await Promise.all([
          riskApi.getDashboard(),
          versionApi.getActiveSnapshot(),
        ]);

        if (statsRes.data) {
          setDashboardStats(statsRes.data);
        }
        if (versionRes.data) {
          setActiveVersion(versionRes.data);
        }

        const allVersionsRes = await versionApi.listSnapshots(20);
        if (allVersionsRes.data) {
          setVersions(allVersionsRes.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [setDashboardStats, setActiveVersion, setVersions]);

  if (loading && !dashboardStats) {
    return <PageLoading message="加载仪表盘..." />;
  }

  if (error && !dashboardStats) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
        <p className="text-gray-600 font-medium">加载失败</p>
        <p className="text-sm text-gray-500 mt-1">{error}</p>
      </div>
    );
  }

  const statsData = dashboardStats;

  if (!statsData) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="font-medium text-gray-700">暂无数据</p>
        <p className="text-sm mt-1">请先导入数据并执行风险分析</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">仪表盘</h1>
          <p className="text-gray-500 mt-1">担保圈授信风险总览</p>
        </div>
        {statsData.recentOperations && statsData.recentOperations.length > 0 && (
          <div className="text-sm text-gray-500">
            <Clock className="w-4 h-4 inline mr-1" />
            最近更新：{formatDate(statsData.recentOperations[0].timestamp)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="客户总数"
          value={statsData.totalCustomers?.toLocaleString() || '0'}
          icon={Users}
          trend="up"
          trendValue="+5%"
          color="primary"
        />
        <StatCard
          title="担保合同数"
          value={statsData.totalGuarantees?.toLocaleString() || '0'}
          icon={ShieldAlert}
          trend="down"
          trendValue="-2%"
          color="green"
        />
        <StatCard
          title="总风险暴露"
          value={`${formatAmount(statsData.totalExposure || 0)}万`}
          icon={TrendingUp}
          trend="up"
          trendValue="+8%"
          color="amber"
        />
        <StatCard
          title="高/极高风险客户"
          value={(statsData.highRiskCount || 0) + (statsData.criticalRiskCount || 0)}
          icon={AlertTriangle}
          trend="down"
          trendValue="-10%"
          color="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">风险分布</h3>
            <RiskDistributionChart />
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">待处理任务</h3>
            {statsData.pendingTasks ? (
              <div className="text-center py-4">
                <p className="text-3xl font-bold text-primary-600">{statsData.pendingTasks}</p>
                <p className="text-sm text-gray-500 mt-1">个待处理任务</p>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="font-medium">暂无待处理任务</p>
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">风险等级统计</h3>
            <RiskLevelBreakdown stats={statsData} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">最近操作</h3>
          <RecentOperations logs={statsData.recentOperations || []} />
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">最近异常</h3>
          <RecentAnomalies anomalies={statsData.recentAnomalies || []} />
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: 'up' | 'down';
  trendValue?: string;
  color: 'primary' | 'green' | 'amber' | 'red';
}

function StatCard({ title, value, icon: Icon, trend, trendValue, color }: StatCardProps) {
  const colorClasses = {
    primary: 'bg-primary-100 text-primary-600',
    green: 'bg-green-100 text-green-600',
    amber: 'bg-amber-100 text-amber-600',
    red: 'bg-red-100 text-red-600',
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {trend && trendValue && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${
              trend === 'up' ? 'text-green-600' : 'text-red-600'
            }`}>
              {trend === 'up' ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
              {trendValue}
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

function RiskDistributionChart() {
  const riskResults = useAppStore((state) => state.riskResults);
  const riskResultsLoading = useAppStore((state) => state.riskResultsLoading);
  const setRiskResults = useAppStore((state) => state.setRiskResults);
  const setRiskResultsLoading = useAppStore((state) => state.setRiskResultsLoading);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    if (riskResults.length > 0) {
      hasLoadedRef.current = true;
      return;
    }
    
    const loadData = async () => {
      hasLoadedRef.current = true;
      setRiskResultsLoading(true);
      const res = await riskApi.getResults();
      if (res.success && res.data) {
        setRiskResults(res.data.slice(0, 10));
      }
      setRiskResultsLoading(false);
    };
    loadData();
  }, []);

  if (riskResults.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        暂无风险分析结果，请先执行风险分析
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {riskResults.slice(0, 8).map((result) => (
        <RiskResultItem key={result.customerId} result={result} />
      ))}
    </div>
  );
}

function RiskResultItem({ result }: { result: RiskAnalysisResult }) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
      <RiskScoreBadge score={result.riskScore} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-gray-900 truncate">{result.customerName}</p>
          <RiskBadge level={result.overallRiskLevel} size="sm" />
        </div>
        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
          <span>风险暴露：{formatAmount(result.totalExposure)}万</span>
          <span>集中度：{(result.creditConcentration * 100).toFixed(0)}%</span>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-gray-700">
          {getRiskLevelText(result.overallRiskLevel)}风险
        </p>
        <p className="text-xs text-gray-500">
          {formatDate(result.calculationTime)}
        </p>
      </div>
    </div>
  );
}

function RiskLevelBreakdown({ stats }: { stats: any }) {
  const levels = [
    { key: 'critical', label: '极高', count: stats?.criticalRiskCount || 0, color: 'bg-risk-critical' },
    { key: 'high', label: '高', count: stats?.highRiskCount || 0, color: 'bg-risk-high' },
    { key: 'medium', label: '中', count: stats?.mediumRiskCount || 0, color: 'bg-risk-medium' },
    { key: 'low', label: '低', count: stats?.lowRiskCount || 0, color: 'bg-risk-low' },
  ];

  const total = levels.reduce((sum, l) => sum + l.count, 0) || 1;

  return (
    <div className="space-y-3">
      {levels.map((level) => (
        <div key={level.key}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">{level.label}风险</span>
            <span className="font-medium text-gray-900">{level.count}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${level.color} transition-all duration-500`}
              style={{ width: `${(level.count / total) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentOperations({ logs }: { logs: OperationLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>暂无操作记录</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-72 overflow-y-auto scrollbar-thin">
      {logs.slice(0, 6).map((log) => (
        <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50">
          <div className="w-2 h-2 mt-2 rounded-full bg-primary-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800">{log.description}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <span>{log.operator}</span>
              <span>•</span>
              <span>{formatDate(log.timestamp)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentAnomalies({ anomalies }: { anomalies: DataImportWarning[] }) {
  if (anomalies.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>暂无异常记录</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-72 overflow-y-auto scrollbar-thin">
      {anomalies.slice(0, 6).map((anomaly) => (
        <div
          key={anomaly.id}
          className={`p-3 rounded-lg border ${
            anomaly.severity === 'error'
              ? 'bg-red-50 border-red-100'
              : anomaly.severity === 'warning'
              ? 'bg-amber-50 border-amber-100'
              : 'bg-blue-50 border-blue-100'
          }`}
        >
          <p className="text-sm font-medium text-gray-800">{anomaly.message}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            {anomaly.sourceFile && <span>文件：{anomaly.sourceFile}</span>}
            {anomaly.rowNumber && <span>行：{anomaly.rowNumber}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
