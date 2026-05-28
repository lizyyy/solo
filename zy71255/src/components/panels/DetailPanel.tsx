import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Building2,
  AlertTriangle,
  TrendingUp,
  ArrowRightLeft,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  Plus,
  GripVertical,
} from 'lucide-react';
import type { Enterprise, Transaction, Issue, Gap } from '@/types';
import { useDataStore } from '@/store/useDataStore';
import { useSelectionStore } from '@/store/useSelectionStore';
import { useUIStore } from '@/store/useUIStore';
import GlassPanel from '@/components/ui/GlassPanel';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Table from '@/components/ui/Table';
import Empty from '@/components/Empty';
import { cn } from '@/lib/utils';

interface DetailPanelProps {
  enterprises: Enterprise[];
  transactions: Transaction[];
  issues: Issue[];
  gaps: Gap[];
  selectedPeriod: string | null;
}

type TabType = 'overview' | 'transactions' | 'issues';

const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: '概览', icon: <FileText className="w-4 h-4" /> },
  { id: 'transactions', label: '交易流水', icon: <ArrowRightLeft className="w-4 h-4" /> },
  { id: 'issues', label: '问题记录', icon: <AlertTriangle className="w-4 h-4" /> },
];

const issueTypeLabels: Record<string, string> = {
  quota_duplicate_deduction: '配额重复扣除',
  period_misalignment: '履约期错位',
  flow_line_occlusion: '流线遮挡',
  duplicate_deduction: '配额重复扣除',
  flow_occlusion: '流线遮挡',
};

const issueStatusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' }> = {
  open: { label: '待处理', variant: 'danger' },
  investigating: { label: '处理中', variant: 'warning' },
  resolved: { label: '已解决', variant: 'success' },
  explained: { label: '已解释', variant: 'info' },
  fixed: { label: '已修复', variant: 'success' },
};

const severityConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' }> = {
  low: { label: '低', variant: 'info' },
  medium: { label: '中', variant: 'warning' },
  high: { label: '高', variant: 'danger' },
};

export default function DetailPanel({
  enterprises,
  transactions,
  issues,
  gaps,
  selectedPeriod,
}: DetailPanelProps) {
  const { selectedEnterpriseId, highlightTransactions } = useSelectionStore();
  const { rightPanelCollapsed, rightPanelWidth, toggleRightPanel, setRightPanelWidth, setIsResizingRight } = useUIStore();
  const { updateIssue } = useDataStore();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [newFixNote, setNewFixNote] = useState<Record<string, string>>({});
  const [isResizingRef] = useState({ current: false });

  const selectedEnterprise = useMemo(() => {
    return enterprises.find((e) => e.id === selectedEnterpriseId);
  }, [enterprises, selectedEnterpriseId]);

  const enterpriseTransactions = useMemo(() => {
    if (!selectedEnterpriseId) return [];
    return transactions.filter(
      (tx) =>
        tx.fromId === selectedEnterpriseId ||
        tx.toId === selectedEnterpriseId
    );
  }, [transactions, selectedEnterpriseId]);

  const enterpriseIssues = useMemo(() => {
    if (!selectedEnterpriseId) return [];
    return issues.filter((i) => i.enterpriseId === selectedEnterpriseId);
  }, [issues, selectedEnterpriseId]);

  const enterpriseGap = useMemo(() => {
    if (!selectedEnterpriseId || !selectedPeriod) return null;
    return gaps.find(
      (g) => g.enterpriseId === selectedEnterpriseId && g.periodId === selectedPeriod
    );
  }, [gaps, selectedEnterpriseId, selectedPeriod]);

  const enterpriseQuota = useMemo(() => {
    if (!selectedEnterprise || !enterpriseGap) return null;
    return {
      total: enterpriseGap.required,
      used: enterpriseGap.actual,
      remaining: enterpriseGap.required - enterpriseGap.actual,
      gap: enterpriseGap.gap,
    };
  }, [selectedEnterprise, enterpriseGap]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    setIsResizingRight(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = window.innerWidth - e.clientX;
      setRightPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      setIsResizingRight(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleTransactionRowClick = (tx: Transaction) => {
    highlightTransactions([tx.id]);
  };

  const handleMarkAsExplained = (issueId: string) => {
    updateIssue(issueId, { status: 'explained', fixNote: newFixNote[issueId] || '' });
    setNewFixNote((prev) => ({ ...prev, [issueId]: '' }));
  };

  const handleMarkAsFixed = (issueId: string) => {
    updateIssue(issueId, { status: 'fixed', fixNote: newFixNote[issueId] || '' });
    setNewFixNote((prev) => ({ ...prev, [issueId]: '' }));
  };

  const getEnterpriseName = (id: string) => {
    return enterprises.find((e) => e.id === id)?.name || id;
  };

  const renderProgressRing = () => {
    if (!enterpriseQuota) return null;

    const percentage = Math.min(100, (enterpriseQuota.used / enterpriseQuota.total) * 100);
    const circumference = 2 * Math.PI * 45;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    const isOverQuota = enterpriseQuota.gap > 0;

    return (
      <div className="relative w-36 h-36 mx-auto">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="72"
            cy="72"
            r="45"
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth="8"
          />
          <motion.circle
            cx="72"
            cy="72"
            r="45"
            fill="none"
            stroke={isOverQuota ? '#FF3B3B' : '#00FF9D'}
            strokeWidth="8"
            strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{
              strokeDasharray: circumference,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-white">{Math.round(percentage)}%</span>
          <span className="text-xs text-white/50">已用配额</span>
        </div>
      </div>
    );
  };

  const renderOverviewTab = () => {
    if (!selectedEnterprise || !enterpriseQuota) return null;

    const isOverQuota = enterpriseQuota.gap > 0;

    return (
      <div className="space-y-6">
        {renderProgressRing()}

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-white/5">
            <div className="text-xs text-white/50 mb-1">总配额</div>
            <div className="text-xl font-bold text-white">{enterpriseQuota.total.toLocaleString()} 吨</div>
          </div>
          <div className="p-4 rounded-xl bg-white/5">
            <div className="text-xs text-white/50 mb-1">已用配额</div>
            <div className="text-xl font-bold text-accent-cyan">{enterpriseQuota.used.toLocaleString()} 吨</div>
          </div>
          <div className="p-4 rounded-xl bg-white/5">
            <div className="text-xs text-white/50 mb-1">剩余配额</div>
            <div className={cn(
              'text-xl font-bold',
              isOverQuota ? 'text-accent-red' : 'text-accent-green'
            )}>
              {enterpriseQuota.remaining.toLocaleString()} 吨
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white/5">
            <div className="text-xs text-white/50 mb-1">缺口</div>
            <div className={cn(
              'text-xl font-bold flex items-center gap-1',
              isOverQuota ? 'text-accent-red' : 'text-accent-green'
            )}>
              {isOverQuota && <TrendingUp className="w-4 h-4" />}
              {enterpriseQuota.gap.toLocaleString()} 吨
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-white/80">基本信息</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">企业ID</span>
              <span className="text-white/80">{selectedEnterprise.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">所属行业</span>
              <span className="text-white/80">{selectedEnterprise.industry}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">交易记录</span>
              <span className="text-white/80">{enterpriseTransactions.length} 笔</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">问题记录</span>
              <span className={cn(
                enterpriseIssues.length > 0 ? 'text-accent-red' : 'text-white/80'
              )}>
                {enterpriseIssues.length} 条
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-white/80">缺口状态</h4>
          <div className={cn(
            'p-4 rounded-xl',
            isOverQuota ? 'bg-accent-red/10 border border-accent-red/30' : 'bg-accent-green/10 border border-accent-green/30'
          )}>
            <div className="flex items-center gap-2 mb-2">
              {isOverQuota ? (
                <XCircle className="w-5 h-5 text-accent-red" />
              ) : (
                <CheckCircle className="w-5 h-5 text-accent-green" />
              )}
              <span className={cn(
                'font-semibold',
                isOverQuota ? 'text-accent-red' : 'text-accent-green'
              )}>
                {isOverQuota ? '存在缺口' : '配额充足'}
              </span>
            </div>
            <p className="text-sm text-white/70">
              {isOverQuota
                ? `该企业在当前履约期存在 ${enterpriseQuota.gap} 吨碳配额缺口，需要通过交易或其他方式补足。`
                : '该企业在当前履约期配额充足，无需额外购买配额。'}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderTransactionsTab = () => {
    const columns = [
      {
        key: 'date',
        header: '日期',
        sortable: true,
        render: (_: unknown, row: Record<string, unknown>) => {
          const timestamp = row.timestamp as string;
          return new Date(timestamp).toLocaleDateString('zh-CN');
        },
      },
      {
        key: 'type',
        header: '类型',
        render: (_: unknown, row: Record<string, unknown>) => {
          const isSeller = row.fromId === selectedEnterpriseId;
          return (
            <Badge variant={isSeller ? 'warning' : 'success'} size="sm">
              {isSeller ? '卖出' : '买入'}
            </Badge>
          );
        },
      },
      {
        key: 'counterparty',
        header: '交易方',
        render: (_: unknown, row: Record<string, unknown>) => {
          const counterpartyId = row.fromId === selectedEnterpriseId
            ? row.toId
            : row.fromId;
          return getEnterpriseName(counterpartyId as string);
        },
      },
      {
        key: 'amount',
        header: '数量(吨)',
        sortable: true,
        render: (_: unknown, row: Record<string, unknown>) => (
          <span className="text-white/80">{(row.amount as number).toLocaleString()}</span>
        ),
      },
      {
        key: 'price',
        header: '单价(元)',
        sortable: true,
        render: (_: unknown, row: Record<string, unknown>) => (
          <span className="text-white/80">{(row.price as number).toFixed(2)}</span>
        ),
      },
      {
        key: 'totalValue',
        header: '总额(元)',
        sortable: true,
        render: (_: unknown, row: Record<string, unknown>) => {
          const totalValue = (row.amount as number) * (row.price as number);
          return <span className="text-accent-cyan font-medium">{totalValue.toLocaleString()}</span>;
        },
      },
    ];

    const tableData = enterpriseTransactions.map((tx) => ({
      ...tx,
      id: tx.id,
      amount: tx.amount,
      price: tx.price,
      fromId: tx.fromId,
      toId: tx.toId,
      timestamp: tx.date,
    })) as unknown as Record<string, unknown>[];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/60">共 {enterpriseTransactions.length} 条记录</span>
        </div>
        <Table
          columns={columns}
          data={tableData}
          rowKey="id"
          onRowClick={(row) => handleTransactionRowClick(row as unknown as Transaction)}
          className="max-h-[400px]"
        />
      </div>
    );
  };

  const renderIssuesTab = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/60">共 {enterpriseIssues.length} 条问题</span>
        </div>
        
        {enterpriseIssues.length === 0 ? (
          <Empty
            icon={<CheckCircle className="w-12 h-12 text-accent-green/50" />}
            title="暂无问题记录"
            description="该企业在当前履约期没有检测到数据质量问题"
          />
        ) : (
          <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
            {enterpriseIssues.map((issue) => {
              const statusConfig = issueStatusConfig[issue.status] || issueStatusConfig.open;
              const severityConfigItem = severityConfig[issue.severity] || severityConfig.low;
              const isOpen = issue.status === 'open' || (issue.status as string) === 'investigating';

              return (
                <motion.div
                  key={issue.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl bg-white/5 border border-white/10"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={cn(
                        'w-5 h-5',
                        issue.severity === 'high' ? 'text-accent-red' :
                        issue.severity === 'medium' ? 'text-accent-yellow' : 'text-accent-cyan'
                      )} />
                      <div>
                        <h4 className="font-medium text-white">{issueTypeLabels[issue.type] || issue.type}</h4>
                        <p className="text-xs text-white/50 mt-0.5">
                          {issueTypeLabels[issue.type] || issue.type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={severityConfigItem.variant} size="sm">
                        {severityConfigItem.label}
                      </Badge>
                      <Badge variant={statusConfig.variant} size="sm">
                        {statusConfig.label}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-sm text-white/70 mb-3">{issue.description}</p>

                  {issue.fixNote && (
                    <div className="mb-3 p-3 rounded-lg bg-white/5 border-l-2 border-accent-cyan">
                      <div className="text-xs text-accent-cyan mb-1">修正说明</div>
                      <p className="text-sm text-white/70">{issue.fixNote}</p>
                    </div>
                  )}

                  {isOpen && (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newFixNote[issue.id] || ''}
                          onChange={(e) => setNewFixNote((prev) => ({ ...prev, [issue.id]: e.target.value }))}
                          placeholder="添加修正说明..."
                          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-accent-cyan/50"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Clock className="w-4 h-4" />}
                          onClick={() => handleMarkAsExplained(issue.id)}
                          className="flex-1"
                        >
                          标记已解释
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          icon={<CheckCircle className="w-4 h-4" />}
                          onClick={() => handleMarkAsFixed(issue.id)}
                          className="flex-1"
                        >
                          标记已修复
                        </Button>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (rightPanelCollapsed) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="h-full flex items-center"
      >
        <Button
          variant="secondary"
          size="sm"
          icon={<ChevronLeft className="w-4 h-4" />}
          onClick={toggleRightPanel}
          className="h-20 rounded-r-none rounded-l-2xl"
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="h-full flex"
      style={{ width: rightPanelWidth }}
    >
      <div
        onMouseDown={handleResizeStart}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent-cyan/50 transition-colors z-20"
        style={{ left: '-2px' }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -right-1">
          <GripVertical className="w-3 h-3 text-white/20" />
        </div>
      </div>

      <GlassPanel
        padding="p-4"
        rounded="rounded-2xl rounded-r-none"
        className="h-full flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-accent-green" />
            <h2
              className="text-lg font-semibold text-white"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              企业明细
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<ChevronRight className="w-4 h-4" />}
            onClick={toggleRightPanel}
          />
        </div>

        {!selectedEnterprise ? (
          <div className="flex-1 flex items-center justify-center">
            <Empty
              icon={<Building2 className="w-16 h-16 text-white/20" />}
              title="选择企业查看详情"
              description="点击3D场景中的企业节点或从左侧列表选择企业"
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <motion.div
              className="mb-4 p-4 rounded-xl"
              style={{
                background: `linear-gradient(135deg, ${selectedEnterprise.color}20 0%, transparent 100%)`,
                border: `1px solid ${selectedEnterprise.color}40`,
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: selectedEnterprise.color }}
                >
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedEnterprise.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: selectedEnterprise.color }}
                    />
                    <span className="text-sm text-white/60">{selectedEnterprise.industry}</span>
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="flex gap-1 mb-4 bg-white/5 rounded-xl p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    activeTab === tab.id
                      ? 'bg-accent-cyan/20 text-accent-cyan'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === 'overview' && renderOverviewTab()}
                  {activeTab === 'transactions' && renderTransactionsTab()}
                  {activeTab === 'issues' && renderIssuesTab()}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}
      </GlassPanel>
    </motion.div>
  );
}
