import { useMemo } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Search, Eye, Edit, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useRecordsStore } from '../../store/useRecordsStore';
import { useUiStore } from '../../store/useUiStore';
import { StatusBadge } from '../ui/StatusBadge';

export function RecordList() {
  const { records, issues, selectRecord, selectedRecordId } = useRecordsStore();
  const { searchQuery, statusFilter, openModal } = useUiStore();

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesSearch =
        searchQuery === '' ||
        record.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.pilot.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.source.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === null || record.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [records, searchQuery, statusFilter]);

  const getOpenIssuesCount = (recordId: string) => {
    return issues.filter((i) => i.recordId === recordId && i.status === 'open').length;
  };

  return (
    <div className="h-full flex flex-col bg-slate-900/50">
      <div className="p-4 border-b border-slate-700/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="搜索记录ID、飞手、来源..."
            value={searchQuery}
            onChange={(e) => useUiStore.getState().setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50"
          />
        </div>
        <div className="flex gap-2 mt-3">
          {[
            { value: null, label: '全部' },
            { value: 'pending_review', label: '待复核' },
            { value: 'pending_processing', label: '待处理' },
            { value: 'reviewed', label: '已复核' },
          ].map((filter) => (
            <button
              key={filter.value || 'all'}
              onClick={() => useUiStore.getState().setStatusFilter(filter.value)}
              className={cn(
                'px-3 py-1 text-xs rounded border transition-colors',
                statusFilter === filter.value
                  ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                  : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
            <tr className="text-slate-400 text-left">
              <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider">记录ID</th>
              <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider">状态</th>
              <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider">飞手</th>
              <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider">电池循环</th>
              <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider">来源</th>
              <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider">创建时间</th>
              <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider">问题</th>
              <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record, index) => {
              const openIssues = getOpenIssuesCount(record.id);
              const isSelected = record.id === selectedRecordId;

              return (
                <tr
                  key={record.id}
                  onClick={() => selectRecord(record.id)}
                  className={cn(
                    'border-b border-slate-800/50 cursor-pointer transition-colors',
                    index % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-800/20',
                    isSelected
                      ? 'bg-orange-500/10 border-orange-500/30'
                      : 'hover:bg-slate-700/30'
                  )}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-slate-300">{record.id}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-300">{record.pilot}</td>
                  <td className="px-4 py-3 text-slate-300">
                    <span className="font-mono">{record.batteryCycle}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 max-w-[200px] truncate" title={record.source}>
                    {record.source}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {format(new Date(record.createdAt), 'MM-dd HH:mm', { locale: zhCN })}
                  </td>
                  <td className="px-4 py-3">
                    {openIssues > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-red-400">
                        <AlertTriangle className="w-3 h-3" />
                        {openIssues}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          selectRecord(record.id);
                        }}
                        className="p-1.5 rounded text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                        title="查看详情"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          selectRecord(record.id);
                          openModal('routeModify', { recordId: record.id });
                        }}
                        className="p-1.5 rounded text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                        title="修正航线"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredRecords.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                  暂无匹配的记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
