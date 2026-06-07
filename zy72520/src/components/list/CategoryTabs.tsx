import { useReviewStore } from '../../store/useReviewStore';
import { mockRecords } from '../../data/mockRecords';

const CategoryTabs = () => {
  const { filterType, setFilterType } = useReviewStore();
  
  const tabs = [
    { key: 'all', label: '全部记录' },
    { key: 'normal', label: '顺利记录' },
    { key: 'duplicate', label: '重复计入' },
    { key: 'supplement', label: '补录旧口径' },
  ];
  
  const counts = {
    all: mockRecords.length,
    normal: mockRecords.filter(r => r.type === 'normal').length,
    duplicate: mockRecords.filter(r => r.type === 'duplicate').length,
    supplement: mockRecords.filter(r => r.type === 'supplement').length,
  };

  return (
    <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-card mb-6">
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => setFilterType(tab.key as typeof filterType)}
          className={`relative flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${
            filterType === tab.key
              ? 'bg-primary-800 text-white shadow-md'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            {tab.label}
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              filterType === tab.key
                ? 'bg-accent-400 text-primary-900'
                : 'bg-gray-200 text-gray-600'
            }`}>
              {counts[tab.key as keyof typeof counts]}
            </span>
          </span>
          {filterType === tab.key && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-accent-400 rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
};

export default CategoryTabs;
