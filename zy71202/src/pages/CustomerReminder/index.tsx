import React, { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import {
  Users,
  Shield,
  Clock,
  Send,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Filter,
  Search,
  Phone,
  Mail,
  MessageSquare,
  Monitor,
  History,
  Zap,
  Crown,
  Star,
  Award,
  User,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { idempotencyService } from '@/services/IdempotencyService';
import { customerTierService, TIER_TEXT, TIER_COLOR, CUSTOMER_TYPE_TEXT, RISK_LEVEL_TEXT, RISK_LEVEL_COLOR } from '@/services/CustomerTierService';
import {
  formatNumber,
  formatMoney,
  formatDateTime,
  formatRelativeTime,
  getStatusBadgeClass,
  debounce,
} from '@/utils/format';
import clsx from 'clsx';
import type { CustomerPosition, ReminderType, CustomerTier } from '@/types';

const REMINDER_TYPE_ICONS: Record<ReminderType, React.ReactNode> = {
  SMS: <MessageSquare className="w-3.5 h-3.5" />,
  EMAIL: <Mail className="w-3.5 h-3.5" />,
  PHONE: <Phone className="w-3.5 h-3.5" />,
  SYSTEM: <Monitor className="w-3.5 h-3.5" />,
};

const REMINDER_TYPE_TEXT: Record<ReminderType, string> = {
  SMS: '短信',
  EMAIL: '邮件',
  PHONE: '电话',
  SYSTEM: '系统',
};

const TIER_ICONS: Record<CustomerTier, React.ReactNode> = {
  PLATINUM: <Crown className="w-4 h-4" />,
  GOLD: <Star className="w-4 h-4" />,
  SILVER: <Award className="w-4 h-4" />,
  BRONZE: <User className="w-4 h-4" />,
};

const CustomerReminder: React.FC = () => {
  const {
    bonds,
    positions,
    reminderLogs,
    selectedBondCode,
    sendReminder,
    isRefreshing,
  } = useAppStore();

  const [globalFilter, setGlobalFilter] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [selectedReminderTypes, setSelectedReminderTypes] = useState<ReminderType[]>(['SMS', 'EMAIL']);
  const [showDedupePanel, setShowDedupePanel] = useState(true);

  const debouncedGlobalFilter = useMemo(
    () => debounce((value: string) => setGlobalFilter(value), 300),
    []
  );

  const filteredPositions = useMemo(() => {
    let data = selectedBondCode
      ? positions.filter(p => p.bondCode === selectedBondCode)
      : positions;

    if (tierFilter !== 'all') {
      data = data.filter(p => p.tier === tierFilter);
    }

    if (globalFilter) {
      const filter = globalFilter.toLowerCase();
      data = data.filter(p =>
        p.customerName.toLowerCase().includes(filter) ||
        p.customerId.toLowerCase().includes(filter) ||
        p.bondName.toLowerCase().includes(filter) ||
        p.bondCode.toLowerCase().includes(filter) ||
        p.accountManager.toLowerCase().includes(filter)
      );
    }

    return customerTierService.sortByPriority(data);
  }, [positions, selectedBondCode, tierFilter, globalFilter]);

  const dedupeResult = useMemo(() => {
    const pendingReminders = filteredPositions.map(p => ({
      bondCode: p.bondCode,
      customerId: p.customerId,
      customerName: p.customerName,
      reminderType: selectedReminderTypes[0] as ReminderType,
    }));

    return idempotencyService.dedupeReminders(
      pendingReminders,
      reminderLogs,
      undefined,
      7
    );
  }, [filteredPositions, reminderLogs, selectedReminderTypes]);

  const dedupeStats = useMemo(() => {
    return idempotencyService.getDedupeStatistics(
      dedupeResult.toSend.length,
      dedupeResult.duplicates.length
    );
  }, [dedupeResult]);

  const tierStatistics = useMemo(() => {
    return customerTierService.calculateTierStatistics(filteredPositions);
  }, [filteredPositions]);

  const recentReminders = useMemo(() => {
    return [...reminderLogs]
      .sort((a, b) => new Date(b.remindedAt).getTime() - new Date(a.remindedAt).getTime())
      .slice(0, 20);
  }, [reminderLogs]);

  const columns = useMemo(() => [
    {
      accessorKey: 'tier',
      header: '层级',
      cell: (info: any) => {
        const tier = info.getValue() as CustomerTier;
        return (
          <div className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold', TIER_COLOR[tier])}>
            {TIER_ICONS[tier]}
            {TIER_TEXT[tier]}
          </div>
        );
      },
      size: 110,
    },
    {
      accessorKey: 'customerName',
      header: '客户名称',
      cell: (info: any) => {
        const row = info.row.original;
        return (
          <div>
            <div className="font-medium text-slate-800">{info.getValue()}</div>
            <div className="text-xs text-slate-400">{row.customerId}</div>
          </div>
        );
      },
      size: 160,
    },
    {
      accessorKey: 'customerType',
      header: '客户类型',
      cell: (info: any) => {
        const value = info.getValue() as keyof typeof CUSTOMER_TYPE_TEXT;
        return (
          <span className="text-slate-600">{CUSTOMER_TYPE_TEXT[value]}</span>
        );
      },
      size: 90,
    },
    {
      accessorKey: 'riskLevel',
      header: '风险等级',
      cell: (info: any) => {
        const value = info.getValue() as keyof typeof RISK_LEVEL_TEXT;
        return (
          <span className={clsx('badge', RISK_LEVEL_COLOR[value])}>
            {RISK_LEVEL_TEXT[value]}
          </span>
        );
      },
      size: 90,
    },
    {
      accessorKey: 'bondName',
      header: '持仓转债',
      cell: (info: any) => {
        const row = info.row.original;
        return (
          <div>
            <div className="text-slate-700">{info.getValue()}</div>
            <div className="text-xs text-slate-400 font-mono">{row.bondCode}</div>
          </div>
        );
      },
      size: 160,
    },
    {
      accessorKey: 'positionAmount',
      header: '持仓金额',
      cell: (info: any) => (
        <span className="font-semibold text-slate-800">{formatNumber(info.getValue())}</span>
      ),
      size: 110,
    },
    {
      accessorKey: 'profitLoss',
      header: '盈亏',
      cell: (info: any) => {
        const value = info.getValue();
        return (
          <span className={clsx(
            'font-semibold',
            value >= 0 ? 'text-success-600' : 'text-danger-600'
          )}>
            {value >= 0 ? '+' : ''}{formatNumber(value)}
          </span>
        );
      },
      size: 100,
    },
    {
      accessorKey: 'accountManager',
      header: '客户经理',
      cell: (info: any) => (
        <span className="text-slate-600">{info.getValue()}</span>
      ),
      size: 100,
    },
    {
      id: 'reminderStrategy',
      header: '提醒策略',
      cell: (info: any) => {
        const row = info.row.original as CustomerPosition;
        const strategy = customerTierService.getReminderStrategy(row);
        return (
          <div>
            <div className={clsx(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
              strategy.priority === 'HIGH' ? 'bg-danger-100 text-danger-700' :
              strategy.priority === 'MEDIUM' ? 'bg-warning-100 text-warning-700' :
              'bg-slate-100 text-slate-600'
            )}>
              <Zap className="w-3 h-3" />
              {strategy.priority === 'HIGH' ? '高' : strategy.priority === 'MEDIUM' ? '中' : '低'}
            </div>
            <div className="text-xs text-slate-400 mt-1">{strategy.description}</div>
          </div>
        );
      },
      size: 200,
    },
    {
      id: 'lastReminder',
      header: '上次提醒',
      cell: (info: any) => {
        const row = info.row.original;
        const lastReminder = reminderLogs
          .filter(r => r.customerId === row.customerId && r.bondCode === row.bondCode)
          .sort((a, b) => new Date(b.remindedAt).getTime() - new Date(a.remindedAt).getTime())[0];
        
        if (!lastReminder) {
          return <span className="text-slate-400">暂无</span>;
        }
        
        return (
          <div>
            <div className="flex items-center gap-1.5">
              {REMINDER_TYPE_ICONS[lastReminder.reminderType]}
              <span className={getStatusBadgeClass(lastReminder.status)}>
                {lastReminder.status === 'SENT' ? '已发送' :
                 lastReminder.status === 'FAILED' ? '发送失败' :
                 lastReminder.status === 'PENDING' ? '待发送' : '已取消'}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {formatRelativeTime(lastReminder.remindedAt)}
            </div>
          </div>
        );
      },
      size: 140,
    },
    {
      id: 'actions',
      header: '操作',
      cell: (info: any) => {
        const row = info.row.original;
        const idempotencyKey = idempotencyService.generateIdempotencyKey(
          row.bondCode,
          row.customerId,
          selectedReminderTypes[0] as ReminderType
        );
        const checkResult = idempotencyService.checkIdempotency(idempotencyKey, reminderLogs);
        
        return (
          <div className="flex items-center gap-2">
            {selectedReminderTypes.map(type => (
              <button
                key={type}
                onClick={() => handleSendReminder(row, type)}
                disabled={checkResult.isDuplicate}
                className={clsx(
                  'p-2 rounded-lg transition-all',
                  checkResult.isDuplicate
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-primary-50 text-primary-600 hover:bg-primary-100'
                )}
                title={checkResult.isDuplicate
                  ? `冷却期内，${checkResult.daysRemaining}天后可重发`
                  : `发送${REMINDER_TYPE_TEXT[type]}提醒`}
              >
                {REMINDER_TYPE_ICONS[type]}
              </button>
            ))}
          </div>
        );
      },
      size: 120,
    },
  ], [selectedReminderTypes, reminderLogs]);

  const table = useReactTable({
    data: filteredPositions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      sorting: [{ id: 'positionAmount', desc: true }],
    },
  });

  const handleSendReminder = (position: CustomerPosition, type: ReminderType) => {
    const bond = bonds.find(b => b.bondCode === position.bondCode);
    if (!bond) return;

    const content = `【强赎提醒】尊敬的${position.customerName}客户，您持有的${bond.bondName}（${bond.bondCode}）正股${bond.stockName}已满足强赎条件，请及时关注。`;

    sendReminder({
      bondCode: position.bondCode,
      customerId: position.customerId,
      customerName: position.customerName,
      reminderType: type,
      reminderContent: content,
      operatorId: 'current_user',
      operatorName: '当前用户',
      sourceTaskId: 'manual',
    });
  };

  const handleBatchSend = () => {
    if (dedupeResult.toSend.length === 0) return;

    dedupeResult.toSend.forEach(item => {
      const position = filteredPositions.find(
        p => p.customerId === item.customerId && p.bondCode === item.bondCode
      );
      const bond = bonds.find(b => b.bondCode === item.bondCode);
      
      if (position && bond) {
        const content = `【强赎提醒】尊敬的${position.customerName}客户，您持有的${bond.bondName}（${bond.bondCode}）正股${bond.stockName}已满足强赎条件，请及时关注。`;

        sendReminder({
          bondCode: item.bondCode,
          customerId: item.customerId,
          customerName: item.customerName,
          reminderType: selectedReminderTypes[0] as ReminderType,
          reminderContent: content,
          operatorId: 'current_user',
          operatorName: '当前用户',
          sourceTaskId: 'batch',
        });
      }
    });
  };

  const toggleReminderType = (type: ReminderType) => {
    setSelectedReminderTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const tierFilters = [
    { value: 'all', label: '全部' },
    { value: 'PLATINUM', label: '铂金客户' },
    { value: 'GOLD', label: '黄金客户' },
    { value: 'SILVER', label: '白银客户' },
    { value: 'BRONZE', label: '普通客户' },
  ];

  const reminderTypes: ReminderType[] = ['SMS', 'EMAIL', 'PHONE', 'SYSTEM'];

  if (isRefreshing && positions.length === 0) {
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
          <h2 className="text-2xl font-serif font-bold text-slate-800">客户提醒管理</h2>
          <p className="text-sm text-slate-500 mt-1">
            {selectedBondCode
              ? `当前查看：${bonds.find(b => b.bondCode === selectedBondCode)?.bondName} 的持仓客户`
              : '全部持仓客户，支持按层级筛选和批量提醒'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {tierStatistics.map(stat => (
          <div key={stat.tier} className="card">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', TIER_COLOR[stat.tier])}>
                    {TIER_ICONS[stat.tier]}
                  </div>
                  <span className="font-semibold text-slate-700">{stat.tierText}</span>
                </div>
                <div className="text-2xl font-bold text-slate-800">{stat.count}</div>
                <div className="text-xs text-slate-400 mt-1">持仓 {formatNumber(stat.totalPosition)}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-primary-600">{stat.percentage.toFixed(1)}%</div>
                <div className="text-xs text-slate-400">占比</div>
              </div>
            </div>
            <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={clsx('h-full rounded-full',
                  stat.tier === 'PLATINUM' ? 'bg-slate-400' :
                  stat.tier === 'GOLD' ? 'bg-yellow-500' :
                  stat.tier === 'SILVER' ? 'bg-slate-300' : 'bg-amber-700'
                )}
                style={{ width: `${stat.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {showDedupePanel && (
        <div className="card border-primary-200 bg-gradient-to-br from-primary-50/50 to-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">幂等性校验面板</h3>
                <p className="text-sm text-slate-500">{dedupeStats.description}</p>
              </div>
            </div>
            <button
              onClick={() => setShowDedupePanel(false)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <XCircle className="w-5 h-5 text-slate-400" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-500">待发送总数</span>
              </div>
              <div className="text-2xl font-bold text-slate-800">{dedupeStats.total}</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-success-200">
              <div className="flex items-center gap-2 mb-1">
                <Send className="w-4 h-4 text-success-500" />
                <span className="text-sm text-slate-500">可发送</span>
              </div>
              <div className="text-2xl font-bold text-success-600">{dedupeStats.toSendCount}</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-warning-200">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-warning-500" />
                <span className="text-sm text-slate-500">重复拦截</span>
              </div>
              <div className="text-2xl font-bold text-warning-600">{dedupeStats.duplicatesCount}</div>
            </div>
          </div>

          {dedupeResult.duplicates.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-warning-500" />
                <span className="text-sm font-medium text-slate-700">
                  以下客户处于7天冷却期内，已自动拦截
                </span>
              </div>
              <div className="max-h-32 overflow-y-auto bg-white rounded-lg border border-slate-200">
                {dedupeResult.duplicates.map((dup, idx) => (
                  <div key={idx} className="px-3 py-2 border-b border-slate-100 last:border-0 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-700">{dup.item.customerName}</span>
                      <span className="text-xs text-slate-400">{dup.item.bondCode}</span>
                    </div>
                    <span className="text-xs text-warning-600">
                      冷却至 {dup.coolingPeriodEnd}（{dup.daysRemaining}天后）
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500">
              提醒方式：
              {reminderTypes.map(type => (
                <button
                  key={type}
                  onClick={() => toggleReminderType(type)}
                  className={clsx(
                    'inline-flex items-center gap-1 ml-2 px-2.5 py-1 rounded-md text-sm transition-all',
                    selectedReminderTypes.includes(type)
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  {REMINDER_TYPE_ICONS[type]}
                  {REMINDER_TYPE_TEXT[type]}
                </button>
              ))}
            </div>
            <button
              onClick={handleBatchSend}
              disabled={dedupeResult.toSend.length === 0}
              className={clsx(
                'btn-primary',
                dedupeResult.toSend.length === 0 && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Send className="w-4 h-4 mr-2" />
              批量发送提醒（{dedupeResult.toSend.length}）
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {tierFilters.map(filter => (
            <button
              key={filter.value}
              onClick={() => setTierFilter(filter.value)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                tierFilter === filter.value
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {!showDedupePanel && (
            <button
              onClick={() => setShowDedupePanel(true)}
              className="btn-secondary"
            >
              <Shield className="w-4 h-4 mr-2" />
              幂等校验
            </button>
          )}
          <div className="relative flex-1 sm:flex-none sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索客户名称/ID..."
              className="input-field pl-9 w-full"
              onChange={(e) => debouncedGlobalFilter(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
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
                        <p>没有找到符合条件的客户</p>
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map(row => (
                      <tr key={row.id} className="table-row">
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
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-primary-600" />
              <h3 className="font-semibold text-slate-800">最近提醒记录</h3>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recentReminders.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Clock className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">暂无提醒记录</p>
                </div>
              ) : (
                recentReminders.map(log => (
                  <div key={log.id} className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {REMINDER_TYPE_ICONS[log.reminderType]}
                        <span className="font-medium text-slate-700 text-sm">{log.customerName}</span>
                      </div>
                      <span className={getStatusBadgeClass(log.status)}>
                        {log.status === 'SENT' ? '已发送' :
                         log.status === 'FAILED' ? '失败' :
                         log.status === 'PENDING' ? '待发送' : '已取消'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mb-1">{log.bondCode}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">{log.operatorName}</span>
                      <span className="text-xs text-slate-400">{formatRelativeTime(log.remindedAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-primary-600" />
              <h3 className="font-semibold text-slate-800">统计概览</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 bg-success-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-success-600" />
                  <span className="text-sm text-slate-600">今日已发送</span>
                </div>
                <span className="font-semibold text-success-600">
                  {reminderLogs.filter(r => r.status === 'SENT' && formatDateTime(r.remindedAt).startsWith(formatDateTime(new Date()).split(' ')[0])).length}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-warning-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-warning-600" />
                  <span className="text-sm text-slate-600">待确认</span>
                </div>
                <span className="font-semibold text-warning-600">
                  {reminderLogs.filter(r => r.status === 'PENDING').length}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-danger-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-danger-600" />
                  <span className="text-sm text-slate-600">发送失败</span>
                </div>
                <span className="font-semibold text-danger-600">
                  {reminderLogs.filter(r => r.status === 'FAILED').length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerReminder;
