import { BarChart3, TrendingUp } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import StatCard from '@/components/StatCard';

export default function Stats() {
  const { batches, attendanceRecords } = useAppStore();

  const totalBatches = batches.length;
  const totalRecords = attendanceRecords.length;
  const mixedBatches = batches.filter((b) => b.hasMixedType).length;
  const authRate = batches.filter((b) => b.status === 'authorized').length / Math.max(1, totalBatches) * 100;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary-900">数据统计</h1>
        <p className="text-primary-600 mt-2">全局数据概览与趋势分析</p>
      </div>

      <div className="grid grid-cols-4 gap-5">
        <StatCard
          label="总批次"
          value={totalBatches}
          icon={BarChart3}
          color="primary"
          trend={15}
        />
        <StatCard
          label="总签到记录"
          value={totalRecords}
          icon={TrendingUp}
          color="emerald"
          trend={12}
        />
        <StatCard
          label="混批次数"
          value={mixedBatches}
          icon={BarChart3}
          color="accent"
        />
        <StatCard
          label="授权通过率"
          value={`${authRate.toFixed(0)}%`}
          icon={TrendingUp}
          color="sky"
          trend={5}
        />
      </div>

      <div className="glass rounded-2xl p-8 border border-white/50 text-center">
        <BarChart3 className="w-16 h-16 text-primary-300 mx-auto mb-4" />
        <h3 className="font-display text-xl font-semibold text-primary-700 mb-2">
          更多统计图表正在开发中
        </h3>
        <p className="text-primary-500">
          您可以在批次详情页查看3D视图和图表视图
        </p>
      </div>
    </div>
  );
}
