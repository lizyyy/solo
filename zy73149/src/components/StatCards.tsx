import { FileText, CheckCircle, AlertTriangle, CloudOff, TrendingUp } from 'lucide-react';
import { useReportStore } from '@/store/reportStore';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}

function StatCard({ title, value, icon, color, subtitle }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-start gap-4 hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-gray-500 text-sm">{title}</p>
        <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function StatCards() {
  const { getStats } = useReportStore();
  const stats = getStats();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
      <StatCard
        title="总记录数"
        value={stats.total}
        icon={<FileText size={22} className="text-ocean-600" />}
        color="bg-ocean-50"
        subtitle="当前筛选条件下"
      />
      <StatCard
        title="正常记录"
        value={stats.normal}
        icon={<CheckCircle size={22} className="text-green-600" />}
        color="bg-green-50"
        subtitle={`占比 ${((stats.normal / stats.total) * 100).toFixed(1)}%`}
      />
      <StatCard
        title="云遮挡记录"
        value={stats.cloudCover}
        icon={<CloudOff size={22} className="text-gray-600" />}
        color="bg-gray-100"
        subtitle="遥感异常数据"
      />
      <StatCard
        title="严重淤积占比"
        value={`${stats.severeRate.toFixed(1)}%`}
        icon={<TrendingUp size={22} className="text-red-600" />}
        color="bg-red-50"
        subtitle="需重点关注"
      />
    </div>
  );
}
