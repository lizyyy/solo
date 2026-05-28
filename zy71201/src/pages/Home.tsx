import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  AlertTriangle,
  TrendingDown,
  CheckCircle,
  Clock,
  Calendar,
  ChevronRight,
  Eye,
  Filter,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import type { ProductStatus, AnomalyType } from '../types';

const anomalyLabels: Record<AnomalyType, { label: string; color: string }> = {
  date_mismatch: { label: '日期错位', color: 'bg-danger text-white' },
  warning_line_changed: { label: '预警线变更', color: 'bg-warning text-white' },
  redemption_suspended: { label: '暂停赎回', color: 'bg-danger text-white' },
};

const statusLabels: Record<ProductStatus, { label: string; color: string }> = {
  normal: { label: '正常', color: 'bg-success/10 text-success' },
  warning: { label: '预警', color: 'bg-warning/10 text-warning' },
  stop_loss: { label: '止损', color: 'bg-danger/10 text-danger' },
};

export default function Home() {
  const navigate = useNavigate();
  const { products, filter, setFilter } = useStore();

  const stats = useMemo(() => {
    const total = products.length;
    const warning = products.filter(
      (p) => p.status === 'warning' || p.status === 'stop_loss'
    ).length;
    const anomaly = products.filter((p) => p.anomalies.length > 0).length;
    const normal = products.filter((p) => p.status === 'normal').length;
    return { total, warning, anomaly, normal };
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (filter.search) {
        const search = filter.search.toLowerCase();
        if (
          !p.name.toLowerCase().includes(search) &&
          !p.code.toLowerCase().includes(search) &&
          !p.manager.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      if (filter.status !== 'all' && p.status !== filter.status) {
        return false;
      }
      if (filter.anomalyType !== 'all') {
        if (!p.anomalies.some((a) => a.type === filter.anomalyType)) {
          return false;
        }
      }
      return true;
    });
  }, [products, filter]);

  const formatMoney = (num: number) => {
    if (num >= 100000000) return `${(num / 100000000).toFixed(2)}亿`;
    if (num >= 10000) return `${(num / 10000).toFixed(0)}万`;
    return num.toString();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="总产品数"
          value={stats.total}
          icon={CheckCircle}
          color="bg-navy-500"
        />
        <StatCard
          title="预警产品"
          value={stats.warning}
          icon={AlertTriangle}
          color="bg-warning"
        />
        <StatCard
          title="异常记录"
          value={stats.anomaly}
          icon={TrendingDown}
          color="bg-danger"
        />
        <StatCard
          title="正常运行"
          value={stats.normal}
          icon={Clock}
          color="bg-success"
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">产品列表</h2>
            <div className="flex items-center gap-3">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={filter.status}
                onChange={(e) =>
                  setFilter({ status: e.target.value as ProductStatus | 'all' })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
              >
                <option value="all">全部状态</option>
                <option value="normal">正常</option>
                <option value="warning">预警</option>
                <option value="stop_loss">止损</option>
              </select>
              <select
                value={filter.anomalyType}
                onChange={(e) =>
                  setFilter({ anomalyType: e.target.value as AnomalyType | 'all' })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
              >
                <option value="all">全部异常</option>
                <option value="date_mismatch">日期错位</option>
                <option value="warning_line_changed">预警线变更</option>
                <option value="redemption_suspended">暂停赎回</option>
              </select>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索产品名称、代码、基金经理..."
              value={filter.search}
              onChange={(e) => setFilter({ search: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  产品信息
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  最新净值
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  回撤率
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  预警线/止损线
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  异常
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map((product) => (
                <tr
                  key={product.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/product/${product.id}`)}
                >
                  <td className="px-4 py-4">
                    <div>
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                        <span>{product.code}</span>
                        <span>·</span>
                        <span>{product.manager}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatMoney(product.scale)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-semibold text-gray-900">
                      {product.latestNetValue.toFixed(4)}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        'font-semibold',
                        product.latestDrawdownRate < 0
                          ? 'text-danger'
                          : 'text-success'
                      )}
                    >
                      {product.latestDrawdownRate > 0 ? '+' : ''}
                      {product.latestDrawdownRate.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm">
                      <span className="text-warning">{product.warningLine.toFixed(2)}</span>
                      <span className="text-gray-400 mx-1">/</span>
                      <span className="text-danger">{product.stopLossLine.toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        'px-2.5 py-1 text-xs font-medium rounded-full',
                        statusLabels[product.status].color
                      )}
                    >
                      {statusLabels[product.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1">
                      {product.anomalies.map((anomaly, idx) => (
                        <span
                          key={idx}
                          className={cn(
                            'px-2 py-0.5 text-xs rounded animate-pulse-slow',
                            anomalyLabels[anomaly.type].color
                          )}
                        >
                          {anomalyLabels[anomaly.type].label}
                        </span>
                      ))}
                      {product.anomalies.length === 0 && (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      className="inline-flex items-center gap-1 text-navy-600 hover:text-navy-800 font-medium text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/product/${product.id}`);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                      详情
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredProducts.length === 0 && (
          <div className="py-12 text-center">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">没有找到匹配的产品</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
        </div>
        <div className={cn('p-3 rounded-lg text-white', color)}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
