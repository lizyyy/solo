import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color: 'primary' | 'accent' | 'sky' | 'emerald';
  trend?: number;
}

export default function StatCard({ label, value, icon: Icon, color, trend }: StatCardProps) {
  const colorClasses = {
    primary: 'bg-primary-100 text-primary-700',
    accent: 'bg-accent-100 text-accent-700',
    sky: 'bg-sky-100 text-sky-700',
    emerald: 'bg-emerald-100 text-emerald-700',
  };

  const iconBgClasses = {
    primary: 'bg-primary-500',
    accent: 'bg-accent-500',
    sky: 'bg-sky-500',
    emerald: 'bg-emerald-500',
  };

  return (
    <div className="glass rounded-2xl p-5 border border-white/50 shadow-sm hover:shadow-md transition-all duration-300 animate-slide-up">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-primary-600 font-medium">{label}</p>
          <p className="text-3xl font-display font-bold text-primary-900 mt-2">{value}</p>
          {trend !== undefined && (
            <p className={`text-xs mt-2 ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% 较上周
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${iconBgClasses[color]} text-white shadow-lg`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
