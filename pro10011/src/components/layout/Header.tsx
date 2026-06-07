import { Bell, Search, RefreshCw } from 'lucide-react';

interface HeaderProps {
  title: string;
  onRefresh?: () => void;
}

export const Header = ({ title, onRefresh }: HeaderProps) => {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索交易编号、交易对手..."
            className="w-64 h-8 pl-9 pr-3 text-sm border border-gray-200 rounded-sm bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none transition-colors"
          />
        </div>
        
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-sm transition-colors"
            title="刷新数据"
          >
            <RefreshCw size={18} />
          </button>
        )}
        
        <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-sm transition-colors relative">
          <Bell size={18} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>
      </div>
    </header>
  );
};
