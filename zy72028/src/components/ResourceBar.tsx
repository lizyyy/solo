import { Bus, Users, DollarSign, Star } from 'lucide-react';
import type { Resources } from '../types';

interface ResourceBarProps {
  resources: Resources;
  showLabels?: boolean;
}

export function ResourceBar({ resources, showLabels = true }: ResourceBarProps) {
  const resourceItems = [
    { icon: Bus, label: '公交', value: resources.buses, color: 'text-blue-500' },
    { icon: Users, label: '司机', value: resources.drivers, color: 'text-green-500' },
    { icon: DollarSign, label: '预算', value: resources.budget, color: 'text-yellow-500' },
    { icon: Star, label: '声誉', value: resources.reputation, color: 'text-purple-500' }
  ];

  return (
    <div className="flex items-center gap-6">
      {resourceItems.map(item => (
        <div key={item.label} className="flex items-center gap-2">
          <item.icon className={`w-5 h-5 ${item.color}`} />
          <span className="font-semibold text-gray-700">{item.value}</span>
          {showLabels && <span className="text-sm text-gray-500">{item.label}</span>}
        </div>
      ))}
    </div>
  );
}
