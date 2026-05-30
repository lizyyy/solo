import { useEffect, useState } from 'react';
import { Filter } from 'lucide-react';
import { useStore } from '@/store';
import ModificationLogCard from '@/components/ModificationLogCard';
import { TableSkeleton } from '@/components/Skeleton';
import type { EntityType } from '../../shared/types';

export default function Settings() {
  const modifications = useStore((state) => state.modifications);
  const fetchModifications = useStore((state) => state.fetchModifications);
  const loading = useStore((state) => state.loading.modifications);
  const error = useStore((state) => state.error);

  const [entityTypeFilter, setEntityTypeFilter] = useState<EntityType | 'all'>('all');

  useEffect(() => {
    const params = entityTypeFilter === 'all' ? undefined : { entityType: entityTypeFilter };
    fetchModifications(params);
  }, [entityTypeFilter, fetchModifications]);

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-xl font-bold text-white mb-2">修改历史</h2>
        <p className="text-sm text-slate-400 mb-6">
          月底复盘时可追溯所有变更，包括规则、客户、白名单的修改记录
        </p>

        <div className="flex items-center gap-2 mb-6">
          <Filter className="w-5 h-5 text-slate-400" />
          <select
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value as EntityType | 'all')}
            className="px-4 py-2.5 rounded-lg bg-dark border border-dark-200 text-white focus:outline-none focus:border-primary transition-colors"
          >
            <option value="all">全部实体类型</option>
            <option value="rule">规则</option>
            <option value="customer">客户</option>
            <option value="whitelist">白名单</option>
          </select>
        </div>

        {loading ? (
          <TableSkeleton rows={5} columns={5} />
        ) : modifications.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            暂无修改记录
          </div>
        ) : (
          <div className="space-y-4">
            {modifications.map((log) => (
              <ModificationLogCard key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
