import React from 'react';
import { Filter, Box, Shield, Trash2, Users, Route, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const FilterPanel: React.FC = () => {
  const { filters, setFilters } = useAppStore();

  const filterItems = [
    {
      key: 'showInstrumentCarts',
      label: '器械车',
      icon: Box,
      color: 'text-gray-600',
    },
    {
      key: 'showSterileZones',
      label: '无菌区',
      icon: Shield,
      color: 'text-green-600',
    },
    {
      key: 'showRecycleBins',
      label: '回收桶',
      icon: Trash2,
      color: 'text-red-500',
    },
    {
      key: 'showStaff',
      label: '人员',
      icon: Users,
      color: 'text-blue-500',
    },
    {
      key: 'showPaths',
      label: '路径线',
      icon: Route,
      color: 'text-purple-500',
    },
    {
      key: 'showErrors',
      label: '错误标记',
      icon: AlertTriangle,
      color: 'text-orange-500',
    },
  ];

  const handleToggle = (key: string) => {
    setFilters({ [key]: !filters[key as keyof typeof filters] });
  };

  return (
    <div className="absolute left-4 top-20 z-20">
      <div className="bg-white rounded-xl shadow-lg p-3">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">显示筛选</span>
        </div>
        <div className="space-y-1">
          {filterItems.map((item) => (
            <button
              key={item.key}
              onClick={() => handleToggle(item.key)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                filters[item.key as keyof typeof filters]
                  ? 'bg-blue-50 text-blue-600'
                  : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <item.icon className={`w-4 h-4 ${item.color}`} />
              <span className="text-sm">{item.label}</span>
              <div
                className={`ml-auto w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                  filters[item.key as keyof typeof filters]
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-gray-300'
                }`}
              >
                {filters[item.key as keyof typeof filters] && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
