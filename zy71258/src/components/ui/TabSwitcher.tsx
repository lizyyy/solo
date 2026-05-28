import { cn } from '@/lib/utils';

export interface TabItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabSwitcherProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (key: string) => void;
  className?: string;
}

export default function TabSwitcher({
  tabs,
  activeTab,
  onTabChange,
  className,
}: TabSwitcherProps) {
  return (
    <div
      className={cn(
        'flex border-b border-[#2A2D34] bg-[#121418]',
        className
      )}
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={cn(
            'flex items-center gap-2 px-4 py-3 text-sm transition-all duration-200',
            'border-b-2 -mb-px',
            activeTab === tab.key
              ? 'text-[#C9A962] border-[#C9A962] bg-[#1A1D24]'
              : 'text-[#8B8D93] border-transparent hover:text-[#C9A962] hover:bg-[#16181D]'
          )}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
