import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
} from '@tanstack/react-table';
import {
  Download,
  CheckSquare,
  Square,
  ChevronUp,
  ChevronDown,
  Eye,
  AlertTriangle,
  XCircle,
  AlertCircle,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import FilterPanel from '@/components/FilterPanel';
import FilterTags from '@/components/FilterTags';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import ConflictTagList from '@/components/ConflictTagList';
import ConflictPieChart from '@/components/ConflictPieChart';
import StatusBarChart from '@/components/StatusBarChart';
import { formatDate, formatNumber, formatDateTime } from '@/utils/format';
import type { ConflictType, RedemptionListItem } from '@/types';
import { CONFLICT_DETAILS } from '@/types';
import { cn } from '@/lib/utils';

export default function RedemptionList() {
  const navigate = useNavigate();
  const {
    filterAndSortListItems,
    selectedIds,
    toggleSelectedId,
    clearSelectedIds,
    selectAll,
    getConflictStats,
    exportData,
    setFilterConditions,
  } = useStore();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [showExportModal, setShowExportModal] = useState(false);

  const filteredData = useMemo(() => filterAndSortListItems(), [filterAndSortListItems]);
  const conflictStats = getConflictStats();

  const columns = useMemo(
    () => [
      {
        id: 'select',
        header: ({ table }: { table: { getIsAllRowsSelected: () => boolean; toggleAllRowsSelected: (v: boolean) => void } }) => {
          const isAllSelected = selectedIds.length > 0 && selectedIds.length === filteredData.length;
          return (
            <div className="flex items-center justify-center">
              <button
                onClick={() => {
                  if (isAllSelected) {
                    clearSelectedIds();
                  } else {
                    selectAll(filteredData.map((d) => d.applicationId));
                  }
                }}
                className="text-neutral-500 hover:text-primary-600 transition-colors"
              >
                {isAllSelected ? (
                  <CheckSquare className="w-4 h-4 text-accent-500" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </button>
            </div>
          );
        },
        cell: ({ row }: { row: { original: { applicationId: string } } }) => {
          const isSelected = selectedIds.includes(row.original.applicationId);
          return (
            <div className="flex items-center justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelectedId(row.original.applicationId);
                }}
                className="text-neutral-500 hover:text-primary-600 transition-colors"
              >
                {isSelected ? (
                  <CheckSquare className="w-4 h-4 text-accent-500" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </button>
            </div>
          );
        },
        size: 40,
        enableSorting: false,
      },
      {
        accessorKey: 'bondCode',
        header: '债券代码',
        cell: ({ getValue }: { getValue: () => string }) => (
          <span className="font-mono text-sm text-primary-700 font-medium">{getValue()}</span>
        ),
        size: 100,
      },
      {
        accessorKey: 'bondName',
        header: '债券名称',
        cell: ({ getValue }: { getValue: () => string }) => (
          <span className="text-sm font-medium text-neutral-800">{getValue()}</span>
        ),
        size: 140,
      },
      {
        accessorKey: 'customerName',
        header: '客户名称',
        cell: ({ getValue }: { getValue: () => string }) => (
          <span className="text-sm text-neutral-700" title={getValue()}>
            {getValue().length > 12 ? `${getValue().slice(0, 12)}...` : getValue()}
          </span>
        ),
        size: 180,
      },
      {
        accessorKey: 'positionQuantity',
        header: '持仓数量',
        cell: ({ getValue }: { getValue: () => number }) => (
          <span className="font-mono text-sm tabular-nums">{formatNumber(getValue())}</span>
        ),
        size: 110,
      },
      {
        accessorKey: 'applyQuantity',
        header: '申请数量',
        cell: ({ getValue, row }: { getValue: () => number; row: { original: RedemptionListItem } }) => {
          const isInsufficient = row.original.conflicts.includes('insufficient_position');
          return (
            <span
              className={cn(
                'font-mono text-sm tabular-nums',
                isInsufficient && 'text-conflict-position font-medium'
              )}
            >
              {formatNumber(getValue())}
            </span>
          );
        },
        size: 110,
      },
      {
        accessorKey: 'announcementExerciseDate',
        header: '公告行权日',
        cell: ({ getValue }: { getValue: () => string }) => (
          <span className="font-mono text-sm tabular-nums">{formatDate(getValue())}</span>
        ),
        size: 120,
      },
      {
        accessorKey: 'applyExerciseDate',
        header: '申请行权日',
        cell: ({ getValue, row }: { getValue: () => string; row: { original: RedemptionListItem } }) => {
          const isMismatch = row.original.conflicts.includes('exercise_date_mismatch');
          return (
            <span
              className={cn(
                'font-mono text-sm tabular-nums',
                isMismatch && 'text-conflict-date font-medium'
              )}
            >
              {formatDate(getValue())}
            </span>
          );
        },
        size: 120,
      },
      {
        accessorKey: 'applicationStatus',
        header: '申请状态',
        cell: ({ getValue }: { getValue: () => string }) => <StatusBadge status={getValue() as never} />,
        size: 100,
      },
      {
        accessorKey: 'conflicts',
        header: '异常情况',
        cell: ({ getValue }: { getValue: () => ConflictType[] }) => <ConflictTagList conflicts={getValue()} />,
        size: 200,
      },
      {
        accessorKey: 'latestAnnouncementVersion',
        header: '公告版本',
        cell: ({ getValue }: { getValue: () => string }) => (
          <span className="font-mono text-xs text-neutral-500">{getValue()}</span>
        ),
        size: 100,
      },
      {
        accessorKey: 'lastUpdateTime',
        header: '更新时间',
        cell: ({ getValue }: { getValue: () => string }) => (
          <span className="font-mono text-xs text-neutral-500 tabular-nums">
            {formatDateTime(getValue())}
          </span>
        ),
        size: 160,
      },
      {
        id: 'actions',
        header: '操作',
        cell: ({ row }: { row: { original: { applicationId: string } } }) => (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/redemption-list/${row.original.applicationId}`);
              }}
              className="p-1.5 text-neutral-400 hover:text-accent-500 hover:bg-accent-50 rounded transition-colors"
              title="查看详情"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        ),
        size: 60,
        enableSorting: false,
      },
    ],
    [selectedIds, filteredData, navigate, toggleSelectedId, clearSelectedIds, selectAll]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
    enableColumnResizing: true,
  });

  const handleExport = () => {
    const itemsToExport =
      selectedIds.length > 0
        ? filteredData.filter((d) => selectedIds.includes(d.applicationId))
        : filteredData;
    exportData(itemsToExport);
    setShowExportModal(false);
  };

  const handleStatClick = (conflictType?: ConflictType) => {
    if (conflictType) {
      setFilterConditions({ conflictTypes: [conflictType] });
    } else {
      setFilterConditions({ conflictTypes: undefined });
    }
  };

  const hasConflicts = filteredData.some((d) => d.conflicts.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-semibold text-primary-900">债券回售行权名单</h2>
          <p className="text-sm text-neutral-500 mt-1">
            共 {filteredData.length} 条记录，{conflictStats.total} 条异常，{conflictStats.normal} 条正常
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <span className="text-sm text-neutral-500">
              已选择 <span className="font-medium text-accent-600">{selectedIds.length}</span> 条
            </span>
          )}
          <button onClick={() => setShowExportModal(true)} className="btn-accent gap-2">
            <Download className="w-4 h-4" />
            导出 Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <StatCard
          label="全部记录"
          value={filteredData.length}
          icon={FileText}
          color="primary"
          onClick={() => handleStatClick()}
        />
        <StatCard
          label={CONFLICT_DETAILS.exercise_date_mismatch.label}
          value={conflictStats.exercise_date_mismatch}
          icon={AlertTriangle}
          color="warning"
          onClick={() => handleStatClick('exercise_date_mismatch')}
        />
        <StatCard
          label={CONFLICT_DETAILS.withdrawn_still_in_list.label}
          value={conflictStats.withdrawn_still_in_list}
          icon={XCircle}
          color="danger"
          onClick={() => handleStatClick('withdrawn_still_in_list')}
        />
        <StatCard
          label={CONFLICT_DETAILS.insufficient_position.label}
          value={conflictStats.insufficient_position}
          icon={AlertCircle}
          color="warning"
          onClick={() => handleStatClick('insufficient_position')}
        />
        <StatCard
          label="正常"
          value={conflictStats.normal}
          icon={CheckCircle}
          color="success"
          onClick={() => handleStatClick()}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <FilterPanel />
          <FilterTags />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
          <ConflictPieChart />
          <StatusBarChart />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full" style={{ tableLayout: 'fixed' }}>
            <thead className="bg-neutral-100 border-b border-neutral-200 sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="table-header cursor-pointer select-none"
                      style={{ width: header.getSize() }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{
                          asc: <ChevronUp className="w-3 h-3 text-accent-500" />,
                          desc: <ChevronDown className="w-3 h-3 text-accent-500" />,
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const item = row.original as RedemptionListItem;
                const hasConflict = item.conflicts.length > 0;
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      'cursor-pointer transition-colors',
                      hasConflict ? 'table-row-conflict' : 'table-row',
                      selectedIds.includes(item.applicationId) && 'bg-accent-50/50'
                    )}
                    onClick={() => navigate(`/redemption-list/${item.applicationId}`)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="table-cell"
                        style={{ width: cell.column.getSize() }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredData.length === 0 && (
          <div className="py-16 text-center text-neutral-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">暂无符合条件的数据</p>
          </div>
        )}
      </div>

      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50">
              <h3 className="text-lg font-medium text-neutral-900">导出确认</h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-neutral-600 mb-4">
                即将导出{' '}
                <span className="font-medium text-primary-700">
                  {selectedIds.length > 0 ? selectedIds.length : filteredData.length}
                </span>{' '}
                条记录
              </p>
              {selectedIds.length > 0 && (
                <p className="text-xs text-neutral-500 mb-4">
                  当前已选中 {selectedIds.length} 条，将只导出选中的记录
                </p>
              )}
              {hasConflicts && (
                <div className="bg-conflict-date/5 border border-conflict-date/20 rounded p-3 mb-4">
                  <p className="text-xs text-conflict-date">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    导出文件将包含异常详情和处理记录
                  </p>
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="btn-outline"
                >
                  取消
                </button>
                <button onClick={handleExport} className="btn-accent">
                  确认导出
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
