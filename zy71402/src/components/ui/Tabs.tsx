import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  key: string;
  label: React.ReactNode;
  content?: React.ReactNode;
  disabled?: boolean;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
  tabClassName?: string;
  variant?: 'default' | 'pills' | 'underline';
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeKey,
  onChange,
  className,
  tabClassName,
  variant = 'underline',
}) => {
  const variants = {
    default: {
      container: 'bg-gray-100 rounded-lg p-1',
      tab: 'px-4 py-2 text-sm font-medium rounded-md transition-colors',
      active: 'bg-white text-primary-800 shadow-sm',
      inactive: 'text-gray-600 hover:text-gray-800 hover:bg-gray-50',
    },
    pills: {
      container: '',
      tab: 'px-4 py-2 text-sm font-medium rounded-full transition-colors',
      active: 'bg-primary-800 text-white',
      inactive: 'text-gray-600 hover:bg-gray-100',
    },
    underline: {
      container: 'border-b border-gray-200',
      tab: 'px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px',
      active: 'border-primary-800 text-primary-800',
      inactive: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
    },
  };

  const v = variants[variant];

  return (
    <div className={cn(v.container, className)}>
      <div className="flex space-x-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => !tab.disabled && onChange(tab.key)}
            disabled={tab.disabled}
            className={cn(
              v.tab,
              tabClassName,
              activeKey === tab.key ? v.active : v.inactive,
              tab.disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn(
                'ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs rounded-full',
                activeKey === tab.key
                  ? 'bg-primary-100 text-primary-800'
                  : 'bg-gray-200 text-gray-600'
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
Tabs.displayName = 'Tabs';

export interface TabContentProps {
  activeKey: string;
  tabs: TabItem[];
  className?: string;
}

export const TabContent: React.FC<TabContentProps> = ({ activeKey, tabs, className }) => {
  const activeTab = tabs.find((t) => t.key === activeKey);
  return <div className={cn('mt-4', className)}>{activeTab?.content}</div>;
};
TabContent.displayName = 'TabContent';
