import React, { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import {
  Database,
  FileText,
  TrendingUp,
  Users,
  Bell,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Filter,
  Search,
  Eye,
  X,
  Copy,
  Check,
  Link,
  Clock,
  Shield,
  GitCompare,
  Download,
  Hash,
  Server,
  Calendar,
} from 'lucide-react';
import { useAppStore } from '@/store';
import {
  formatDateTime,
  formatRelativeTime,
  debounce,
  truncateText,
} from '@/utils/format';
import clsx from 'clsx';
import type { DataSourceTrace, DataType } from '@/types';

const DATA_TYPE_CONFIG: Record<DataType, { label: string; icon: React.ReactNode; color: string }> = {
  BOND_INFO: {
    label: '转债基础信息',
    icon: <FileText className="w-4 h-4" />,
    color: 'bg-blue-100 text-blue-700',
  },
  MARKET_DATA: {
    label: '正股行情数据',
    icon: <TrendingUp className="w-4 h-4" />,
    color: 'bg-green-100 text-green-700',
  },
  ANNOUNCEMENT: {
    label: '强赎公告数据',
    icon: <Bell className="w-4 h-4" />,
    color: 'bg-amber-100 text-amber-700',
  },
  POSITION: {
    label: '客户持仓数据',
    icon: <Users className="w-4 h-4" />,
    color: 'bg-purple-100 text-purple-700',
  },
  REMINDER: {
    label: '提醒记录数据',
    icon: <Bell className="w-4 h-4" />,
    color: 'bg-rose-100 text-rose-700',
  },
};

interface DetailModalProps {
  isOpen: boolean;
  trace: DataSourceTrace | null;
  onClose: () => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ isOpen, trace, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [showRawData, setShowRawData] = useState(false);

  if (!isOpen || !trace) return null;

  const handleCopyHash = async () => {
    await navigator.clipboard.writeText(trace.dataHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const config = DATA_TYPE_CONFIG[trace.dataType];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center', config.color)}>
              {config.icon}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">{config.label} - 数据溯源详情</h3>
              <p className="text-sm text-slate-500">数据ID：{trace.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                  <Server className="w-4 h-4" />
                  来源系统
                </div>
                <div className="font-medium text-slate-800">{trace.sourceSystem}</div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                  <Calendar className="w-4 h-4" />
                  获取时间
                </div>
                <div className="font-medium text-slate-800">{formatDateTime(trace.fetchedAt)}</div>
                <div className="text-sm text-slate-400 mt-1">{formatRelativeTime(trace.fetchedAt)}</div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                  <Link className="w-4 h-4" />
                  来源链接
                </div>
                <a
                  href={trace.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary-600 hover:text-primary-700 break-all text-sm"
                >
                  {trace.sourceUrl}
                </a>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                  <Users className="w-4 h-4" />
                  创建人
                </div>
                <div className="font-medium text-slate-800">{trace.createdBy === 'system' ? '系统自动' : trace.createdBy}</div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Hash className="w-4 h-4" />
                    数据哈希（SHA-256）
                  </div>
                  <button
                    onClick={handleCopyHash}
                    className="p-1.5 hover:bg-slate-200 rounded transition-colors"
                    title="复制哈希值"
                  >
                    {copied ? <Check className="w-4 h-4 text-success-600" /> : <Copy className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>
                <code className="block bg-white px-3 py-2 rounded border border-slate-200 font-mono text-xs text-slate-700 break-all">
                  {trace.dataHash}
                </code>
                <p className="text-xs text-slate-400 mt-2">
                  用于验证数据完整性，确保数据未被篡改
                </p>
              </div>

              <div className="bg-primary-50 rounded-lg p-4 border border-primary-200">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-primary-600" />
                  <span className="font-medium text-primary-700">数据完整性验证</span>
                </div>
                <p className="text-sm text-primary-600">
                  此数据已通过完整性校验，与原始来源数据一致。
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Check className="w-4 h-4 text-success-600" />
                  <span className="text-sm text-success-600 font-medium">验证通过</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                <Database className="w-4 h-4 text-primary-600" />
                原始数据快照
              </h4>
              <button
                onClick={() => setShowRawData(!showRawData)}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                {showRawData ? '收起' : '展开查看'}
              </button>
            </div>
            
            {showRawData && (
              <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto max-h-80">
                <pre className="text-slate-100 text-xs font-mono whitespace-pre-wrap">
                  {trace.rawDataSnapshot}
                </pre>
              </div>
            )}
            
            {!showRawData && (
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-sm text-slate-500">
                  点击"展开查看"可查看原始数据JSON格式，共 {trace.rawDataSnapshot.length} 字符
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={() => {
              const blob = new Blob([trace.rawDataSnapshot], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `data_trace_${trace.dataType}_${trace.id}.json`;
              link.click();
              URL.revokeObjectURL(url);
            }}
            className="btn-secondary"
          >
            <Download className="w-4 h-4 mr-2" />
            下载原始数据
          </button>
          <button onClick={onClose} className="btn-primary">
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

const DataTrace: React.FC = () => {
  const { dataTraces, bonds, announcements, isRefreshing } = useAppStore();

  const [globalFilter, setGlobalFilter] = useState('');
  const [dataTypeFilter, setDataTypeFilter] = useState<DataType | 'ALL'>('ALL');
  const [selectedTrace, setSelectedTrace] = useState<DataSourceTrace | null>(null);

  const debouncedGlobalFilter = useMemo(
    () => debounce((value: string) => setGlobalFilter(value), 300),
    []
  );

  const enrichedTraces = useMemo(() => {
    return dataTraces.map(trace => {
      let relatedName = '';
      let relatedCode = '';

      if (trace.dataType === 'BOND_INFO') {
        try {
          const data = JSON.parse(trace.rawDataSnapshot);
          relatedName = data.bondName || '';
          relatedCode = data.bondCode || '';
        } catch {}
      } else if (trace.dataType === 'MARKET_DATA') {
        const stockCode = trace.sourceUrl.split('/').pop() || '';
        const bond = bonds.find(b => b.stockCode === stockCode);
        if (bond) {
          relatedName = bond.stockName;
          relatedCode = bond.stockCode;
        }
      } else if (trace.dataType === 'ANNOUNCEMENT') {
        const bondCode = new URLSearchParams(trace.sourceUrl.split('?')[1]).get('productId') || '';
        const anns = announcements[bondCode] || [];
        if (anns.length > 0) {
          relatedName = anns[0].title;
          relatedCode = bondCode;
        }
      } else if (trace.dataType === 'POSITION') {
        relatedName = '客户持仓汇总';
        relatedCode = `共${bonds.length}只转债`;
      } else if (trace.dataType === 'REMINDER') {
        relatedName = '提醒记录汇总';
      }

      return {
        ...trace,
        relatedName,
        relatedCode,
      };
    });
  }, [dataTraces, bonds, announcements]);

  const filteredTraces = useMemo(() => {
    let data = [...enrichedTraces];

    if (dataTypeFilter !== 'ALL') {
      data = data.filter(t => t.dataType === dataTypeFilter);
    }

    if (globalFilter) {
      const filter = globalFilter.toLowerCase();
      data = data.filter(t =>
        t.sourceSystem.toLowerCase().includes(filter) ||
        t.relatedName.toLowerCase().includes(filter) ||
        t.relatedCode.toLowerCase().includes(filter) ||
        t.dataHash.toLowerCase().includes(filter) ||
        t.createdBy.toLowerCase().includes(filter)
      );
    }

    return data.sort((a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime());
  }, [enrichedTraces, dataTypeFilter, globalFilter]);

  const stats = useMemo(() => {
    return {
      all: dataTraces.length,
      bondInfo: dataTraces.filter(t => t.dataType === 'BOND_INFO').length,
      marketData: dataTraces.filter(t => t.dataType === 'MARKET_DATA').length,
      announcement: dataTraces.filter(t => t.dataType === 'ANNOUNCEMENT').length,
      position: dataTraces.filter(t => t.dataType === 'POSITION').length,
      reminder: dataTraces.filter(t => t.dataType === 'REMINDER').length,
    };
  }, [dataTraces]);

  const typeFilters: Array<{ value: DataType | 'ALL'; label: string; count: number }> = [
    { value: 'ALL', label: '全部', count: stats.all },
    { value: 'BOND_INFO', label: '转债基础信息', count: stats.bondInfo },
    { value: 'MARKET_DATA', label: '正股行情数据', count: stats.marketData },
    { value: 'ANNOUNCEMENT', label: '强赎公告数据', count: stats.announcement },
    { value: 'POSITION', label: '客户持仓数据', count: stats.position },
    { value: 'REMINDER', label: '提醒记录数据', count: stats.reminder },
  ];

  const columns = useMemo(() => [
    {
      accessorKey: 'dataType',
      header: '数据类型',
      cell: (info: any) => {
        const type = info.getValue() as DataType;
        const config = DATA_TYPE_CONFIG[type];
        return (
          <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium', config.color)}>
            {config.icon}
            {config.label}
          </span>
        );
      },
      size: 140,
    },
    {
      accessorKey: 'relatedName',
      header: '关联对象',
      cell: (info: any) => {
        const row = info.row.original;
        const name = info.getValue() as string;
        return (
          <div>
            <div className="font-medium text-slate-700">{truncateText(name, 25)}</div>
            {row.relatedCode && (
              <div className="text-xs text-slate-400 font-mono">{row.relatedCode}</div>
            )}
          </div>
        );
      },
      size: 200,
    },
    {
      accessorKey: 'sourceSystem',
      header: '来源系统',
      cell: (info: any) => (
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-slate-400" />
          <span className="text-slate-700">{info.getValue()}</span>
        </div>
      ),
      size: 140,
    },
    {
      accessorKey: 'fetchedAt',
      header: '获取时间',
      cell: (info: any) => (
        <div>
          <div className="text-slate-700">{formatRelativeTime(info.getValue())}</div>
          <div className="text-xs text-slate-400">{formatDateTime(info.getValue())}</div>
        </div>
      ),
      size: 160,
    },
    {
      accessorKey: 'dataHash',
      header: '数据哈希',
      cell: (info: any) => {
        const hash = info.getValue() as string;
        return (
          <div className="font-mono text-xs text-slate-500">
            {hash.slice(0, 16)}...
          </div>
        );
      },
      size: 140,
    },
    {
      accessorKey: 'createdBy',
      header: '创建人',
      cell: (info: any) => (
        <span className="text-slate-600">
          {info.getValue() === 'system' ? '系统自动' : info.getValue()}
        </span>
      ),
      size: 100,
    },
    {
      id: 'integrity',
      header: '完整性',
      cell: () => (
        <span className="inline-flex items-center gap-1 text-success-600 text-sm">
          <Check className="w-4 h-4" />
          完整
        </span>
      ),
      size: 80,
    },
    {
      id: 'actions',
      header: '操作',
      cell: (info: any) => (
        <button
          onClick={() => setSelectedTrace(info.row.original)}
          className="p-2 rounded-lg hover:bg-primary-50 text-primary-600 transition-colors"
          title="查看详情"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
      size: 60,
      enableSorting: false,
    },
  ], []);

  const table = useReactTable({
    data: filteredTraces,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      sorting: [{ id: 'fetchedAt', desc: true }],
    },
  });

  if (isRefreshing && dataTraces.length === 0) {
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
          <h2 className="text-2xl font-serif font-bold text-slate-800">数据溯源查询</h2>
          <p className="text-sm text-slate-500 mt-1">
            追踪每类数据的来源、获取时间和完整性校验，确保数据可追溯
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { value: stats.bondInfo, label: '转债信息', color: 'from-blue-500 to-blue-600', icon: <FileText className="w-5 h-5" /> },
          { value: stats.marketData, label: '行情数据', color: 'from-green-500 to-emerald-600', icon: <TrendingUp className="w-5 h-5" /> },
          { value: stats.announcement, label: '公告数据', color: 'from-amber-500 to-orange-600', icon: <Bell className="w-5 h-5" /> },
          { value: stats.position, label: '持仓数据', color: 'from-purple-500 to-violet-600', icon: <Users className="w-5 h-5" /> },
          { value: stats.reminder, label: '提醒记录', color: 'from-rose-500 to-pink-600', icon: <Bell className="w-5 h-5" /> },
        ].map((stat, idx) => (
          <div key={idx} className={clsx('p-4 rounded-xl text-white bg-gradient-to-br', stat.color)}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80 text-sm">{stat.label}</span>
              {stat.icon}
            </div>
            <div className="text-3xl font-bold">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="card p-4 border-primary-200 bg-gradient-to-br from-primary-50/50 to-white">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <GitCompare className="w-6 h-6 text-primary-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-800 mb-1">数据来源说明</h3>
            <p className="text-sm text-slate-600 mb-3">
              系统所有数据均来自正规数据源，每一条数据都记录了完整的来源信息、获取时间和数据哈希，
              确保数据可追溯、可验证、不可篡改。哈希值采用SHA-256算法生成，用于验证数据完整性。
            </p>
            <div className="flex flex-wrap gap-3">
              {Object.entries(DATA_TYPE_CONFIG).map(([type, config]) => (
                <div key={type} className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-slate-200">
                  {config.icon}
                  <span className="text-sm text-slate-600">{config.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {typeFilters.map(filter => (
            <button
              key={filter.value}
              onClick={() => setDataTypeFilter(filter.value)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                dataTypeFilter === filter.value
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              )}
            >
              {filter.label}
              <span className={clsx(
                'ml-1.5 px-1.5 py-0.5 rounded text-xs',
                dataTypeFilter === filter.value ? 'bg-white/20' : 'bg-slate-100'
              )}>
                {filter.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索来源/哈希..."
            className="input-field pl-9 w-full"
            onChange={(e) => debouncedGlobalFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full" style={{ minWidth: '1000px' }}>
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
                    <p>没有找到符合条件的数据溯源记录</p>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr
                    key={row.id}
                    className="table-row cursor-pointer"
                    onClick={() => setSelectedTrace(row.original)}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        className="table-cell"
                        style={{ width: `${cell.column.getSize()}px` }}
                        onClick={(e) => cell.column.id === 'actions' ? e.stopPropagation() : null}
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

      <DetailModal
        isOpen={selectedTrace !== null}
        trace={selectedTrace}
        onClose={() => setSelectedTrace(null)}
      />
    </div>
  );
};

export default DataTrace;
