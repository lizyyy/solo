import React, { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import {
  ListTodo,
  CheckCircle,
  Clock,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Filter,
  Search,
  Download,
  CheckSquare,
  Square,
  Eye,
  Check,
  X,
  AlertTriangle,
  FileText,
  User,
  TrendingUp,
  ArrowRight,
  MoreVertical,
  Menu,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { exportService, TASK_STATUS_TEXT, TASK_PRIORITY_TEXT } from '@/services/ExportService';
import {
  formatNumber,
  formatDateTime,
  formatRelativeTime,
  getStatusBadgeClass,
  debounce,
} from '@/utils/format';
import clsx from 'clsx';
import type { DisposalTask, TaskStatus, TaskPriority } from '@/types';

const TASK_TYPE_TEXT = {
  REMIND_CUSTOMER: '客户提醒',
  CONFIRM_DATA: '数据确认',
  SUPPLEMENT_DATA: '补充材料',
};

const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING_CONFIRM: { label: '待确认', color: 'warning', icon: <Clock className="w-4 h-4" /> },
  PROCESSING: { label: '处理中', color: 'primary', icon: <TrendingUp className="w-4 h-4" /> },
  PROCESSED: { label: '已处理', color: 'success', icon: <CheckCircle className="w-4 h-4" /> },
  RETURNED: { label: '需退回', color: 'danger', icon: <RotateCcw className="w-4 h-4" /> },
};

const TASK_PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  HIGH: { label: '高', color: 'bg-danger-100 text-danger-700' },
  MEDIUM: { label: '中', color: 'bg-warning-100 text-warning-700' },
  LOW: { label: '低', color: 'bg-slate-100 text-slate-600' },
};

interface ReturnModalProps {
  isOpen: boolean;
  task: DisposalTask | null;
  onClose: () => void;
  onConfirm: (reason: string, supplement: string) => void;
}

const ReturnModal: React.FC<ReturnModalProps> = ({ isOpen, task, onClose, onConfirm }) => {
  const [reason, setReason] = useState('');
  const [supplement, setSupplement] = useState('');

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-danger-100 rounded-lg flex items-center justify-center">
              <RotateCcw className="w-5 h-5 text-danger-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">退回任务</h3>
              <p className="text-sm text-slate-500">{task.bondName}（{task.bondCode}）</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">退回原因</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请输入退回原因..."
              className="input-field w-full h-24 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">补充材料要求</label>
            <textarea
              value={supplement}
              onChange={(e) => setSupplement(e.target.value)}
              placeholder="请说明需要补充的材料..."
              className="input-field w-full h-24 resize-none"
            />
          </div>
        </div>
        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">
            取消
          </button>
          <button
            onClick={() => {
              onConfirm(reason, supplement);
              setReason('');
              setSupplement('');
            }}
            disabled={!reason.trim()}
            className={clsx('btn-primary', !reason.trim() && 'opacity-50 cursor-not-allowed')}
          >
            确认退回
          </button>
        </div>
      </div>
    </div>
  );
};

const DisposalCenter: React.FC = () => {
  const {
    disposalTasks,
    positions,
    bonds,
    reminderLogs,
    selectedTaskIds,
    toggleTaskSelection,
    clearTaskSelection,
    selectAllTasks,
    updateTaskStatus,
    setSelectedBond,
    isRefreshing,
  } = useAppStore();

  const [globalFilter, setGlobalFilter] = useState('');
  const [activeTab, setActiveTab] = useState<TaskStatus | 'ALL'>('ALL');
  const [selectedTask, setSelectedTask] = useState<DisposalTask | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnTask, setReturnTask] = useState<DisposalTask | null>(null);
  const [actionMenuTask, setActionMenuTask] = useState<string | null>(null);

  const debouncedGlobalFilter = useMemo(
    () => debounce((value: string) => setGlobalFilter(value), 300),
    []
  );

  const filteredTasks = useMemo(() => {
    let data = [...disposalTasks];

    if (activeTab !== 'ALL') {
      data = data.filter(t => t.status === activeTab);
    }

    if (globalFilter) {
      const filter = globalFilter.toLowerCase();
      data = data.filter(t =>
        t.bondName.toLowerCase().includes(filter) ||
        t.bondCode.toLowerCase().includes(filter) ||
        t.assignedTo.toLowerCase().includes(filter) ||
        t.remarks?.toLowerCase().includes(filter)
      );
    }

    return data.sort((a, b) => {
      const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [disposalTasks, activeTab, globalFilter]);

  const stats = useMemo(() => {
    return {
      all: disposalTasks.length,
      pending: disposalTasks.filter(t => t.status === 'PENDING_CONFIRM').length,
      processing: disposalTasks.filter(t => t.status === 'PROCESSING').length,
      processed: disposalTasks.filter(t => t.status === 'PROCESSED').length,
      returned: disposalTasks.filter(t => t.status === 'RETURNED').length,
    };
  }, [disposalTasks]);

  const tabs = [
    { value: 'ALL' as const, label: '全部', count: stats.all, icon: <ListTodo className="w-4 h-4" /> },
    { value: 'PENDING_CONFIRM' as const, label: '待确认', count: stats.pending, icon: <Clock className="w-4 h-4" /> },
    { value: 'PROCESSING' as const, label: '处理中', count: stats.processing, icon: <TrendingUp className="w-4 h-4" /> },
    { value: 'PROCESSED' as const, label: '已处理', count: stats.processed, icon: <CheckCircle className="w-4 h-4" /> },
    { value: 'RETURNED' as const, label: '需退回', count: stats.returned, icon: <RotateCcw className="w-4 h-4" /> },
  ];

  const columns = useMemo(() => [
    {
      id: 'select',
      header: () => {
        const allSelected = filteredTasks.length > 0 && filteredTasks.every(t => selectedTaskIds.has(t.id));
        const someSelected = filteredTasks.some(t => selectedTaskIds.has(t.id));
        
        return (
          <button
            onClick={() => allSelected ? clearTaskSelection() : selectAllTasks(filteredTasks.map(t => t.id))}
            className="p-1 hover:bg-slate-100 rounded"
          >
            {allSelected ? (
              <CheckSquare className="w-4 h-4 text-primary-600" />
            ) : someSelected ? (
              <div className="w-4 h-4 border-2 border-primary-600 bg-primary-600/20 rounded" />
            ) : (
              <Square className="w-4 h-4 text-slate-300" />
            )}
          </button>
        );
      },
      cell: (info: any) => {
        const task = info.row.original as DisposalTask;
        const isSelected = selectedTaskIds.has(task.id);
        
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleTaskSelection(task.id);
            }}
            className="p-1 hover:bg-slate-100 rounded"
          >
            {isSelected ? (
              <CheckSquare className="w-4 h-4 text-primary-600" />
            ) : (
              <Square className="w-4 h-4 text-slate-300" />
            )}
          </button>
        );
      },
      size: 40,
      enableSorting: false,
    },
    {
      accessorKey: 'priority',
      header: '优先级',
      cell: (info: any) => {
        const priority = info.getValue() as TaskPriority;
        return (
          <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', TASK_PRIORITY_CONFIG[priority].color)}>
            {TASK_PRIORITY_TEXT[priority]}
          </span>
        );
      },
      size: 70,
    },
    {
      accessorKey: 'bondName',
      header: '转债信息',
      cell: (info: any) => {
        const row = info.row.original;
        return (
          <div>
            <div className="font-medium text-slate-800">{info.getValue()}</div>
            <div className="text-xs text-slate-400 font-mono">{row.bondCode}</div>
          </div>
        );
      },
      size: 160,
    },
    {
      accessorKey: 'taskType',
      header: '任务类型',
      cell: (info: any) => (
        <span className="text-slate-600">{TASK_TYPE_TEXT[info.getValue() as keyof typeof TASK_TYPE_TEXT]}</span>
      ),
      size: 90,
    },
    {
      accessorKey: 'status',
      header: '状态',
      cell: (info: any) => {
        const status = info.getValue() as TaskStatus;
        const config = TASK_STATUS_CONFIG[status];
        return (
          <span className={getStatusBadgeClass(status)}>
            <span className="inline-flex items-center gap-1">
              {config.icon}
              {config.label}
            </span>
          </span>
        );
      },
      size: 100,
    },
    {
      accessorKey: 'customerCount',
      header: '涉及客户',
      cell: (info: any) => (
        <span className="text-slate-700">{info.getValue()} 位</span>
      ),
      size: 80,
    },
    {
      accessorKey: 'totalPosition',
      header: '持仓金额',
      cell: (info: any) => (
        <span className="font-semibold text-slate-800">{formatNumber(info.getValue())}</span>
      ),
      size: 110,
    },
    {
      accessorKey: 'assignedTo',
      header: '处理人',
      cell: (info: any) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
            <User className="w-3 h-3 text-primary-600" />
          </div>
          <span className="text-slate-600 text-sm">{info.getValue()}</span>
        </div>
      ),
      size: 100,
    },
    {
      accessorKey: 'createdAt',
      header: '创建时间',
      cell: (info: any) => (
        <div>
          <div className="text-slate-700 text-sm">{formatRelativeTime(info.getValue())}</div>
          <div className="text-xs text-slate-400">{formatDateTime(info.getValue())}</div>
        </div>
      ),
      size: 150,
    },
    {
      accessorKey: 'returnReason',
      header: '退回原因',
      cell: (info: any) => {
        const reason = info.getValue();
        if (!reason) return <span className="text-slate-300">—</span>;
        return (
          <div className="max-w-[150px]">
            <span className="text-sm text-danger-600" title={reason}>
              {reason.length > 15 ? reason.slice(0, 15) + '...' : reason}
            </span>
          </div>
        );
      },
      size: 150,
    },
    {
      id: 'actions',
      header: '操作',
      cell: (info: any) => {
        const task = info.row.original as DisposalTask;
        const isMenuOpen = actionMenuTask === task.id;
        
        return (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActionMenuTask(isMenuOpen ? null : task.id);
              }}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <MoreVertical className="w-4 h-4 text-slate-500" />
            </button>
            
            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setActionMenuTask(null)} />
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20 min-w-[140px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTask(task);
                      setActionMenuTask(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    查看详情
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBond(task.bondCode);
                      setActionMenuTask(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    查看转债
                  </button>
                  
                  {task.status === 'PENDING_CONFIRM' && (
                    <>
                      <div className="border-t border-slate-100 my-1" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateTaskStatus(task.id, 'PROCESSING');
                          setActionMenuTask(null);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-primary-600 hover:bg-primary-50 flex items-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        确认处理
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setReturnTask(task);
                          setShowReturnModal(true);
                          setActionMenuTask(null);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-danger-600 hover:bg-danger-50 flex items-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        退回补材料
                      </button>
                    </>
                  )}
                  
                  {task.status === 'PROCESSING' && (
                    <>
                      <div className="border-t border-slate-100 my-1" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateTaskStatus(task.id, 'PROCESSED');
                          setActionMenuTask(null);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-success-600 hover:bg-success-50 flex items-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        标记完成
                      </button>
                    </>
                  )}
                  
                  {task.status === 'RETURNED' && (
                    <>
                      <div className="border-t border-slate-100 my-1" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateTaskStatus(task.id, 'PROCESSING');
                          setActionMenuTask(null);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-primary-600 hover:bg-primary-50 flex items-center gap-2"
                      >
                        <ArrowRight className="w-4 h-4" />
                        重新处理
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        );
      },
      size: 60,
      enableSorting: false,
    },
  ], [selectedTaskIds, filteredTasks, actionMenuTask, toggleTaskSelection, clearTaskSelection, selectAllTasks, updateTaskStatus, setSelectedBond]);

  const table = useReactTable({
    data: filteredTasks,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      sorting: [{ id: 'createdAt', desc: true }],
    },
  });

  const handleExport = () => {
    const blob = exportService.exportDisposalList(disposalTasks, positions, activeTab);
    const filename = `处置清单_${new Date().toISOString().split('T')[0]}.xlsx`;
    exportService.downloadBlob(blob, filename);
  };

  const handleBatchConfirm = () => {
    selectedTaskIds.forEach(id => {
      const task = disposalTasks.find(t => t.id === id);
      if (task && task.status === 'PENDING_CONFIRM') {
        updateTaskStatus(id, 'PROCESSING');
      }
    });
    clearTaskSelection();
  };

  const handleBatchComplete = () => {
    selectedTaskIds.forEach(id => {
      const task = disposalTasks.find(t => t.id === id);
      if (task && task.status === 'PROCESSING') {
        updateTaskStatus(id, 'PROCESSED');
      }
    });
    clearTaskSelection();
  };

  const selectedTaskPositions = useMemo(() => {
    if (!selectedTask) return [];
    return positions.filter(p => p.bondCode === selectedTask.bondCode);
  }, [selectedTask, positions]);

  const selectedTaskReminders = useMemo(() => {
    if (!selectedTask) return [];
    return reminderLogs
      .filter(r => r.bondCode === selectedTask.bondCode)
      .sort((a, b) => new Date(b.remindedAt).getTime() - new Date(a.remindedAt).getTime());
  }, [selectedTask, reminderLogs]);

  const selectedTaskBond = useMemo(() => {
    if (!selectedTask) return null;
    return bonds.find(b => b.bondCode === selectedTask.bondCode);
  }, [selectedTask, bonds]);

  if (isRefreshing && disposalTasks.length === 0) {
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
          <h2 className="text-2xl font-serif font-bold text-slate-800">处置清单中心</h2>
          <p className="text-sm text-slate-500 mt-1">
            共 {disposalTasks.length} 个处置任务，支持批量操作和状态流转
          </p>
        </div>
        <button onClick={handleExport} className="btn-primary">
          <Download className="w-4 h-4 mr-2" />
          导出清单
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { value: stats.all, label: '全部任务', color: 'from-primary-500 to-blue-500', icon: <ListTodo className="w-5 h-5" /> },
          { value: stats.pending, label: '待确认', color: 'from-warning-500 to-orange-500', icon: <Clock className="w-5 h-5" /> },
          { value: stats.processing, label: '处理中', color: 'from-info-500 to-cyan-500', icon: <TrendingUp className="w-5 h-5" /> },
          { value: stats.processed, label: '已处理', color: 'from-success-500 to-emerald-500', icon: <CheckCircle className="w-5 h-5" /> },
          { value: stats.returned, label: '需退回', color: 'from-danger-500 to-rose-500', icon: <RotateCcw className="w-5 h-5" /> },
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

      <div className="card p-0 overflow-hidden">
        <div className="border-b border-slate-200">
          <div className="flex flex-wrap">
            {tabs.map(tab => (
              <button
                key={tab.value}
                onClick={() => {
                  setActiveTab(tab.value);
                  clearTaskSelection();
                }}
                className={clsx(
                  'flex items-center gap-2 px-5 py-3 border-b-2 transition-all',
                  activeTab === tab.value
                    ? 'border-primary-600 text-primary-600 bg-primary-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                )}
              >
                {tab.icon}
                {tab.label}
                <span className={clsx(
                  'px-1.5 py-0.5 rounded text-xs',
                  activeTab === tab.value ? 'bg-primary-100 text-primary-600' : 'bg-slate-100 text-slate-500'
                )}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {selectedTaskIds.size > 0 && (
            <div className="flex items-center gap-3 flex-1">
              <span className="text-sm text-slate-600">
                已选择 <span className="font-semibold text-primary-600">{selectedTaskIds.size}</span> 项
              </span>
              
              {activeTab === 'ALL' || activeTab === 'PENDING_CONFIRM' ? (
                <button onClick={handleBatchConfirm} className="btn-secondary text-sm">
                  <Check className="w-4 h-4 mr-1" />
                  批量确认
                </button>
              ) : null}
              
              {activeTab === 'ALL' || activeTab === 'PROCESSING' ? (
                <button onClick={handleBatchComplete} className="btn-secondary text-sm">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  批量完成
                </button>
              ) : null}
              
              <button onClick={clearTaskSelection} className="text-sm text-slate-500 hover:text-slate-700">
                取消选择
              </button>
            </div>
          )}
          
          <div className="relative w-full sm:w-64 ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索转债名称/代码..."
              className="input-field pl-9 w-full"
              onChange={(e) => debouncedGlobalFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full" style={{ minWidth: '1100px' }}>
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
                    <p>没有找到符合条件的任务</p>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr
                    key={row.id}
                    className={clsx(
                      'table-row cursor-pointer',
                      selectedTask?.id === row.original.id && 'bg-primary-50/50'
                    )}
                    onClick={() => setSelectedTask(row.original)}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        className="table-cell"
                        style={{ width: `${cell.column.getSize()}px` }}
                        onClick={(e) => cell.column.id === 'select' || cell.column.id === 'actions' ? e.stopPropagation() : null}
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

      {selectedTask && (
        <div className="card">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                  {selectedTask.bondName} 处置任务详情
                </h3>
                <p className="text-sm text-slate-500">
                  任务ID：{selectedTask.id} · 创建于 {formatDateTime(selectedTask.createdAt)}
                </p>
              </div>
            </div>
            <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-slate-100 rounded-lg">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-sm text-slate-500 mb-1">任务状态</div>
              <span className={getStatusBadgeClass(selectedTask.status)}>
                <span className="inline-flex items-center gap-1">
                  {TASK_STATUS_CONFIG[selectedTask.status].icon}
                  {TASK_STATUS_CONFIG[selectedTask.status].label}
                </span>
              </span>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-sm text-slate-500 mb-1">优先级</div>
              <span className={clsx('inline-flex items-center gap-1 px-2.5 py-1 rounded text-sm font-medium', TASK_PRIORITY_CONFIG[selectedTask.priority].color)}>
                {TASK_PRIORITY_TEXT[selectedTask.priority]}优先级
              </span>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-sm text-slate-500 mb-1">涉及客户</div>
              <div className="text-xl font-bold text-slate-800">{selectedTask.customerCount} 位</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-sm text-slate-500 mb-1">持仓总金额</div>
              <div className="text-xl font-bold text-slate-800">{formatNumber(selectedTask.totalPosition)}</div>
            </div>
          </div>

          {selectedTask.returnReason && (
            <div className="mb-6 p-4 bg-danger-50 rounded-lg border border-danger-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-danger-600 mt-0.5" />
                <div>
                  <div className="font-medium text-danger-800 mb-1">退回原因</div>
                  <p className="text-sm text-danger-700">{selectedTask.returnReason}</p>
                  {selectedTask.supplementRequirements && (
                    <>
                      <div className="font-medium text-danger-800 mt-3 mb-1">补充材料要求</div>
                      <p className="text-sm text-danger-700">{selectedTask.supplementRequirements}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-primary-600" />
                涉及客户列表
              </h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                {selectedTaskPositions.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">暂无持仓数据</div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">客户名称</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">持仓金额</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">客户经理</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedTaskPositions.map(pos => (
                        <tr key={pos.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2">
                            <div className="font-medium text-slate-700">{pos.customerName}</div>
                            <div className="text-xs text-slate-400">{pos.customerId}</div>
                          </td>
                          <td className="px-3 py-2 text-slate-700 font-medium">{formatNumber(pos.positionAmount)}</td>
                          <td className="px-3 py-2 text-slate-600 text-sm">{pos.accountManager}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary-600" />
                提醒记录
              </h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                {selectedTaskReminders.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">暂无提醒记录</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {selectedTaskReminders.map(log => (
                      <div key={log.id} className="p-3 hover:bg-slate-50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-slate-700">{log.customerName}</span>
                          <span className={getStatusBadgeClass(log.status)}>
                            {log.status === 'SENT' ? '已发送' : log.status === 'FAILED' ? '失败' : log.status === 'PENDING' ? '待发送' : '已取消'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mb-1">{log.reminderContent}</div>
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>{log.operatorName} · {log.reminderType === 'SMS' ? '短信' : log.reminderType === 'EMAIL' ? '邮件' : log.reminderType === 'PHONE' ? '电话' : '系统'}</span>
                          <span>{formatRelativeTime(log.remindedAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {selectedTaskBond && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <h4 className="font-semibold text-slate-800 mb-3">转债基本信息</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-slate-400 mb-1">转债代码</div>
                  <div className="font-mono text-slate-700">{selectedTaskBond.bondCode}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">正股名称</div>
                  <div className="text-slate-700">{selectedTaskBond.stockName}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">强赎触发价</div>
                  <div className="text-slate-700 font-medium">¥{selectedTaskBond.redemptionPrice.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">当前正股价</div>
                  <div className={clsx('font-medium', selectedTaskBond.stockPrice >= selectedTaskBond.redemptionPrice ? 'text-danger-600' : 'text-slate-700')}>
                    ¥{selectedTaskBond.stockPrice.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-slate-200 flex flex-wrap gap-3 justify-end">
            {selectedTask.status === 'PENDING_CONFIRM' && (
              <>
                <button
                  onClick={() => {
                    setReturnTask(selectedTask);
                    setShowReturnModal(true);
                  }}
                  className="btn-secondary border-danger-200 text-danger-600 hover:bg-danger-50"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  退回补材料
                </button>
                <button
                  onClick={() => updateTaskStatus(selectedTask.id, 'PROCESSING')}
                  className="btn-primary"
                >
                  <Check className="w-4 h-4 mr-2" />
                  确认处理
                </button>
              </>
            )}
            {selectedTask.status === 'PROCESSING' && (
              <button
                onClick={() => updateTaskStatus(selectedTask.id, 'PROCESSED')}
                className="btn-primary bg-success-600 hover:bg-success-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                标记完成
              </button>
            )}
            {selectedTask.status === 'RETURNED' && (
              <button
                onClick={() => updateTaskStatus(selectedTask.id, 'PROCESSING')}
                className="btn-primary"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                重新处理
              </button>
            )}
          </div>
        </div>
      )}

      <ReturnModal
        isOpen={showReturnModal}
        task={returnTask}
        onClose={() => {
          setShowReturnModal(false);
          setReturnTask(null);
        }}
        onConfirm={(reason, supplement) => {
          if (returnTask) {
            updateTaskStatus(returnTask.id, 'RETURNED', reason, supplement);
          }
          setShowReturnModal(false);
          setReturnTask(null);
        }}
      />
    </div>
  );
};

export default DisposalCenter;
