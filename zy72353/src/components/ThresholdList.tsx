import { useNavigate } from 'react-router-dom';
import { Eye, AlertTriangle, CheckCircle, Clock, XCircle, Thermometer } from 'lucide-react';
import { useThresholdStore } from '../store/thresholdStore';
import type { ThresholdData, ThresholdStatus } from '../types';
import { cn } from '../lib/utils';

interface ThresholdListProps {
  filter?: 'all' | 'unitMix' | 'pending' | 'approved';
}

const statusConfig: Record<ThresholdStatus, { label: string; color: string; icon: any }> = {
  pending: { label: '待处理', color: 'bg-warning-500/20 text-warning-400 border-warning-500/30', icon: Clock },
  reviewing: { label: '复核中', color: 'bg-primary-500/20 text-primary-400 border-primary-500/30', icon: Clock },
  approved: { label: '已通过', color: 'bg-success-500/20 text-success-400 border-success-500/30', icon: CheckCircle },
  rejected: { label: '已拒绝', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
  needs_manual: { label: '待人工复核', color: 'bg-warning-500/20 text-warning-400 border-warning-500/30', icon: AlertTriangle },
};

const ThresholdList = ({ filter = 'all' }: ThresholdListProps) => {
  const navigate = useNavigate();
  const { thresholds, getDeviceById } = useThresholdStore();

  const filteredThresholds = thresholds.filter((t) => {
    if (filter === 'unitMix') return t.hasUnitMix;
    if (filter === 'pending') return t.status === 'pending' || t.status === 'reviewing';
    if (filter === 'approved') return t.status === 'approved';
    return true;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatUnit = (unit: string) => {
    return unit === 'Celsius' ? '℃' : 'K';
  };

  return (
    <div className="bg-industrial-600 rounded-xl border border-industrial-500 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-industrial-700/50">
              <th className="text-left px-6 py-4 text-industrial-200 font-medium text-sm">阈值名称</th>
              <th className="text-left px-6 py-4 text-industrial-200 font-medium text-sm">数值</th>
              <th className="text-left px-6 py-4 text-industrial-200 font-medium text-sm">设备</th>
              <th className="text-left px-6 py-4 text-industrial-200 font-medium text-sm">状态</th>
              <th className="text-left px-6 py-4 text-industrial-200 font-medium text-sm">异常</th>
              <th className="text-left px-6 py-4 text-industrial-200 font-medium text-sm">更新时间</th>
              <th className="text-left px-6 py-4 text-industrial-200 font-medium text-sm">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-industrial-500">
            {filteredThresholds.map((threshold) => {
              const device = getDeviceById(threshold.deviceId);
              const status = statusConfig[threshold.status];
              const StatusIcon = status.icon;

              return (
                <tr
                  key={threshold.id}
                  className="hover:bg-industrial-700/30 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        threshold.hasUnitMix ? "bg-warning-500/20" : "bg-primary-500/20"
                      )}>
                        <Thermometer className={cn(
                          "w-5 h-5",
                          threshold.hasUnitMix ? "text-warning-400" : "text-primary-400"
                        )} />
                      </div>
                      <div>
                        <p className="text-white font-medium">{threshold.name}</p>
                        <p className="text-industrial-400 text-xs">ID: {threshold.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-lg text-white">
                      {threshold.value}
                    </span>
                    <span className="text-industrial-300 ml-1">
                      {formatUnit(threshold.unit)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-white">{device?.name || '-'}</p>
                    <p className="text-industrial-400 text-xs">{device?.model || '-'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border",
                      status.color
                    )}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {status.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {threshold.hasUnitMix ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-warning-500/20 text-warning-400 border border-warning-500/30 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        单位混用
                      </span>
                    ) : (
                      <span className="text-industrial-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-industrial-300 text-sm">
                    {formatDate(threshold.updatedAt)}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => navigate(`/threshold/${threshold.id}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-primary-400 hover:bg-primary-500/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Eye className="w-4 h-4" />
                      查看
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredThresholds.length === 0 && (
        <div className="py-16 text-center">
          <div className="w-16 h-16 bg-industrial-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Thermometer className="w-8 h-8 text-industrial-400" />
          </div>
          <p className="text-industrial-300">暂无阈值数据</p>
          <p className="text-industrial-400 text-sm mt-1">点击上方按钮导入阈值表</p>
        </div>
      )}
    </div>
  );
};

export default ThresholdList;
