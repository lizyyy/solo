import { useQuery } from 'react-query';
import { getStats } from '../api';
import { Stats } from '../types';

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<Stats>('stats', getStats, {
    refetchInterval: 5000,
  });

  if (isLoading) {
    return <div className="text-center py-12">加载中...</div>;
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      scanned: 'bg-green-100 text-green-800',
      quarantined: 'bg-red-100 text-red-800',
      released: 'bg-yellow-100 text-yellow-800',
      pending: 'bg-gray-100 text-gray-800',
      rolled_back: 'bg-orange-100 text-orange-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getThreatColor = (threat: string) => {
    const colors: Record<string, string> = {
      safe: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      critical: 'bg-red-100 text-red-800',
    };
    return colors[threat] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">📊 仪表盘</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-500 text-sm font-medium">总任务数</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">{stats?.total_tasks || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-500 text-sm font-medium">安全日志数</h3>
          <p className="text-3xl font-bold text-purple-600 mt-2">{stats?.total_logs || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-500 text-sm font-medium">安全文件</h3>
          <p className="text-3xl font-bold text-green-600 mt-2">{stats?.threat_counts?.safe || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-500 text-sm font-medium">需处理威胁</h3>
          <p className="text-3xl font-bold text-red-600 mt-2">
            {(stats?.threat_counts?.warning || 0) + (stats?.threat_counts?.critical || 0)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">任务状态分布</h3>
          <div className="space-y-3">
            {stats?.status_counts && Object.entries(stats.status_counts).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(status)}`}>
                  {status}
                </span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">威胁等级分布</h3>
          <div className="space-y-3">
            {stats?.threat_counts && Object.entries(stats.threat_counts).map(([threat, count]) => (
              <div key={threat} className="flex items-center justify-between">
                <span className={`px-3 py-1 rounded-full text-sm ${getThreatColor(threat)}`}>
                  {threat}
                </span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">日志严重级别分布</h3>
        <div className="flex flex-wrap gap-4">
          {stats?.severity_counts && Object.entries(stats.severity_counts).map(([severity, count]) => (
            <div key={severity} className="flex-1 min-w-[150px] bg-gray-50 rounded-lg p-4">
              <span className={`inline-block px-3 py-1 rounded-full text-sm mb-2 ${getThreatColor(severity)}`}>
                {severity}
              </span>
              <p className="text-2xl font-bold">{count}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
