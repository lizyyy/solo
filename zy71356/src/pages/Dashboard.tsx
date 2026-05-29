import { useEffect, useState } from 'react';
import {
  Users,
  MapPin,
  Grid3X3,
  AlertTriangle,
  CheckCircle,
  Zap,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { useMarketStore } from '@/store/useMarketStore';
import { useNavigate } from 'react-router-dom';
import {
  CATEGORY_LABELS,
  CONFLICT_TYPE_LABELS,
} from '@shared/types';
import SuccessToast from '@/components/SuccessToast';

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    vendors,
    stalls,
    assignments,
    conflicts,
    currentArrangement,
    loadAll,
    loading,
  } = useMarketStore();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const assignedVendorIds = new Set(assignments.map((a) => a.vendorId));
  const unassignedCount = vendors.filter(
    (v) => !assignedVendorIds.has(v.id)
  ).length;
  const assignedCount = assignments.length;
  const errorCount = conflicts.filter((c) => c.severity === 'error').length;
  const warningCount = conflicts.filter((c) => c.severity === 'warning').length;

  const stats = [
    {
      label: '摊主总数',
      value: vendors.length,
      icon: Users,
      color: 'bg-teal-500',
      action: () => navigate('/vendors'),
    },
    {
      label: '摊位总数',
      value: stalls.length,
      icon: MapPin,
      color: 'bg-blue-500',
      action: () => navigate('/stalls'),
    },
    {
      label: '已分配',
      value: assignedCount,
      icon: Grid3X3,
      color: 'bg-emerald-500',
      action: () => navigate('/arrange'),
    },
    {
      label: '待分配',
      value: unassignedCount,
      icon: Plus,
      color: 'bg-amber-500',
      action: () => navigate('/arrange'),
    },
  ];

  const categoryStats = vendors.reduce((acc, v) => {
    acc[v.category] = (acc[v.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const conflictsByType = conflicts.reduce((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading && vendors.length === 0) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-64" />
          <div className="grid grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-slate-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {successMsg && (
        <SuccessToast message={successMsg} onClose={() => setSuccessMsg(null)} />
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">
          欢迎使用艺术市集摊位排布系统
        </h1>
        <p className="text-slate-500">
          高效管理摊主信息、优化摊位布局、自动检测排布冲突
        </p>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <button
            key={stat.label}
            onClick={stat.action}
            className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-teal-200 transition-all text-left group"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-500 text-sm">{stat.label}</p>
                <p className="text-3xl font-bold text-slate-800 mt-2">
                  {stat.value}
                </p>
              </div>
              <div
                className={`${stat.color} p-3 rounded-lg text-white group-hover:scale-110 transition-transform`}
              >
                <stat.icon size={24} />
              </div>
            </div>
            <div className="mt-4 flex items-center text-teal-600 text-sm font-medium">
              查看详情 <ArrowRight size={16} className="ml-1" />
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Zap size={18} className="text-amber-500" />
            品类分布
          </h3>
          <div className="space-y-3">
            {Object.entries(categoryStats).map(([cat, count]) => (
              <div key={cat} className="flex items-center justify-between">
                <span className="text-slate-600">
                  {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-teal-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${(count / vendors.length) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium text-slate-700 w-8 text-right">
                    {count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            冲突概览
          </h3>
          {conflicts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle
                size={48}
                className="mx-auto text-teal-500 mb-3"
              />
              <p className="text-teal-600 font-medium">暂无冲突</p>
              <p className="text-slate-400 text-sm">所有排布符合规则</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(conflictsByType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-slate-600">
                    {CONFLICT_TYPE_LABELS[type as keyof typeof CONFLICT_TYPE_LABELS]}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      type === 'power_mismatch'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {count} 项
                  </span>
                </div>
              ))}
              <button
                onClick={() => navigate('/arrange')}
                className="w-full mt-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
              >
                查看详情并处理
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4">快速操作</h3>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/arrange')}
              className="w-full py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Grid3X3 size={18} />
              开始排布
            </button>
            <button
              onClick={() => navigate('/export')}
              className="w-full py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <ArrowRight size={18} />
              导出报告
            </button>
          </div>
        </div>
      </div>

      {currentArrangement && (
        <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-xl p-6 border border-teal-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800 text-lg">
                当前版本：{currentArrangement.version}
              </h3>
              <p className="text-slate-600 mt-1">{currentArrangement.name}</p>
              {currentArrangement.note && (
                <p className="text-slate-500 text-sm mt-2">
                  备注：{currentArrangement.note}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">创建时间</p>
              <p className="text-slate-700">
                {new Date(currentArrangement.createdAt).toLocaleString('zh-CN')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
