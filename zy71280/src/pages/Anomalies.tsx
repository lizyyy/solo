import React, { useState } from 'react';
import { AlertTriangle, Filter, RefreshCw, BarChart3 } from 'lucide-react';
import { useAuctionStore } from '../store/useAuctionStore';
import { AnomalyCard } from '../components/AnomalyCard';
import { MetricCard } from '../components/MetricCard';
import { formatAnomalyType, formatSeverity, getSeverityColor } from '../utils/formatters';
import { cn } from '@/lib/utils';
import type { AnomalyType, AnomalySeverity } from '../types/auction';

const Anomalies: React.FC = () => {
  const { anomalies, detectAnomalies } = useAuctionStore();
  const [typeFilter, setTypeFilter] = useState<AnomalyType | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<AnomalySeverity | 'all'>('all');

  const filteredAnomalies = anomalies.filter(a => {
    if (typeFilter !== 'all' && a.type !== typeFilter) return false;
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    return true;
  });

  const stats = {
    total: anomalies.length,
    critical: anomalies.filter(a => a.severity === 'critical').length,
    high: anomalies.filter(a => a.severity === 'high').length,
    medium: anomalies.filter(a => a.severity === 'medium').length,
    low: anomalies.filter(a => a.severity === 'low').length,
  };

  const typeGroups: AnomalyType[] = ['sample_size', 'unsold_cost', 'commission_tier', 'data_quality'];
  const severityGroups: AnomalySeverity[] = ['critical', 'high', 'medium', 'low'];

  if (anomalies.length === 0) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              异常检测
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              检测样本量、流拍成本、佣金阶梯等异常情况
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertTriangle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-700">暂无检测结果</h2>
            <p className="mt-2 text-sm text-slate-500">请先导入数据，系统将自动检测异常</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            异常检测
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            检测样本量、流拍成本、佣金阶梯等异常情况，提供判断依据和修正建议
          </p>
        </div>
        <button
          onClick={detectAnomalies}
          className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-600 rounded-md hover:bg-slate-50 transition-colors text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          重新检测
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard
          title="异常总数"
          value={stats.total}
          subtitle="检测项"
          className={stats.total > 0 ? 'ring-2 ring-amber-400' : ''}
        />
        <MetricCard
          title="严重"
          value={stats.critical}
          subtitle="需立即处理"
          trend={stats.critical > 0 ? 'down' : 'neutral'}
        />
        <MetricCard
          title="高"
          value={stats.high}
          subtitle="建议处理"
          trend={stats.high > 0 ? 'down' : 'neutral'}
        />
        <MetricCard
          title="中"
          value={stats.medium}
          subtitle="关注即可"
        />
        <MetricCard
          title="低"
          value={stats.low}
          subtitle="无风险"
          trend="up"
        />
      </div>

      <div className="bg-white rounded-md border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">筛选：</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTypeFilter('all')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md border transition-colors',
                typeFilter === 'all'
                  ? 'bg-slate-800 text-amber-400 border-slate-800'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-amber-500 hover:text-amber-600'
              )}
            >
              全部类型
            </button>
            {typeGroups.map(type => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md border transition-colors',
                  typeFilter === type
                    ? 'bg-slate-800 text-amber-400 border-slate-800'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-amber-500 hover:text-amber-600'
                )}
              >
                {formatAnomalyType(type)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 md:ml-auto">
            <button
              onClick={() => setSeverityFilter('all')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md border transition-colors',
                severityFilter === 'all'
                  ? 'bg-slate-800 text-amber-400 border-slate-800'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-amber-500 hover:text-amber-600'
              )}
            >
              全部级别
            </button>
            {severityGroups.map(severity => (
              <button
                key={severity}
                onClick={() => setSeverityFilter(severity)}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md border transition-colors',
                  severityFilter === severity
                    ? getSeverityColor(severity) + ' border-transparent'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-amber-500 hover:text-amber-600'
                )}
              >
                {formatSeverity(severity)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-50 to-amber-50 rounded-md border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-amber-500" />
          异常分布统计
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {typeGroups.map(type => {
            const count = anomalies.filter(a => a.type === type).length;
            const maxCount = Math.max(...typeGroups.map(t => anomalies.filter(a => a.type === t).length), 1);
            return (
              <div key={type} className="bg-white rounded border border-slate-200 p-3">
                <p className="text-xs text-slate-500 mb-1">{formatAnomalyType(type)}</p>
                <p className="text-2xl font-bold text-slate-900 mb-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                  {count}
                </p>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-slate-600 to-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">
          检测结果 ({filteredAnomalies.length}项)
        </h3>
        {filteredAnomalies.length === 0 ? (
          <div className="bg-white rounded-md border border-slate-200 p-12 text-center">
            <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">没有符合筛选条件的异常项</p>
          </div>
        ) : (
          filteredAnomalies
            .sort((a, b) => {
              const severityOrder: Record<AnomalySeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
              return severityOrder[a.severity] - severityOrder[b.severity];
            })
            .map((anomaly, index) => (
              <AnomalyCard key={anomaly.id} anomaly={anomaly} index={index} />
            ))
        )}
      </div>

      <div className="bg-slate-800 rounded-md p-5 text-slate-300">
        <h3 className="text-sm font-semibold text-amber-400 mb-3">检测规则说明</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <h4 className="font-medium text-slate-200 mb-2">样本量检测</h4>
            <ul className="space-y-1 text-slate-400">
              <li>• 样本量 &lt; 10：严重警告，置信度 &lt; 70%</li>
              <li>• 样本量 &lt; 30：警告，置信度 &lt; 85%</li>
              <li>• 样本量 &lt; 50：提示，置信度 &lt; 95%</li>
              <li>• 独立买家 &lt; 3人：高风险</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-slate-200 mb-2">流拍成本检测</h4>
            <ul className="space-y-1 text-slate-400">
              <li>• 仓储成本、营销成本、机会成本缺项检测</li>
              <li>• 重拍次数 ≥ 2次标记为高风险</li>
              <li>• 累计成本超过估值20%标记</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-slate-200 mb-2">佣金阶梯检测</h4>
            <ul className="space-y-1 text-slate-400">
              <li>• 阶梯区间与行业标准对比</li>
              <li>• 佣金比例偏离 ±3% 标记</li>
              <li>• 阶梯倒转（高金额高佣金）严重错误</li>
              <li>• 阶梯断点（区间不连续）错误</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-slate-200 mb-2">数据质量检测</h4>
            <ul className="space-y-1 text-slate-400">
              <li>• 成交价偏离保留价 ±10% 标记</li>
              <li>• 买家活跃度为0标记</li>
              <li>• 关键字段缺失标记</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Anomalies;
