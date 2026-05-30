import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, User, MessageSquare, ArrowRight, Filter } from 'lucide-react';
import { useStore } from '../store/useStore';
import { StatusBadge } from '../components/StatusBadge';
import { format } from 'date-fns';

export function ReviewList() {
  const { packs, isLoading, loadPacks } = useStore();

  useEffect(() => {
    loadPacks();
  }, [loadPacks]);

  const reviewPacks = packs.filter(p => 
    ['judged', 'reviewing', 'need_review'].includes(p.status)
  );

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-serif font-bold text-gray-900">复核清单</h1>
        <p className="mt-1 text-gray-500">待人工复核的证据包列表</p>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">
              共 {reviewPacks.length} 个待复核项
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-gray-500">
            <div className="animate-pulse">加载中...</div>
          </div>
        ) : reviewPacks.length === 0 ? (
          <div className="p-12 text-center">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">暂无待复核项</p>
          </div>
        ) : (
          <div className="divide-y">
            {reviewPacks.map((pack) => (
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
                        <Clock className="w-3 h-3" />
                        {format(new Date(pack.importedAt), 'yyyy-MM-dd HH:mm')}
                      </span>
                      {pack.reviewer && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {pack.reviewer}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        点击查看详情并复核
                      </span>
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
