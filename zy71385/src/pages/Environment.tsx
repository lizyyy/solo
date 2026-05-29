import { useState, useEffect } from 'react';
import { Server, RefreshCw, AlertTriangle, CheckCircle, XCircle, Users, TrendingUp, Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useFlagStore } from '../store/flagStore';
import { Card } from '../components/Card';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { RiskBadge } from '../components/RiskBadge';
import { formatDateTime } from '../utils/dateUtils';
import type { Environment } from '../types';

export function EnvironmentPage() {
  const {
    flags,
    environmentStatuses,
    initData,
    loading,
  } = useFlagStore();

  const [selectedEnv, setSelectedEnv] = useState<Environment | 'all'>('all');

  useEffect(() => {
    if (flags.length === 0) initData();
  }, [flags.length, initData]);

  const envs: Environment[] = ['dev', 'staging', 'production'];
  
  const envStats = envs.map(env => {
    const statuses = environmentStatuses.filter(e => e.environment === env);
    return {
      env,
      total: statuses.length,
      enabled: statuses.filter(s => s.enabled).length,
      disabled: statuses.filter(s => !s.enabled).length,
      withGray: statuses.filter(s => s.grayUsers > 0).length,
      totalGrayUsers: statuses.reduce((sum, s) => sum + s.grayUsers, 0),
    };
  });

  const inconsistentFlags = flags.filter(f => {
    const statuses = environmentStatuses.filter(e => e.flagId === f.id);
    if (statuses.length < 2) return false;
    const firstEnabled = statuses[0].enabled;
    const firstValue = statuses[0].value;
    return statuses.some(s => s.enabled !== firstEnabled || s.value !== firstValue);
  });

  const highGrayFlags = flags.filter(f => {
    const prodStatus = environmentStatuses.find(e => e.flagId === f.id && e.environment === 'production');
    return prodStatus && prodStatus.grayUsers > 10;
  });

  const barData = envStats.map(stat => ({
    name: stat.env === 'dev' ? '开发环境' : stat.env === 'staging' ? '预发布' : '生产环境',
    已启用: stat.enabled,
    已禁用: stat.disabled,
    有灰度: stat.withGray,
  }));

  const filteredFlags = selectedEnv === 'all'
    ? flags
    : flags.filter(f => environmentStatuses.some(e => e.flagId === f.id && e.environment === selectedEnv));

  return (
    <div className="space-y-6">
      {loading && <LoadingOverlay message="正在加载..." />}
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">环境状态对比</h1>
          <p className="text-gray-500 mt-1">对比各环境配置差异，检测灰度用户和异常状态</p>
        </div>
        <button className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          同步环境状态
        </button>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {envStats.map((stat) => (
          <Card
            key={stat.env}
            title={stat.env === 'dev' ? '开发环境' : stat.env === 'staging' ? '预发布环境' : '生产环境'}
            value={stat.total}
            icon={<Server className="w-6 h-6" />}
            color={stat.env === 'production' ? 'red' : stat.env === 'staging' ? 'orange' : 'green'}
            trend={`${stat.enabled} 个已启用, ${stat.totalGrayUsers} 位灰度用户`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">环境开关分布</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="已启用" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="已禁用" fill="#6B7280" radius={[4, 4, 0, 0]} />
                <Bar dataKey="有灰度" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-red-100 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{inconsistentFlags.length}</p>
                <p className="text-sm text-gray-500">环境不一致</p>
              </div>
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-orange-100 rounded-xl">
                <Users className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{highGrayFlags.length}</p>
                <p className="text-sm text-gray-500">高灰度用户</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-green-100 rounded-xl">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {flags.filter(f => {
                    const statuses = environmentStatuses.filter(e => e.flagId === f.id);
                    return statuses.every(s => s.enabled && s.grayPercentage === 100 && s.grayUsers === 0);
                  }).length}
                </p>
                <p className="text-sm text-gray-500">全量稳定运行</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {highGrayFlags.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-risk-medium" />
              <h2 className="text-lg font-semibold text-gray-900">灰度用户告警</h2>
            </div>
          </div>
          <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 mb-4">
            <div className="flex items-start gap-3">
              <Users className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-orange-800 mb-1">灰度用户仍在使用提示</p>
                <p className="text-sm text-orange-700 leading-relaxed">
                  ⚠️ 以下开关在生产环境仍有较多灰度用户，直接删除可能影响这部分用户体验。
                  建议先全量或灰度下线后再清理。
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {highGrayFlags.map(flag => {
              const prodStatus = environmentStatuses.find(e => e.flagId === flag.id && e.environment === 'production');
              return (
                <div key={flag.id} className="p-4 bg-gray-50 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{flag.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{flag.key}</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-lg font-bold text-orange-600">{prodStatus?.grayUsers} 人</p>
                      <p className="text-xs text-gray-400">灰度用户</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-700">{prodStatus?.grayPercentage.toFixed(1)}%</p>
                      <p className="text-xs text-gray-400">灰度比例</p>
                    </div>
                    {flag.riskLevel && <RiskBadge level={flag.riskLevel} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">环境状态详情</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedEnv('all')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                selectedEnv === 'all'
                  ? 'bg-primary-100 text-primary-700 font-medium'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              全部
            </button>
            {envs.map(env => (
              <button
                key={env}
                onClick={() => setSelectedEnv(env)}
                className={`px-3 py-1.5 text-sm rounded-lg capitalize transition-colors ${
                  selectedEnv === env
                    ? 'bg-primary-100 text-primary-700 font-medium'
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                {env === 'dev' ? '开发' : env === 'staging' ? '预发布' : '生产'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header">开关名称</th>
                {envs.map(env => (
                  <th key={env} className="table-header capitalize">
                    {env === 'dev' ? '开发环境' : env === 'staging' ? '预发布' : '生产环境'}
                  </th>
                ))}
                <th className="table-header">风险等级</th>
                <th className="table-header">最近检查</th>
              </tr>
            </thead>
            <tbody>
              {filteredFlags.slice(0, 15).map(flag => {
                const statuses = environmentStatuses.filter(e => e.flagId === flag.id);
                const hasInconsistency = inconsistentFlags.some(f => f.id === flag.id);
                
                return (
                  <tr key={flag.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    hasInconsistency ? 'bg-orange-50/50' : ''
                  }`}>
                    <td className="table-cell">
                      <div>
                        <p className="font-medium text-gray-900">{flag.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{flag.key}</p>
                        {hasInconsistency && (
                          <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            环境不一致
                          </p>
                        )}
                      </div>
                    </td>
                    {envs.map(env => {
                      const status = statuses.find(s => s.environment === env);
                      return (
                        <td key={env} className="table-cell">
                          <div className="flex items-center gap-2">
                            {status?.enabled ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-gray-400" />
                            )}
                            <span className="font-mono text-sm">{status?.value || '-'}</span>
                            {status?.grayUsers > 0 && (
                              <span className="text-xs text-orange-600">
                                ({status.grayUsers}人)
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="table-cell">
                      {flag.riskLevel && <RiskBadge level={flag.riskLevel} />}
                    </td>
                    <td className="table-cell text-gray-500 text-sm">
                      {formatDateTime(statuses[0]?.lastChecked || new Date())}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
