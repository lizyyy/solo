import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter } from 'lucide-react';
import { useStore } from '@/store';
import RuleTable from '@/components/RuleTable';
import { TableSkeleton } from '@/components/Skeleton';
import type { RuleStatus, RateLimitRule } from '../../shared/types';
import { STATUS_LABELS } from '../../shared/types';

export default function RuleList() {
  const navigate = useNavigate();
  const rules = useStore((state) => state.rules);
  const loading = useStore((state) => state.loading.rules);
  const fetchRules = useStore((state) => state.fetchRules);
  const error = useStore((state) => state.error);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RuleStatus | 'all'>('all');

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      const matchesSearch =
        rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.path.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || rule.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rules, searchQuery, statusFilter]);

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索规则名称或接口路径..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-dark border border-dark-200 text-white placeholder-slate-500 focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as RuleStatus | 'all')}
              className="px-4 py-2.5 rounded-lg bg-dark border border-dark-200 text-white focus:outline-none focus:border-primary transition-colors"
            >
              <option value="all">全部状态</option>
              <option value="active">{STATUS_LABELS.active}</option>
              <option value="draft">{STATUS_LABELS.draft}</option>
              <option value="deprecated">{STATUS_LABELS.deprecated}</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => navigate('/rules/new')}
          className="px-4 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          新建规则
        </button>
      </div>

      {loading ? (
        <TableSkeleton rows={5} columns={9} />
      ) : (
        <RuleTable rules={filteredRules} onEdit={handleEdit} onViewVersions={handleViewVersions} />
      )}

      {!loading && filteredRules.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-slate-400">
            {searchQuery || statusFilter !== 'all'
              ? '没有找到匹配的规则'
              : '暂无规则数据，点击上方按钮创建新规则'}
          </p>
        </div>
      )}
    </div>
  );
}
