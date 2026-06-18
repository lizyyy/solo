import { useAppStore } from '@/store/useAppStore';
import OceanMap from '@/components/map/OceanMap';
import StationDetailPanel from '@/components/map/StationDetailPanel';
import { SeverityBadge, AnomalyTypeBadge, StatusBadge } from '@/components/common/Badges';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  TrendingUp,
  ArrowRight,
  MapPin,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { anomalyTypeLabels } from '@/utils/anomalyDetector';

export default function Dashboard() {
  const { anomalies, materials, stations, getFilteredAnomalies, selectAnomaly } = useAppStore();
  const navigate = useNavigate();

  const totalAnomalies = anomalies.length;
  const confirmedCount = anomalies.filter(a => a.status === 'confirmed').length;
  const pendingCount = anomalies.filter(a => a.status === 'pending').length;
  const highCount = anomalies.filter(a => a.severity === 'high').length;

  const typeStats = [
    { type: 'unit_mismatch', count: anomalies.filter(a => a.type === 'unit_mismatch').length, icon: FileText },
    { type: 'caliber_change', count: anomalies.filter(a => a.type === 'caliber_change').length, icon: TrendingUp },
    { type: 'time_mismatch', count: anomalies.filter(a => a.type === 'time_mismatch').length, icon: Clock },
  ];

  const recentAnomalies = [...anomalies]
    .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
    .slice(0, 5);

  const statCards = [
    {
      label: '异常总数',
      value: totalAnomalies,
      icon: AlertTriangle,
      color: 'text-alert-orange',
      bgColor: 'bg-alert-orange/10',
      borderColor: 'border-alert-orange/20',
    },
    {
      label: '高风险',
      value: highCount,
      icon: AlertTriangle,
      color: 'text-red-500',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
    },
    {
      label: '已确认',
      value: confirmedCount,
      icon: CheckCircle,
      color: 'text-alert-green',
      bgColor: 'bg-alert-green/10',
      borderColor: 'border-alert-green/20',
    },
    {
      label: '待补证据',
      value: pendingCount,
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-ocean-800">空间预警总览</h2>
          <p className="text-sm text-ocean-500 mt-1">
            基于 {materials.length} 份材料 · {stations.length} 个监测点位 · 自动检测异常
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-ocean-500">上次检测：今天 19:20</span>
          <button
            onClick={() => navigate('/anomalies')}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            查看全部异常
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              className={`card-base card-hover p-4 border ${card.borderColor} animate-fade-in-up stagger-${index + 1}`}
              style={{ opacity: 0 }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-ocean-600">{card.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</p>
                </div>
                <div className={`p-2.5 rounded-lg ${card.bgColor}`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-ocean-100">
                <span className="text-xs text-ocean-500">较上版</span>
                <span className="text-xs font-medium text-alert-orange ml-1">+2 条</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="card-base h-[480px] p-4 animate-fade-in-up stagger-3" style={{ opacity: 0 }}>
            <OceanMap />
          </div>
        </div>

        <div className="space-y-6">
          <div className="animate-fade-in-up stagger-4" style={{ opacity: 0 }}>
            <StationDetailPanel />
          </div>

          <div className="card-base p-4 animate-fade-in-up stagger-5" style={{ opacity: 0 }}>
            <h3 className="text-sm font-semibold text-ocean-700 mb-3">异常类型分布</h3>
            <div className="space-y-3">
              {typeStats.map((item, i) => {
                const Icon = item.icon;
                const percentage = totalAnomalies > 0 ? (item.count / totalAnomalies) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-ocean-500" />
                        <span className="text-sm text-ocean-700">{anomalyTypeLabels[item.type]}</span>
                      </div>
                      <span className="text-sm font-semibold text-ocean-800">{item.count}</span>
                    </div>
                    <div className="h-1.5 bg-ocean-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-ocean-500 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="card-base p-4 animate-fade-in-up stagger-6" style={{ opacity: 0 }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-ocean-700">最新异常记录</h3>
          <button
            onClick={() => navigate('/anomalies')}
            className="text-xs text-ocean-500 hover:text-ocean-700 flex items-center gap-1"
          >
            查看全部
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ocean-100">
                <th className="text-left py-2.5 px-3 font-medium text-ocean-600 text-xs uppercase tracking-wider">异常类型</th>
                <th className="text-left py-2.5 px-3 font-medium text-ocean-600 text-xs uppercase tracking-wider">点位</th>
                <th className="text-left py-2.5 px-3 font-medium text-ocean-600 text-xs uppercase tracking-wider">描述</th>
                <th className="text-left py-2.5 px-3 font-medium text-ocean-600 text-xs uppercase tracking-wider">严重度</th>
                <th className="text-left py-2.5 px-3 font-medium text-ocean-600 text-xs uppercase tracking-wider">状态</th>
                <th className="text-left py-2.5 px-3 font-medium text-ocean-600 text-xs uppercase tracking-wider">来源行</th>
              </tr>
            </thead>
            <tbody>
              {recentAnomalies.map((anomaly) => (
                <tr
                  key={anomaly.id}
                  className="border-b border-ocean-50 hover:bg-ocean-50/50 cursor-pointer transition-colors"
                  onClick={() => {
                    selectAnomaly(anomaly.id);
                    navigate('/review');
                  }}
                >
                  <td className="py-3 px-3">
                    <AnomalyTypeBadge type={anomaly.type} />
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-ocean-400" />
                      <span className="text-ocean-700">{anomaly.stationName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-ocean-600 max-w-xs truncate">{anomaly.description}</td>
                  <td className="py-3 px-3">
                    <SeverityBadge severity={anomaly.severity} size="sm" />
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge status={anomaly.status} />
                  </td>
                  <td className="py-3 px-3 text-ocean-500 text-xs">
                    第 {anomaly.sourceRows.join(', ')} 行
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
