import { Search, Calendar, Filter } from 'lucide-react';
import { useReviewStore } from '../../store/useReviewStore';

const FilterBar = () => {
  const { searchKeyword, setSearchKeyword } = useReviewStore();

  return (
    <div className="bg-white rounded-xl p-4 shadow-card mb-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[300px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="搜索记录ID、用户ID、反馈内容..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-400 focus:border-transparent transition-all text-sm"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <Calendar className="w-4 h-4" />
            <span>时间范围</span>
          </button>
          
          <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <Filter className="w-4 h-4" />
            <span>更多筛选</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
