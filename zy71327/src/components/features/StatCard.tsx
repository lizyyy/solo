import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number;
  icon: ReactNode;
  color: 'green' | 'amber' | 'red' | 'blue';
  trend?: string;
}

const colorClasses = {
  green: 'from-[#4A7C59] to-[#3d6649]',
  amber: 'from-[#D4883A] to-[#b8732f]',
  red: 'from-[#B85450] to-[#9c4643]',
  blue: 'from-[#6B8E9F] to-[#5a7a89]',
};

export const StatCard = ({ title, value, icon, color, trend }: StatCardProps) => {
  return (
    <Card className="overflow-hidden border-0 bg-gradient-to-br from-white to-gray-50">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-3xl font-bold text-[#1A1A2E] mt-2">{value}</p>
            {trend && (
              <p className="text-xs text-gray-400 mt-1">{trend}</p>
            )}
          </div>
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br text-white shadow-lg',
              colorClasses[color]
            )}
          >
            {icon}
          </div>
        </div>
      </div>
      <div className={cn('h-1 bg-gradient-to-r', colorClasses[color])} />
    </Card>
  );
};
