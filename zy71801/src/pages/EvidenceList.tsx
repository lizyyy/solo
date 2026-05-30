import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, ArrowRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import { StatusBadge } from '../components/StatusBadge';
import { format } from 'date-fns';

export function EvidenceList() {
  const { packs, isLoading, loadPacks } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadPacks();
  }, [loadPacks]);

  const filteredPacks = packs.filter(pack => {
    const matchesSearch = pack.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || pack.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-serif font-bold text-gray-900">证据链管理</h1>
        <p className="mt-1 text-gray-500">查看和管理所有证据包</p>
      </div>

      <div className="bg-white rounded-lg border mb-6">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索证据包..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">全部状态</option>
                <option value="pending">待处理</option>
                <option value="judged">已判断</option>
                <option value="reviewing">复核中</option>
                <option value="completed">已完成</option>
              </select>
            </div>
          </div>
          <Link to="/import" className="btn-primary">
            导入材料包
          </Link>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-gray-500">
            <div className="animate-pulse">加载中...</div>
          </div>
        ) : filteredPacks.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            暂无匹配的证据包
          </div>
        ) : (
          <div className="divide-y">
            {filteredPacks.map((pack) => (
              <Link
                key={pack.id}
                to={`/evidence/${pack.id}`}
                className="p-6 hover:bg-gray-50 flex items-center justify-between group"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium text-gray-900 group-hover:text-primary-600">
                      {pack.name}
                    </h3>
                    <StatusBadge status={pack.status} />
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {pack.description}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>导入时间：{format(new Date(pack.importedAt), 'yyyy-MM-dd HH:mm')}</span>
                    {pack.reviewer && <span>负责人：{pack.reviewer}</span>}
                    {pack.tags && pack.tags.length > 0 && (
                      <div className="flex items-center gap-1">
                        {pack.tags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-gray-100 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
