import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color: 'amber' | 'primary' | 'emerald' | 'gray';
}

const colorStyles = {
  amber: 'from-amber-500 to-orange-600',
  primary: 'from-primary-500 to-primary-700',
  emerald: 'from-emerald-500 to-emerald-700',
  gray: 'from-gray-500 to-gray-700',
};

export function StatCard({ title, value, icon: Icon, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className={`h-2 bg-gradient-to-r ${colorStyles[color]}`}></div>
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">{title}</p>
            <p className="text-3xl font-bold text-gray-800 mt-1">{value}</p>
          </div>
          <div className={`p-3 rounded-lg bg-gradient-to-br ${colorStyles[color]} bg-opacity-10`}>
            <Icon className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}
