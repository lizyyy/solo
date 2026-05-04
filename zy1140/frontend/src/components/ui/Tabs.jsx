import { cn } from '../utils/cn';

export const Tabs = ({ tabs, activeTab, onChange, className }) => (
  <div className={cn('flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg', className)}>
    {tabs.map((tab) => (
      <button
        key={tab.value}
        onClick={() => onChange(tab.value)}
        className={cn(
          'flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors',
          activeTab === tab.value
            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
        )}
      >
        {tab.icon && <span className="mr-2">{tab.icon}</span>}
        {tab.label}
      </button>
    ))}
  </div>
);
