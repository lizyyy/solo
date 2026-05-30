import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search, Check, X } from 'lucide-react';

interface Column<T> {
  key: keyof T | string;
  header: React.ReactNode;
  width?: string;
  sortable?: boolean;
  render?: (row: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectChange?: (ids: string[]) => void;
  getId?: (row: T) => string;
  onRowClick?: (row: T, index: number) => void;
  pageSize?: number;
  emptyMessage?: string;
  searchable?: boolean;
  searchKeys?: (keyof T)[];
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  selectable = false,
  selectedIds = [],
  onSelectChange,
  getId = (row) => row.id,
  onRowClick,
  pageSize = 20,
  emptyMessage = '暂无数据',
  searchable = false,
  searchKeys,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchText, setSearchText] = useState('');

  const filteredData = useMemo(() => {
    if (!searchable || !searchText) return data;

    return data.filter((row) => {
      const keys = searchKeys || (columns.map(c => c.key as keyof T));
      return keys.some((key) => {
        const value = row[key];
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(searchText.toLowerCase());
      });
    });
  }, [data, searchText, searchable, searchKeys, columns]);

  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comparison = typeof aVal === 'number' && typeof bVal === 'number'
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal));

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortKey, sortOrder]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const handleSelectAll = () => {
    if (!onSelectChange) return;

    const allIds = sortedData.map(getId);
    const allSelected = allIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      onSelectChange([]);
    } else {
      onSelectChange([...new Set([...selectedIds, ...allIds])]);
    }
  };

  const handleSelectRow = (id: string) => {
    if (!onSelectChange) return;

    if (selectedIds.includes(id)) {
      onSelectChange(selectedIds.filter((i) => i !== id));
    } else {
      onSelectChange([...selectedIds, id]);
    }
  };

  const allSelected = sortedData.length > 0 && sortedData.every((row) => selectedIds.includes(getId(row)));
  const someSelected = sortedData.some((row) => selectedIds.includes(getId(row)));

  return (
    <div className="w-full">
      {searchable && (
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="搜索..."
              className="input-field pl-10"
            />
            {searchText && (
              <button
                onClick={() => setSearchText('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 scrollbar-thin">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {selectable && (
                <th className="table-header w-12">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={`table-header ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : ''}`}
                  style={{ width: col.width }}
                >
                  {col.sortable ? (
                    <button
                      onClick={() => handleSort(String(col.key))}
                      className="flex items-center gap-1 hover:text-primary-600 transition-colors"
                    >
                      {col.header}
                      {sortKey === col.key && (
                        sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="table-cell text-center py-8"
                >
                  <div className="flex justify-center">
                    <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <p className="mt-2 text-gray-500">加载中...</p>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="table-cell text-center py-8 text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => {
                const id = getId(row);
                const isSelected = selectedIds.includes(id);

                return (
                  <tr
                    key={id}
                    onClick={() => onRowClick?.(row, index)}
                    className={`
                      transition-colors duration-150
                      ${isSelected ? 'bg-primary-50' : 'hover:bg-gray-50'}
                      ${onRowClick ? 'cursor-pointer' : ''}
                    `}
                  >
                    {selectable && (
                      <td className="table-cell w-12">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleSelectRow(id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={String(col.key)}
                        className={`table-cell ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : ''}`}
                      >
                        {col.render ? col.render(row, index) : row[col.key as keyof T]}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <p className="text-sm text-gray-500">
            共 {sortedData.length} 条记录，第 {currentPage} / {totalPages} 页
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-600 font-medium min-w-[60px] text-center">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {selectable && selectedIds.length > 0 && (
        <div className="mt-4 flex items-center gap-3 px-2">
          <span className="text-sm text-gray-600">
            已选择 <span className="font-semibold text-primary-600">{selectedIds.length}</span> 条
          </span>
          <button
            onClick={() => onSelectChange?.([])}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            清空选择
          </button>
        </div>
      )}
    </div>
  );
}
