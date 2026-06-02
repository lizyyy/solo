import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  color: 'amber' | 'blue' | 'red' | 'emerald';
  onClick?: () => void;
}

const colorClasses: Record<string, string> = {
  amber: 'bg-amber-500 hover:bg-amber-600',
  blue: 'bg-blue-500 hover:bg-blue-600',
  red: 'bg-red-500 hover:bg-red-600',
  emerald: 'bg-emerald-500 hover:bg-emerald-600',
};

const StatsCard = ({ title, value, icon: Icon, color, onClick }: StatsCardProps) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-xl shadow-sm border border-slate-200 p-6 transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5'
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-500 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{value}</p>
        </div>
        <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center text-white', colorClasses[color])}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
