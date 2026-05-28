import React, { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import { Search, Filter, ChevronDown, ChevronUp, ArrowUpDown, TrendingUp, AlertTriangle, CheckCircle, XCircle, Eye } from 'lucide-react';
import { useAppStore } from '@/store';
import { triggerWindowService } from '@/services/TriggerWindowService';
import { announcementVersionService } from '@/services/AnnouncementVersionService';
import {
  formatNumber,
  formatMoney,
  formatPercent,
  getStatusBadgeClass,
  debounce,
} from '@/utils/format';
import clsx from 'clsx';

const RedemptionList: React.FC = () => {
  const {
    bonds,
    triggerResults,
    announcements,
    positions,
    setSelectedBond,
    isRefreshing,
  } = useAppStore();

  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const debouncedGlobalFilter = useMemo(
    () => debounce((value: string) => setGlobalFilter(value), 300),
    []
  );

  const tableData = useMemo(() => {
    return bonds.map(bond => {
      const triggerResult = triggerResults[bond.bondCode];
      const bondAnnouncements = announcements[bond.bondCode] || [];
      const bondPositions = positions.filter(p => p.bondCode === bond.bondCode);
      const annStatus = announcementVersionService.getAnnouncementStatus(bondAnnouncements);
      const triggerStatus = triggerResult ? triggerWindowService.getTriggerStatus(triggerResult) : null;

      return {
        ...bond,
        meetDays: triggerResult?.meetDays || 0,
        totalDays: triggerResult?.totalDays || 30,
        consecutiveDays: triggerResult?.consecutiveDays || 0,
        hasGap: triggerResult?.hasGap || false,
        isTriggered: triggerResult?.isTriggered || false,
        triggerStatus: triggerStatus?.status || 'NORMAL',
        triggerMessage: triggerStatus?.message || '',
        annStatus: annStatus.status,
        annStatusText: annStatus.statusText,
        customerCount: bondPositions.length,
        totalPosition: bondPositions.reduce((sum, p) => sum + p.positionAmount, 0),
        latestAnnouncement: annStatus.latestAnnouncement,
      };
    });
  }, [bonds, triggerResults, announcements, positions]);

  const filteredData = useMemo(() => {
    let data = tableData;

    if (statusFilter !== 'all') {
      data = data.filter(d => {
        if (statusFilter === 'triggered') return d.isTriggered;
        if (statusFilter === 'warning') return d.triggerStatus === 'WARNING';
        if (statusFilter === 'gap') return d.hasGap;
        if (statusFilter === 'withdrawn') return d.annStatus === 'WITHDRAWN';
        return true;
      });
    }

    if (globalFilter) {
      const filter = globalFilter.toLowerCase();
      data = data.filter(d =>
        d.bondCode.toLowerCase().includes(filter) ||
        d.bondName.toLowerCase().includes(filter) ||
        d.stockCode.toLowerCase().includes(filter) ||
        d.stockName.toLowerCase().includes(filter) ||
        d.industry.toLowerCase().includes(filter)
      );
    }

    return data;
  }, [tableData, statusFilter, globalFilter]);

  const columns = useMemo(() => [
    {
      accessorKey: 'bondCode',
      header: '转债代码',
      cell: (info: any) => (
        <span className="font-mono text-sm text-slate-700">{info.getValue()}</span>
      ),
      size: 100,
    },
    {
      accessorKey: 'bondName',
      header: '转债名称',
      cell: (info: any) => (
        <span className="font-medium text-slate-800">{info.getValue()}</span>
      ),
      size: 120,
    },
    {
      accessorKey: 'stockName',
      header: '正股名称',
      cell: (info: any) => (
        <div>
          <div className="text-slate-700">{info.getValue()}</div>
          <div className="text-xs text-slate-400">{info.row.original.stockCode}</div>
        </div>
      ),
      size: 120,
    },
    {
      accessorKey: 'stockPrice',
      header: '正股价',
      cell: (info: any) => {
        const row = info.row.original;
        const isAbove = row.stockPrice >= row.redemptionPrice;
        return (
          <span className={clsx('font-medium', isAbove ? 'text-danger-600' : 'text-slate-700')}>
            {formatMoney(info.getValue())}
          </span>
        );
      },
      size: 100,
    },
    {
      accessorKey: 'redemptionPrice',
      header: '触发价',
      cell: (info: any) => (
        <span className="text-slate-600">{formatMoney(info.getValue())}</span>
      ),
      size: 100,
    },
    {
      accessorKey: 'meetDays',
      header: () => (
        <div className="flex items-center gap-1">
          <span>达标天数</span>
          <span className="text-xs text-slate-400 font-normal">(30/15)</span>
        </div>
      ),
      cell: (info: any) => {
        const row = info.row.original;
        const percentage = (row.meetDays / row.totalDays) * 100;
        return (
          <div>
            <div className="flex items-center gap-2">
              <span className={clsx(
                'font-semibold',
                row.isTriggered ? 'text-danger-600' :
                row.meetDays >= 10 ? 'text-warning-600' : 'text-slate-700'
              )}>
                {row.meetDays}
              </span>
              <span className="text-slate-400">/ {row.totalDays}</span>
              {row.hasGap && <XCircle className="w-4 h-4 text-danger-500" />}
            </div>
            <div className="mt-1 h-1.5 bg-slate-200 rounded-full overflow-hidden w-20">
              <div
                className={clsx(
                  'h-full rounded-full',
                  row.isTriggered ? 'bg-danger-500' :
                  row.meetDays >= 10 ? 'bg-warning-500' : 'bg-primary-500'
                )}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
          </div>
        );
      },
      size: 120,
      sortingFn: (a: any, b: any) => a.original.meetDays - b.original.meetDays,
    },
    {
      accessorKey: 'consecutiveDays',
      header: '连续天数',
      cell: (info: any) => {
        const days = info.getValue();
        return (
          <span className={clsx(
            'font-medium',
            days >= 5 ? 'text-danger-600' : days >= 3 ? 'text-warning-600' : 'text-slate-600'
          )}>
            {days} 天
          </span>
        );
      },
      size: 90,
    },
    {
      accessorKey: 'triggerStatus',
      header: '触发状态',
      cell: (info: any) => {
        const status = info.getValue();
        const row = info.row.original;
        let statusText = '监控中';
        if (row.isTriggered) statusText = '已触发';
        else if (row.hasGap) statusText = '数据断档';
        else if (row.meetDays >= 10) statusText = '即将触发';
        
        return (
          <span className={getStatusBadgeClass(row.isTriggered ? 'TRIGGERED' : row.hasGap ? 'GAP' : row.meetDays >= 10 ? 'WARNING' : 'NORMAL')}>
            {statusText}
          </span>
        );
      },
      size: 100,
    },
    {
      accessorKey: 'annStatus',
      header: '公告状态',
      cell: (info: any) => (
        <span className={getStatusBadgeClass(info.getValue())}>
          {info.row.original.annStatusText}
        </span>
      ),
      size: 100,
    },
    {
      accessorKey: 'customerCount',
      header: '涉及客户',
      cell: (info: any) => (
        <span className="text-slate-700">{info.getValue()} 位</span>
      ),
      size: 90,
    },
    {
      accessorKey: 'totalPosition',
      header: '持仓金额',
      cell: (info: any) => (
        <span className="font-medium text-slate-700">{formatNumber(info.getValue())}</span>
      ),
      size: 110,
    },
    {
      id: 'actions',
      header: '操作',
      cell: (info: any) => (
        <button
          onClick={() => setSelectedBond(info.row.original.bondCode)}
          className="p-2 rounded-md hover:bg-primary-50 text-primary-600 transition-colors"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
      size: 60,
    },
  ], [setSelectedBond]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      sorting: [{ id: 'meetDays', desc: true }],
    },
  });

  const statusFilters = [
    { value: 'all', label: '全部', count: tableData.length },
    { value: 'triggered', label: '已触发', count: tableData.filter(d => d.isTriggered).length },
    { value: 'warning', label: '即将触发', count: tableData.filter(d => d.triggerStatus === 'WARNING' && !d.isTriggered).length },
    { value: 'gap', label: '数据断档', count: tableData.filter(d => d.hasGap).length },
    { value: 'withdrawn', label: '公告撤回', count: tableData.filter(d => d.annStatus === 'WITHDRAWN').length },
  ];

  if (isRefreshing && bonds.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto mb-4" />
          <p className="text-slate-600">正在加载数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-slate-800">强赎明细</h2>
          <p className="text-sm text-slate-500 mt-1">
            共 {tableData.length} 只转债，{filteredData.length} 条符合筛选条件
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {statusFilters.map(filter => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                statusFilter === filter.value
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              )}
            >
              {filter.label}
              <span className={clsx(
                'ml-1.5 px-1.5 py-0.5 rounded text-xs',
                statusFilter === filter.value ? 'bg-white/20' : 'bg-slate-100'
              )}>
                {filter.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索转债代码/名称..."
              className="input-field pl-9 w-full"
              onChange={(e) => debouncedGlobalFilter(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full" style={{ minWidth: '1200px' }}>
            <thead className="table-header">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className={clsx(
                        'px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider',
                        header.column.getCanSort() && 'cursor-pointer select-none hover:bg-slate-100'
                      )}
                      style={{ width: `${header.getSize()}px` }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getCanSort() && (
                          <span className="text-slate-400">
                            {header.column.getIsSorted() === 'asc' ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : header.column.getIsSorted() === 'desc' ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowUpDown className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-500">
                    <Filter className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>没有找到符合条件的转债</p>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr
                    key={row.id}
                    className="table-row cursor-pointer group"
                    onClick={() => setSelectedBond(row.original.bondCode)}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        className="table-cell"
                        style={{ width: `${cell.column.getSize()}px` }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-danger-50 to-white p-4 rounded-xl border border-danger-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-danger-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-danger-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-danger-600">
                {tableData.filter(d => d.isTriggered).length}
              </div>
              <div className="text-sm text-danger-600/70">已触发强赎</div>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-warning-50 to-white p-4 rounded-xl border border-warning-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-warning-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-warning-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-warning-600">
                {tableData.filter(d => d.triggerStatus === 'WARNING' && !d.isTriggered).length}
              </div>
              <div className="text-sm text-warning-600/70">即将触发</div>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-success-50 to-white p-4 rounded-xl border border-success-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-success-600">
                {tableData.filter(d => d.triggerStatus === 'NORMAL' && !d.hasGap).length}
              </div>
              <div className="text-sm text-success-600/70">正常监控</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RedemptionList;
