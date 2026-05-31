import { useApp } from '../../context/AppContext';
import type { TabType } from '../../data/types';

const tabs: { key: TabType; label: string }[] = [
  { key: 'timeline', label: '时间线' },
  { key: 'schedule', label: '驻留排期' },
  { key: 'exhibition', label: '布展清单' },
];

export default function Header() {
  const { activeTab, setActiveTab } = useApp();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-ivory border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <h1 className="font-display text-2xl text-gray-900 tracking-wide">
          画廊助理 · 布展协调
        </h1>
        <nav className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2 font-body text-sm transition-all duration-300 relative ${
                activeTab === tab.key
                  ? 'text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span
                className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900 transition-all duration-300 ${
                  activeTab === tab.key ? 'scale-x-100' : 'scale-x-0'
                }`}
              />
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
