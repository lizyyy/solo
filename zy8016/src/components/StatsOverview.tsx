import React from 'react';
import { 
  AnalysisResult,
  ResourceType,
} from '@/types';
import { formatBytes, formatMilliseconds } from '@/utils/harParser';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Activity,
  HardDrive,
  Clock,
  Server,
  AlertTriangle,
  CheckCircle,
  Info,
} from 'lucide-react';
import { clsx } from 'clsx';

interface StatsOverviewProps {
  analysisResult: AnalysisResult;
}

const resourceTypeNames: Record<ResourceType, string> = {
  document: '文档',
  stylesheet: '样式表',
  script: '脚本',
  image: '图片',
  font: '字体',
  media: '媒体',
  xhr: 'XHR',
  fetch: 'Fetch',
  websocket: 'WebSocket',
  other: '其他',
};

const resourceTypeColors: Record<ResourceType, string> = {
  document: '#3b82f6',
  stylesheet: '#8b5cf6',
  script: '#ec4899',
  image: '#10b981',
  font: '#f59e0b',
  media: '#ef4444',
  xhr: '#6366f1',
  fetch: '#14b8a6',
  websocket: '#84cc16',
  other: '#6b7280',
};

const StatCard: React.FC<{
  title: string;
  value: string;
  icon: React.ReactNode;
  subtitle?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}> = ({ title, value, icon, subtitle, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={clsx("p-3 rounded-lg", colorClasses[color])}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export const StatsOverview: React.FC<StatsOverviewProps> = ({ analysisResult }) => {
  const { pageInfo, resourceTypeStats, cacheStats, thirdPartyStats, timingStats, issues } = analysisResult;

  const issuesBySeverity = {
    errors: issues.filter(i => i.severity === 'error').length,
    warnings: issues.filter(i => i.severity === 'warning').length,
    infos: issues.filter(i => i.severity === 'info').length,
  };

  const pieChartData = Object.entries(resourceTypeStats)
    .filter(([_, stats]) => stats.count > 0)
    .map(([type, stats]) => ({
      name: resourceTypeNames[type as ResourceType],
      value: stats.size,
      count: stats.count,
      color: resourceTypeColors[type as ResourceType],
    }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="总请求数"
          value={pageInfo.totalRequests.toString()}
          subtitle={`${thirdPartyStats.totalCount} 个第三方请求`}
          icon={<Activity size={24} />}
          color="blue"
        />
        <StatCard
          title="总传输大小"
          value={formatBytes(pageInfo.totalTransferSize)}
          subtitle={`压缩前: ${formatBytes(pageInfo.totalSize)}`}
          icon={<HardDrive size={24} />}
          color="purple"
        />
        <StatCard
          title="onLoad 时间"
          value={formatMilliseconds(timingStats.onLoad)}
          subtitle={`DCL: ${formatMilliseconds(timingStats.domContentLoaded)}`}
          icon={<Clock size={24} />}
          color={timingStats.onLoad > 3000 ? 'red' : 'green'}
        />
        <StatCard
          title="性能问题"
          value={issues.length.toString()}
          subtitle={`${issuesBySeverity.errors} 错误, ${issuesBySeverity.warnings} 警告`}
          icon={
            issuesBySeverity.errors > 0 ? (
              <AlertTriangle size={24} />
            ) : issuesBySeverity.warnings > 0 ? (
              <Info size={24} />
            ) : (
              <CheckCircle size={24} />
            )
          }
          color={
            issuesBySeverity.errors > 0 ? 'red' : 
            issuesBySeverity.warnings > 0 ? 'yellow' : 'green'
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">资源类型分布</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatBytes(value)}
                    labelFormatter={(name) => name}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 overflow-y-auto max-h-64 scrollbar-thin">
              {pieChartData.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-gray-700">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-800">{item.count} 个</div>
                    <div className="text-xs text-gray-500">{formatBytes(item.value)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">缓存统计</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">缓存命中</span>
                <span className="text-sm font-medium text-green-600">
                  {cacheStats.hitCount} ({cacheStats.hitRate.toFixed(1)}%)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">缓存未命中</span>
                <span className="text-sm font-medium text-red-600">
                  {cacheStats.missCount}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">无缓存</span>
                <span className="text-sm font-medium text-gray-500">
                  {cacheStats.noneCount}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${cacheStats.hitRate}%` }}
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">第三方资源</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">域名数量</span>
                <span className="text-sm font-medium text-gray-800">
                  {thirdPartyStats.domains.length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">请求数</span>
                <span className="text-sm font-medium text-gray-800">
                  {thirdPartyStats.totalCount}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">总大小</span>
                <span className="text-sm font-medium text-gray-800">
                  {formatBytes(thirdPartyStats.totalSize)}
                </span>
              </div>
              {thirdPartyStats.domains.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-500 mb-1">主要第三方域名:</p>
                  {thirdPartyStats.domains.slice(0, 3).map((domain, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-gray-600 truncate max-w-[150px]">{domain.domain}</span>
                      <span className="text-gray-800">{formatBytes(domain.size)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">时间统计</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 mb-1">DOMContentLoaded</p>
            <p className="text-xl font-bold text-blue-600">
              {formatMilliseconds(timingStats.domContentLoaded)}
            </p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 mb-1">onLoad</p>
            <p className="text-xl font-bold text-purple-600">
              {formatMilliseconds(timingStats.onLoad)}
            </p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 mb-1">最长请求时间</p>
            <p className="text-xl font-bold text-red-600">
              {formatMilliseconds(timingStats.longestRequest)}
            </p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 mb-1">平均请求时间</p>
            <p className="text-xl font-bold text-green-600">
              {formatMilliseconds(timingStats.avgRequestTime)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsOverview;
