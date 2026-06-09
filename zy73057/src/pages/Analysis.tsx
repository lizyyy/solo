import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  AlertTriangle,
  ShieldCheck,
  TrendingUp,
  GitBranch,
  Package,
  ClipboardList,
  ChevronRight,
  X,
  User,
  Calendar,
  FileWarning,
  Loader2,
  CheckCircle2,
  Clock,
  Ban,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useScheduleStore } from '@/store/scheduleStore';
import { cn } from '@/lib/utils';
import type {
  OverrideRecord,
  ImpactNode,
  ReplaceAction,
  ReplaceActionStatus,
  Snapshot,
  ScheduleItem,
} from '../../shared/types';

const actionStatusConfig: Record<ReplaceActionStatus, { label: string; cls: string; icon: any }> = {
  pending: { label: '待处理', cls: 'bg-ink-700 text-ink-200 border-ink-400', icon: Clock },
  in_progress: { label: '进行中', cls: 'bg-warn-400/20 text-warn-100 border-warn-400', icon: TrendingUp },
  done: { label: '已完成', cls: 'bg-mint-400/20 text-mint-100 border-mint-300', icon: CheckCircle2 },
  blocked: { label: '已阻塞', cls: 'bg-rust-400/20 text-rust-300 border-rust-400', icon: Ban },
};

const nodeColorMap = {
  override: { bg: 'bg-warn-400/20', border: 'border-warn-400', text: 'text-warn-100', fill: '#E8A33D' },
  item: { bg: 'bg-ink-600/60', border: 'border-ink-400', text: 'text-ink-100', fill: '#5A6A82' },
  part: { bg: 'bg-mint-400/20', border: 'border-mint-300', text: 'text-mint-100', fill: '#5FA8B9' },
  monthly_summary: { bg: 'bg-rust-400/20', border: 'border-rust-400', text: 'text-rust-300', fill: '#C84B31' },
};

const nodeLabels = {
  override: '复核人改判',
  item: '排程条目',
  part: '备件变更',
  monthly_summary: '月度汇总',
};

export default function Analysis() {
  const { batchId } = useParams<{ batchId: string }>();
  const {
    loadBatchDetail,
    loadSnapshots,
    loadReplaceActions,
    patchAction,
    activeBatchDetail,
    snapshots,
    replaceActions,
    loading,
    error,
  } = useScheduleStore();

  const [selectedNode, setSelectedNode] = useState<ImpactNode | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedBlocked, setExpandedBlocked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (batchId) {
      loadBatchDetail(batchId);
      loadSnapshots(batchId);
      loadReplaceActions(batchId);
    }
  }, [batchId, loadBatchDetail, loadSnapshots, loadReplaceActions]);

  const batch = activeBatchDetail?.batch;
  const items = activeBatchDetail?.items || [];
  const overrides = activeBatchDetail?.overrides || [];

  const overriddenItems = useMemo(() => items.filter((i) => i.isOverridden), [items]);

  const monthlyDelta = useMemo(() => {
    return items.reduce(
      (sum, it) => sum + (it.monthlyImpactAfter - it.monthlyImpactBefore),
      0
    );
  }, [items]);

  const avgImpactBefore = useMemo(() => {
    const total = items.reduce((s, it) => s + it.monthlyImpactBefore, 0);
    return items.length ? total / items.length : 0;
  }, [items]);

  const deltaOver10Pct = avgImpactBefore > 0 && Math.abs(monthlyDelta) / avgImpactBefore > 0.1;

  const sortedSnapshots = useMemo(() => {
    return [...snapshots].sort((a, b) => a.version - b.version);
  }, [snapshots]);

  const latestSnap = sortedSnapshots[sortedSnapshots.length - 1];
  const parentSnap = sortedSnapshots.length >= 2 ? sortedSnapshots[sortedSnapshots.length - 2] : null;

  const diffRows = useMemo(() => {
    if (!latestSnap || !parentSnap) return null;
    const mapLeft = new Map<string, ScheduleItem>();
    parentSnap.itemSnapshot.forEach((it) => {
      mapLeft.set(`${it.elevatorNo}-${it.faultCode}`, it);
    });
    const mapRight = new Map<string, ScheduleItem>();
    latestSnap.itemSnapshot.forEach((it) => {
      mapRight.set(`${it.elevatorNo}-${it.faultCode}`, it);
    });
    const keys = new Set([...mapLeft.keys(), ...mapRight.keys()]);
    const diff: Array<{ key: string; left?: ScheduleItem; right?: ScheduleItem; isDiff: boolean }> = [];
    keys.forEach((k) => {
      const l = mapLeft.get(k);
      const r = mapRight.get(k);
      const isDiff =
        !l ||
        !r ||
        l.finalPartNo !== r.finalPartNo ||
        l.finalQty !== r.finalQty;
      if (isDiff) diff.push({ key: k, left: l, right: r, isDiff });
    });
    return diff;
  }, [latestSnap, parentSnap]);

  const handleNodeClick = (node: ImpactNode) => {
    setSelectedNode(node);
    setDrawerOpen(true);
  };

  const handleStatusChange = async (actionId: string, status: ReplaceActionStatus) => {
    try {
      await patchAction(actionId, { status });
    } catch (e) {
      // error in store
    }
  };

  const handleAssigneeChange = async (actionId: string, assignee: string) => {
    try {
      await patchAction(actionId, { assignee });
    } catch (e) {
      // error in store
    }
  };

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleString('zh-CN', { hour12: false });
    } catch {
      return s;
    }
  };

  if (!batchId) return <div className="text-ink-300">缺少 batchId 参数</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-ink-300 hover:text-warn-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回排程列表
        </Link>
        {batch && (
          <div className="flex items-center gap-3">
            <span className="font-mono text-warn-400 font-semibold">{batch.batchId}</span>
            <span className="text-xs text-ink-400">v{batch.version}</span>
          </div>
        )}
      </div>

      {loading && !batch ? (
        <div className="p-12 flex items-center justify-center gap-3 text-ink-300">
          <Loader2 className="w-5 h-5 animate-spin" />
          加载分析数据...
        </div>
      ) : error ? (
        <div className="p-4 bg-rust-400/10 border border-rust-400/50 rounded-sm text-rust-300">
          {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              className={cn(
                'p-4 border-2 rounded-sm bg-ink-800/80',
                'border-ink-500'
              )}
            >
              <div className="flex items-center gap-2 text-xs text-ink-400 mb-2">
                <GitBranch className="w-3.5 h-3.5" />
                改判数量
              </div>
              <div className="font-mono text-3xl font-bold text-warn-400">
                {batch?.overrideCount || 0}
              </div>
            </div>

            <div className="p-4 border-2 border-ink-500 rounded-sm bg-ink-800/80">
              <div className="flex items-center gap-2 text-xs text-ink-400 mb-2">
                <ClipboardList className="w-3.5 h-3.5" />
                影响排程行数
              </div>
              <div className="font-mono text-3xl font-bold text-mint-300">
                {overriddenItems.length}
              </div>
            </div>

            <div
              className={cn(
                'p-4 border-2 rounded-sm',
                deltaOver10Pct
                  ? 'bg-dots-rust border-rust-400 animate-pulseBorder'
                  : 'bg-ink-800/80 border-ink-500'
              )}
            >
              <div className="flex items-center gap-2 text-xs text-ink-400 mb-2">
                <TrendingUp className="w-3.5 h-3.5" />
                月度合计差额
              </div>
              <div
                className={cn(
                  'font-mono text-3xl font-bold',
                  monthlyDelta > 0
                    ? deltaOver10Pct
                      ? 'text-rust-300'
                      : 'text-rust-400'
                    : monthlyDelta < 0
                    ? 'text-mint-300'
                    : 'text-ink-200'
                )}
              >
                {monthlyDelta > 0 ? '+' : ''}
                {monthlyDelta.toFixed(1)}
              </div>
              {deltaOver10Pct && (
                <div className="text-[10px] text-rust-300 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  差额超过平均月度值 10%
                </div>
              )}
            </div>

            <div
              className={cn(
                'p-4 border-2 rounded-sm bg-ink-800/80',
                batch?.riskNote ? 'border-rust-400/70' : 'border-ink-500'
              )}
            >
              <div className="flex items-center gap-2 text-xs text-ink-400 mb-2">
                {batch?.riskNote ? (
                  <FileWarning className="w-3.5 h-3.5 text-rust-400" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                风险提示
              </div>
              <div
                className={cn(
                  'text-xs leading-relaxed',
                  batch?.riskNote ? 'text-rust-300' : 'text-ink-300'
                )}
              >
                {batch?.riskNote || '未发现额外风险'}
              </div>
            </div>
          </div>

          <div className="border-2 border-ink-500 rounded-sm bg-ink-800/80 p-5">
            <h3 className="text-sm font-semibold text-ink-100 mb-4 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-warn-400" />
              影响链路可视化
            </h3>

            {overrides.length === 0 ? (
              <div className="py-8 text-center text-ink-400 text-sm">该批次暂无改判记录</div>
            ) : (
              <div className="space-y-6">
                {overrides.map((ov, ovIdx) => {
                  const nodesByLevel: Record<string, ImpactNode | undefined> = {};
                  ov.impactChain.forEach((n) => {
                    if (!nodesByLevel[n.level]) nodesByLevel[n.level] = n;
                  });
                  const levels: Array<'override' | 'item' | 'part' | 'monthly_summary'> = [
                    'override',
                    'item',
                    'part',
                    'monthly_summary',
                  ];

                  return (
                    <div
                      key={ov.id}
                      className="p-4 border border-ink-600 rounded-sm bg-ink-900/40"
                      style={{ animationDelay: `${ovIdx * 80}ms` }}
                    >
                      <div className="flex items-center justify-between mb-4 text-xs">
                        <div className="flex items-center gap-2 text-ink-300">
                          <User className="w-3.5 h-3.5 text-warn-400" />
                          <span className="font-medium">{ov.createdBy}</span>
                          <span className="text-ink-500">·</span>
                          <span>{formatDate(ov.createdAt)}</span>
                        </div>
                        <span className="px-2 py-0.5 bg-ink-700 border border-ink-500 rounded-sm font-mono text-ink-200">
                          {ov.before.partNo} → {ov.after.partNo}
                        </span>
                      </div>

                      <div className="relative py-4">
                        <svg
                          className="absolute top-1/2 left-[8%] right-[8%] h-0.5 -translate-y-1/2 pointer-events-none"
                          style={{ width: '84%' }}
                          preserveAspectRatio="none"
                        >
                          <line
                            x1="0%"
                            y1="50%"
                            x2="100%"
                            y2="50%"
                            stroke="#39475B"
                            strokeWidth="2"
                            strokeDasharray="4 4"
                          />
                        </svg>

                        <div className="grid grid-cols-4 gap-2 relative z-10">
                          {levels.map((lvl, idx) => {
                            const node = nodesByLevel[lvl];
                            const cfg = nodeColorMap[lvl];
                            return (
                              <div
                                key={lvl}
                                className="flex flex-col items-center animate-fadeInStagger"
                                style={{ animationDelay: `${idx * 120 + ovIdx * 80}ms` }}
                              >
                                <button
                                  onClick={() => node && handleNodeClick(node)}
                                  className={cn(
                                    'w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all',
                                    node
                                      ? `${cfg.bg} ${cfg.border} hover:scale-110 cursor-pointer shadow-lg`
                                      : 'bg-ink-800 border-ink-600 opacity-40 cursor-not-allowed'
                                  )}
                                >
                                  {node ? (
                                    <div
                                      className="w-6 h-6 rounded-full"
                                      style={{ background: cfg.fill }}
                                    />
                                  ) : (
                                    <span className="text-lg text-ink-500">—</span>
                                  )}
                                </button>
                                <div
                                  className={cn(
                                    'mt-2 text-xs font-medium text-center',
                                    node ? cfg.text : 'text-ink-500'
                                  )}
                                >
                                  {nodeLabels[lvl]}
                                </div>
                                {node && (
                                  <div className="mt-0.5 text-[10px] text-ink-400 text-center max-w-[120px] truncate">
                                    {node.label}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-2 border-ink-500 rounded-sm bg-ink-800/80 p-5">
            <h3 className="text-sm font-semibold text-ink-100 mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-mint-300" />
              备件替换动作清单
            </h3>

            {replaceActions.length === 0 ? (
              <div className="py-8 text-center text-ink-400 text-sm">暂无替换动作记录</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs table-zebra">
                  <thead className="bg-ink-900/80 text-ink-300">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-medium">旧型号 → 新型号</th>
                      <th className="px-3 py-2.5 text-right font-medium">数量</th>
                      <th className="px-3 py-2.5 text-left font-medium">目标仓库</th>
                      <th className="px-3 py-2.5 text-left font-medium">处理人</th>
                      <th className="px-3 py-2.5 text-left font-medium">截止日</th>
                      <th className="px-3 py-2.5 text-left font-medium">状态</th>
                      <th className="px-3 py-2.5 text-left font-medium w-64">操作</th>
                    </tr>
                  </thead>
                  <tbody className="text-ink-100">
                    {replaceActions.map((a) => {
                      const scfg = actionStatusConfig[a.status];
                      const StatusIcon = scfg.icon;
                      const isBlocked = a.status === 'blocked';
                      const expanded = expandedBlocked[a.id];
                      return (
                        <>
                          <tr
                            key={a.id}
                            className="border-t border-ink-700/50"
                          >
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-ink-300">{a.oldPartNo}</span>
                                <ChevronRight className="w-3 h-3 text-warn-400" />
                                <span className="font-mono text-mint-200 font-medium">
                                  {a.newPartNo}
                                </span>
                              </div>
                              <div className="text-[10px] text-ink-400 mt-0.5 truncate max-w-[200px]">
                                {a.oldPartName} → {a.newPartName}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 font-mono text-right">{a.qty}</td>
                            <td className="px-3 py-2.5">{a.targetWarehouse}</td>
                            <td className="px-3 py-2.5">
                              <input
                                defaultValue={a.assignee}
                                onBlur={(e) =>
                                  handleAssigneeChange(a.id, e.target.value)
                                }
                                className="w-full bg-ink-700/50 border border-ink-500 rounded-sm px-2 py-1 text-xs text-ink-100 focus:outline-none focus:border-warn-400"
                              />
                            </td>
                            <td className="px-3 py-2.5 font-mono">{a.dueDate}</td>
                            <td className="px-3 py-2.5">
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border-2 rounded-sm',
                                  scfg.cls
                                )}
                              >
                                <StatusIcon className="w-3 h-3" />
                                {scfg.label}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <select
                                  defaultValue={a.status}
                                  onChange={(e) =>
                                    handleStatusChange(
                                      a.id,
                                      e.target.value as ReplaceActionStatus
                                    )
                                  }
                                  className="bg-ink-700 border border-ink-500 rounded-sm px-2 py-1 text-xs text-ink-100 focus:outline-none focus:border-warn-400"
                                >
                                  <option value="pending">待处理</option>
                                  <option value="in_progress">进行中</option>
                                  <option value="done">已完成</option>
                                  <option value="blocked">已阻塞</option>
                                </select>
                                {isBlocked && a.blockingNote && (
                                  <button
                                    onClick={() =>
                                      setExpandedBlocked({
                                        ...expandedBlocked,
                                        [a.id]: !expanded,
                                      })
                                    }
                                    className="p-1 text-rust-400 hover:bg-rust-400/10 rounded-sm"
                                    title="查看阻塞说明"
                                  >
                                    {expanded ? (
                                      <ChevronUp className="w-4 h-4" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isBlocked && a.blockingNote && expanded && (
                            <tr className="bg-rust-400/5">
                              <td colSpan={7} className="px-3 py-3 border-t border-rust-400/30">
                                <div className="flex gap-3">
                                  <div className="p-2 bg-rust-400/15 border border-rust-400/40 rounded-sm flex-shrink-0 h-fit">
                                    <Ban className="w-4 h-4 text-rust-400" />
                                  </div>
                                  <div className="flex-1">
                                    <div className="text-xs font-medium text-rust-300 mb-1">
                                      阻塞说明
                                    </div>
                                    <div className="text-xs text-ink-200 whitespace-pre-wrap leading-relaxed">
                                      {a.blockingNote}
                                    </div>
                                    {a.blockingNote.includes('排查路径') ||
                                    a.blockingNote.includes('README') ? null : (
                                      <div className="mt-2 pt-2 border-t border-ink-600">
                                        <div className="text-[11px] text-ink-400 flex items-center gap-1">
                                          <FileWarning className="w-3 h-3" />
                                          → 排查路径见 README 第 2 条
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="border-2 border-ink-500 rounded-sm bg-ink-800/80 p-5">
            <h3 className="text-sm font-semibold text-ink-100 mb-4 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-warn-400" />
              历史版本对比
            </h3>

            {latestSnap?.continuityCheck?.hasGap ? (
              <div className="mb-4 p-3 bg-rust-400/10 border-2 border-rust-400/60 rounded-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rust-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-rust-300">
                    ⚠ 存在断档：{latestSnap.continuityCheck.gapDetails || '部分条目缺失连续性'}
                  </div>
                  {latestSnap.continuityCheck.missingItemIds?.length > 0 && (
                    <div className="text-xs text-rust-400/80 mt-1 font-mono">
                      缺失条目：{latestSnap.continuityCheck.missingItemIds.slice(0, 5).join(', ')}
                      {latestSnap.continuityCheck.missingItemIds.length > 5 &&
                        ` 等 ${latestSnap.continuityCheck.missingItemIds.length} 条`}
                    </div>
                  )}
                </div>
              </div>
            ) : latestSnap ? (
              <div className="mb-4 p-3 bg-mint-400/10 border-2 border-mint-300/60 rounded-sm flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-mint-300 mt-0.5 flex-shrink-0" />
                <div className="text-sm font-medium text-mint-200">历史未断档</div>
              </div>
            ) : null}

            {!parentSnap || !latestSnap ? (
              <div className="py-8 text-center text-ink-400 text-sm">
                {sortedSnapshots.length === 0
                  ? '暂无历史快照'
                  : `仅有 ${sortedSnapshots.length} 个快照，需要至少 2 个才能对比`}
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="p-3 border-2 border-warn-400/50 rounded-sm bg-warn-400/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs text-ink-400">版本</span>
                        <span className="ml-2 font-mono font-bold text-warn-400">
                          v{parentSnap.version}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 text-xs bg-ink-700 border border-ink-500 rounded-sm text-ink-200">
                        {parentSnap.trigger}
                      </span>
                    </div>
                    <div className="text-[10px] text-ink-400 mt-1 font-mono">
                      {formatDate(parentSnap.createdAt)}
                    </div>
                  </div>
                  <div className="p-3 border-2 border-rust-400/50 rounded-sm bg-rust-400/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs text-ink-400">版本</span>
                        <span className="ml-2 font-mono font-bold text-rust-400">
                          v{latestSnap.version}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 text-xs bg-ink-700 border border-ink-500 rounded-sm text-ink-200">
                        {latestSnap.trigger}
                      </span>
                    </div>
                    <div className="text-[10px] text-ink-400 mt-1 font-mono">
                      {formatDate(latestSnap.createdAt)}
                    </div>
                  </div>
                </div>

                {diffRows && diffRows.length === 0 ? (
                  <div className="py-6 text-center text-ink-400 text-sm border border-ink-600 rounded-sm">
                    两版本内容一致，无差异
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-ink-600 rounded-sm overflow-hidden">
                      <div className="overflow-x-auto max-h-96 overflow-y-auto">
                        <table className="w-full text-xs table-zebra">
                          <thead className="bg-ink-900/80 text-ink-300 sticky top-0">
                            <tr>
                              <th className="px-2 py-2 text-left font-medium">电梯</th>
                              <th className="px-2 py-2 text-left font-medium">故障码</th>
                              <th className="px-2 py-2 text-left font-medium">最终备件</th>
                              <th className="px-2 py-2 text-right font-medium">Q</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parentSnap.itemSnapshot.map((it) => {
                              const key = `${it.elevatorNo}-${it.faultCode}`;
                              const isDiff = diffRows?.some((d) => d.key === key);
                              return (
                                <tr
                                  key={it.id}
                                  className={cn(
                                    'border-t border-ink-700/50',
                                    isDiff && 'bg-warn-400/20'
                                  )}
                                >
                                  <td className="px-2 py-1.5 font-mono">{it.elevatorNo}</td>
                                  <td className="px-2 py-1.5 font-mono text-warn-200">
                                    {it.faultCode}
                                  </td>
                                  <td className="px-2 py-1.5 font-mono truncate max-w-[120px]">
                                    {it.finalPartNo}
                                  </td>
                                  <td className="px-2 py-1.5 font-mono text-right">
                                    {it.finalQty}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="border border-ink-600 rounded-sm overflow-hidden">
                      <div className="overflow-x-auto max-h-96 overflow-y-auto">
                        <table className="w-full text-xs table-zebra">
                          <thead className="bg-ink-900/80 text-ink-300 sticky top-0">
                            <tr>
                              <th className="px-2 py-2 text-left font-medium">电梯</th>
                              <th className="px-2 py-2 text-left font-medium">故障码</th>
                              <th className="px-2 py-2 text-left font-medium">最终备件</th>
                              <th className="px-2 py-2 text-right font-medium">Q</th>
                            </tr>
                          </thead>
                          <tbody>
                            {latestSnap.itemSnapshot.map((it) => {
                              const key = `${it.elevatorNo}-${it.faultCode}`;
                              const isDiff = diffRows?.some((d) => d.key === key);
                              return (
                                <tr
                                  key={it.id}
                                  className={cn(
                                    'border-t border-ink-700/50',
                                    isDiff && 'bg-rust-400/20'
                                  )}
                                >
                                  <td className="px-2 py-1.5 font-mono">{it.elevatorNo}</td>
                                  <td className="px-2 py-1.5 font-mono text-warn-200">
                                    {it.faultCode}
                                  </td>
                                  <td className="px-2 py-1.5 font-mono truncate max-w-[120px]">
                                    {it.finalPartNo}
                                  </td>
                                  <td className="px-2 py-1.5 font-mono text-right">
                                    {it.finalQty}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {drawerOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-ink-900/70"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute top-0 right-0 bottom-0 w-[380px] max-w-full bg-ink-800 border-l-2 border-ink-600 shadow-2xl flex flex-col animate-fadeInStagger">
            <div className="p-4 border-b border-ink-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedNode && (
                  <span
                    className={cn(
                      'w-3 h-3 rounded-full',
                      nodeColorMap[selectedNode.level].text === 'text-warn-100'
                        ? 'bg-warn-400'
                        : selectedNode.level === 'part'
                        ? 'bg-mint-300'
                        : selectedNode.level === 'monthly_summary'
                        ? 'bg-rust-400'
                        : 'bg-ink-400'
                    )}
                  />
                )}
                <span className="text-sm font-semibold text-ink-100">
                  {selectedNode?.label || '节点详情'}
                </span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1 text-ink-300 hover:text-ink-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedNode ? (
                <>
                  <div className="p-3 bg-ink-900/50 border border-ink-600 rounded-sm">
                    <div className="text-xs text-ink-400 mb-1">层级</div>
                    <div
                      className={cn(
                        'text-sm font-medium',
                        nodeColorMap[selectedNode.level].text
                      )}
                    >
                      {nodeLabels[selectedNode.level]}
                    </div>
                  </div>
                  <div className="p-3 bg-ink-900/50 border border-ink-600 rounded-sm">
                    <div className="text-xs text-ink-400 mb-1">详细描述</div>
                    <div className="text-sm text-ink-100 whitespace-pre-wrap leading-relaxed">
                      {selectedNode.detail}
                    </div>
                  </div>
                  {selectedNode.deltaValue !== undefined && (
                    <div
                      className={cn(
                        'p-3 border rounded-sm',
                        selectedNode.deltaValue > 0
                          ? 'bg-rust-400/10 border-rust-400/50'
                          : selectedNode.deltaValue < 0
                          ? 'bg-mint-400/10 border-mint-300/50'
                          : 'bg-ink-900/50 border-ink-600'
                      )}
                    >
                      <div className="text-xs text-ink-400 mb-1 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        变化量
                      </div>
                      <div
                        className={cn(
                          'font-mono text-xl font-bold',
                          selectedNode.deltaValue > 0
                            ? 'text-rust-400'
                            : selectedNode.deltaValue < 0
                            ? 'text-mint-300'
                            : 'text-ink-300'
                        )}
                      >
                        {selectedNode.deltaValue > 0 ? '+' : ''}
                        {selectedNode.deltaValue.toFixed(2)}
                      </div>
                    </div>
                  )}
                  {selectedNode.childrenIds && selectedNode.childrenIds.length > 0 && (
                    <div className="p-3 bg-ink-900/50 border border-ink-600 rounded-sm">
                      <div className="text-xs text-ink-400 mb-2">子节点 ID</div>
                      <div className="flex flex-wrap gap-1">
                        {selectedNode.childrenIds.map((cid) => (
                          <span
                            key={cid}
                            className="px-2 py-0.5 text-[10px] font-mono bg-ink-700 border border-ink-500 rounded-sm text-ink-200"
                          >
                            {cid}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-ink-400 py-8">请选择节点</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
