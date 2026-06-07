import { useClaimStore } from '../store/useClaimStore';
import { FilterBar } from '../components/claim/FilterBar';
import { RecordCard } from '../components/claim/RecordCard';
import type { RecordStatus } from '../types/claim';
import { Inbox } from 'lucide-react';

export function ClaimList() {
  const { filter, searchKeyword, setFilter, setSearchKeyword, getFilteredRecords, records } = useClaimStore();

  const filteredRecords = getFilteredRecords();

  const counts: Record<RecordStatus | 'all', number> = {
    all: records.length,
    pending_import: records.filter((r) => r.status === 'pending_import').length,
    pending_review: records.filter((r) => r.status === 'pending_review').length,
    pending_verify: records.filter((r) => r.status === 'pending_verify').length,
    conflict: records.filter((r) => r.status === 'conflict').length,
    completed: records.filter((r) => r.status === 'completed').length,
  };

  return (
    <div className="flex-1 p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">保险理赔材料识别</h1>
          <p className="text-sm text-gray-500">
            整合人工改判表与提示词版本号证据，确保每一条结论都可追溯
          </p>
        </div>

        <FilterBar
          filter={filter}
          searchKeyword={searchKeyword}
          onFilterChange={setFilter}
          onSearchChange={setSearchKeyword}
          counts={counts}
        />

        {filteredRecords.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecords.map((record) => (
              <RecordCard key={record.id} record={record} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Inbox className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-500">暂无匹配的记录</p>
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">📋 样例说明</h3>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>
              <strong>REC-001 张三</strong>：顺利记录 - 两边证据完全一致，自动通过
            </li>
            <li>
              <strong>REC-002 李四</strong>：同一用户反馈被重复计入 - 标记待复核，留给标注负责人处理
            </li>
            <li>
              <strong>REC-003 王五</strong>：旧口径补录 - 提示词版本号补来的旧口径与人工改判表矛盾，需小孟确认
            </li>
            <li>
              <strong>REC-004 赵六</strong>：待补看提示词版本号 - 可体验第二步流程
            </li>
            <li>
              <strong>REC-005 钱七</strong>：待导入人工改判表 - 可体验第一步流程
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
