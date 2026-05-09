
import { TableRow, TableState } from '../types';
import { TABLE_COLUMNS } from '../data/mockData';

interface DataTableProps {
  rows: TableRow[];
  state: TableState;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onSort: (field: string) => void;
  totalCount: number;
  onPageChange: (page: number) => void;
  groupedData?: Record<string, TableRow[]>;
}

export default function DataTable({
  rows,
  state,
  onToggleSelect,
  onToggleSelectAll,
  onSort,
  totalCount,
  onPageChange,
  groupedData,
}: DataTableProps) {
  const allSelected = rows.length > 0 && rows.every(row => state.selectedIds.includes(row.id));
  const someSelected = rows.some(row => state.selectedIds.includes(row.id));
  const totalPages = Math.ceil(totalCount / state.pagination.pageSize);

  const getSortIcon = (field: string) => {
    if (state.sort?.field !== field) return '↕';
    return state.sort.direction === 'asc' ? '↑' : '↓';
  };

  const renderRow = (row: TableRow, rowIndex: number) => (
    <tr key={row.id} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
      <td className="px-3 py-2 border-b">
        <input
          type="checkbox"
          checked={state.selectedIds.includes(row.id)}
          onChange={() => onToggleSelect(row.id)}
          className="w-4 h-4"
        />
      </td>
      {TABLE_COLUMNS.map(col => (
        <td key={col.key} className="px-3 py-2 border-b text-sm">
          {String(row[col.key] ?? '')}
        </td>
      ))}
    </tr>
  );

  const renderTable = (tableRows: TableRow[], prefix?: string) => (
    <div key={prefix || 'main'} className="mb-4">
      {prefix && (
        <div className="bg-gray-200 px-3 py-2 font-medium text-gray-700">
          {prefix} ({tableRows.length} 条)
        </div>
      )}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-3 py-2 text-left border-b w-12">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                onChange={onToggleSelectAll}
                className="w-4 h-4"
              />
            </th>
            {TABLE_COLUMNS.map(col => (
              <th
                key={col.key}
                onClick={() => onSort(col.key)}
                className="px-3 py-2 text-left border-b cursor-pointer hover:bg-gray-200"
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  <span className="text-gray-400">{getSortIcon(col.key)}</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableRows.length === 0 ? (
            <tr>
              <td colSpan={TABLE_COLUMNS.length + 1} className="px-3 py-8 text-center text-gray-500">
                没有数据
              </td>
            </tr>
          ) : (
            tableRows.map((row, idx) => renderRow(row, idx))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {groupedData ? (
        Object.entries(groupedData).map(([group, groupRows]) => 
          renderTable(groupRows, group)
        )
      ) : (
        renderTable(rows)
      )}

      {totalPages > 1 && (
        <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between">
          <div className="text-sm text-gray-600">
            共 {totalCount} 条，第 {state.pagination.page} / {totalPages} 页
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => onPageChange(1)}
              disabled={state.pagination.page === 1}
              className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              首页
            </button>
            <button
              onClick={() => onPageChange(state.pagination.page - 1)}
              disabled={state.pagination.page === 1}
              className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              上一页
            </button>
            <button
              onClick={() => onPageChange(state.pagination.page + 1)}
              disabled={state.pagination.page === totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              下一页
            </button>
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={state.pagination.page === totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              末页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
