import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Download, Eye } from 'lucide-react';
import FilterPanel from '@/components/filter/FilterPanel';
import BatchActions from '@/components/table/BatchActions';
import Pagination from '@/components/table/Pagination';
import StatusBadge from '@/components/common/StatusBadge';
import { useRecordStore } from '@/store/useRecordStore';
import { useFilterStore } from '@/store/useFilterStore';
import { exportToExcel } from '@/utils/export';
import { formatDate } from '@/utils/export';
import { TYPE_LABELS } from '@/types';

const RecordList: React.FC = () => {
  const {
    records,
    initData,
    getFilteredRecords,
    selectedIds,
    toggleSelect,
    selectAll,
  } = useRecordStore();

  const {
    status,
    source,
    type,
    handlerId,
    dateStart,
    dateEnd,
    currentPage,
    pageSize,
    getFilters,
  } = useFilterStore();

  useEffect(() => {
    initData();
  }, [initData]);

  const filteredRecords = useMemo(() => {
    return getFilteredRecords({
      status,
      source,
      type,
      handlerId,
      dateStart,
      dateEnd,
    });
  }, [getFilteredRecords, status, source, type, handlerId, dateStart, dateEnd]);

  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  const allSelected =
    paginatedRecords.length > 0 &&
    paginatedRecords.every((r) => selectedIds.has(r.id));

  const handleSelectAll = () => {
    if (allSelected) {
      const currentPageIds = paginatedRecords.map((r) => r.id);
      const newSelected = new Set(selectedIds);
      currentPageIds.forEach((id) => newSelected.delete(id));
      useRecordStore.setState({ selectedIds: newSelected });
    } else {
      selectAll([...selectedIds, ...paginatedRecords.map((r) => r.id)]);
    }
  };

  const handleExport = () => {
    const filters = getFilters();
    const dateStr = new Date().toISOString().split('T')[0];
    exportToExcel(filteredRecords, `质检记录_${dateStr}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">审核记录列表</h2>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          导出当前列表
        </button>
      </div>

      <FilterPanel />
      <BatchActions />

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  记录ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  来源
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  内容
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  类型
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  处理人
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  更新时间
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                    暂无数据
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(record.id)}
                        onChange={() => toggleSelect(record.id)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">
                      {record.id}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[150px] truncate">
                      {record.source}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[250px] truncate">
                      {record.content}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {TYPE_LABELS[record.type]}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={record.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {record.handlerName || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(record.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/record/${record.id}`}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        详情
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination total={filteredRecords.length} />
      </div>
    </div>
  );
};

export default RecordList;
