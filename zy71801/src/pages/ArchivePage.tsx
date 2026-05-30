import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Search, Calendar, User, ArrowRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import { StatusBadge } from '../components/StatusBadge';
import { format } from 'date-fns';

export function ArchivePage() {
  const { packs, isLoading, loadPacks } = useStore();

  useEffect(() => {
    loadPacks();
  }, [loadPacks]);

  const archivedPacks = packs.filter(p => 
    ['completed', 'archived'].includes(p.status)
  );

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-serif font-bold text-gray-900">已归档</h1>
        <p className="mt-1 text-gray-500">历史记录查询</p>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索归档记录..."
                className="pl-10 pr-4 py-2 border rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
          <span className="text-sm text-gray-500">
            共 {archivedPacks.length} 条归档记录
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-gray-500">
            <div className="animate-pulse">加载中...</div>
          </div>
        ) : archivedPacks.length === 0 ? (
          <div className="p-12 text-center">
            <Archive className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">暂无归档记录</p>
          </div>
        ) : (
          <div className="divide-y">
            {archivedPacks.map((pack) => (
              <Link
                key={pack.id}
                to={`/evidence/${pack.id}`}
                className="p-6 hover:bg-gray-50 group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-gray-900 group-hover:text-primary-600">
                        {pack.name}
                      </h3>
                      <StatusBadge status={pack.status} />
                    </div>
                    <p className="text-sm text-gray-500 mb-3">
                      {pack.description}
                    </p>
                    <div className="flex items-center gap-6 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(pack.importedAt), 'yyyy-MM-dd HH:mm')}
                      </span>
                      {pack.reviewer && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {pack.reviewer}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
