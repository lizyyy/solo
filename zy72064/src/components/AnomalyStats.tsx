import { AlertTriangle, CheckCircle, Clock, MapPin, Users, Image, Layers, Globe } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { ANOMALY_LABELS } from '@/types';
import type { AnomalyType, PointStatus } from '@/types';

const anomalyIcons: Record<AnomalyType, typeof AlertTriangle> = {
  coordinate_offset: MapPin,
  duplicate_name: Users,
  missing_photo: Image,
  cross_floor: Layers,
  coordinate_mismatch: Globe,
};

const statusIcons: Record<PointStatus, typeof CheckCircle> = {
  normal: CheckCircle,
  pending: Clock,
  anomaly: AlertTriangle,
};

const statusColors: Record<PointStatus, string> = {
  normal: 'text-green-600 bg-green-50 border-green-200',
  pending: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  anomaly: 'text-red-600 bg-red-50 border-red-200',
};

export function AnomalyStats() {
  const { points, getAnomalyStats, setFilterStatus, setFilterAnomaly, filterStatus, filterAnomaly } = useStore();
  const anomalyStats = getAnomalyStats();

  const statusCounts: Record<PointStatus, number> = {
    normal: points.filter((p) => p.status === 'normal').length,
    pending: points.filter((p) => p.status === 'pending').length,
    anomaly: points.filter((p) => p.status === 'anomaly').length,
  };

  const handleStatusClick = (status: PointStatus | 'all') => {
    setFilterStatus(filterStatus === status ? 'all' : status);
    if (status !== 'all') setFilterAnomaly('all');
  };

  const handleAnomalyClick = (type: AnomalyType) => {
    const newFilter = filterAnomaly === type ? 'all' : type;
    setFilterAnomaly(newFilter);
    if (newFilter !== 'all') setFilterStatus('all');
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-primary-700 font-serif">异常概览</h3>
      
      <div className="grid grid-cols-3 gap-3">
        {(Object.keys(statusCounts) as PointStatus[]).map((status) => {
          const Icon = statusIcons[status];
          const count = statusCounts[status];
          const isActive = filterStatus === status;
          const labels: Record<PointStatus, string> = { normal: '正常', pending: '待确认', anomaly: '异常' };
          
          return (
            <button
              key={status}
              onClick={() => handleStatusClick(status)}
              className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                isActive ? 'ring-2 ring-primary-400 ring-offset-1' : ''
              } ${statusColors[status]} hover:shadow-md`}
            >
              <div className="flex items-center gap-2">
                <Icon className="w-5 h-5" />
                <div className="text-left">
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs opacity-75">{labels[status]}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="pt-2 border-t border-gray-100">
        <div className="text-sm text-gray-500 mb-2">异常类型分布</div>
        <div className="space-y-2">
          {(Object.entries(anomalyStats) as [AnomalyType, number][]).map(([type, count]) => {
            if (count === 0) return null;
            const Icon = anomalyIcons[type];
            const isActive = filterAnomaly === type;
            
            return (
              <button
                key={type}
                onClick={() => handleAnomalyClick(type)}
                className={`w-full flex items-center justify-between p-2 rounded-md text-sm transition-all ${
                  isActive
                    ? 'bg-orange-100 text-orange-800 border border-orange-300'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span>{ANOMALY_LABELS[type]}</span>
                </div>
                <span className="font-semibold">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-2">
        <div className="text-xs text-gray-400 mb-2">总计 {points.length} 个点位</div>
        {(filterStatus !== 'all' || filterAnomaly !== 'all') && (
          <button
            onClick={() => {
              setFilterStatus('all');
              setFilterAnomaly('all');
            }}
            className="text-xs text-primary-500 hover:text-primary-700 underline"
          >
            清除筛选条件
          </button>
        )}
      </div>
    </div>
  );
}
