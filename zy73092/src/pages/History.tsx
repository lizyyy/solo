import { useEffect, useState } from 'react';
import { Search, Calendar, Filter, Check, ChevronDown, Clock, User as UserIcon, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import Empty from '@/components/Empty';
import { fetcher } from '@/utils/fetcher';
import type { AuditLog, OperationType, OpinionSource } from '@/shared/types';

const operationLabels: Record<OperationType, { label: string; className: string }> = {
  JUDGE: { label: '改判', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  NOTE: { label: '备注', className: 'bg-sky-100 text-sky-700 border-sky-200' },
  RERUN: { label: '重跑', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  SUSPEND: { label: '挂起', className: 'bg-rose-100 text-rose-700 border-rose-200' },
  CONFIRM_MISSING: { label: '确认缺料', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  CONFIRM_BATCH: { label: '确认批次', className: 'bg-teal-100 text-teal-700 border-teal-200' },
  REJECT: { label: '驳回', className: 'bg-red-100 text-red-700 border-red-200' },
  IMPORT: { label: '导入', className: 'bg-violet-100 text-violet-700 border-violet-200' },
};

const allOperations: OperationType[] = ['JUDGE', 'NOTE', 'RERUN', 'SUSPEND', 'CONFIRM_MISSING', 'CONFIRM_BATCH', 'REJECT', 'IMPORT'];

export default function History() {
  const [codeSearch, setCodeSearch] = useState('');
  const [selectedOps, setSelectedOps] = useState<Set<OperationType>>(new Set());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [opDropdownOpen, setOpDropdownOpen] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const toggleOp = (op: OperationType) => {
    setSelectedOps((prev) => {
      const next = new Set(prev);
      if (next.has(op)) {
        next.delete(op);
      } else {
        next.add(op);
      }
      return next;
    });
  };

  const loadLogs = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (codeSearch) params.set('materialCode', codeSearch);
    if (selectedOps.size > 0) params.set('operation', Array.from(selectedOps).join(','));

    const res = await fetcher.get<AuditLog[]>(`/api/audit-logs?${params.toString()}`);
    let data: AuditLog[] = [];
    if (res.success && (res.items || res.data)) {
      data = (res.items || res.data) as AuditLog[];
    }
    data = data.filter((log) => {
      if (startDate) {
        const logDate = new Date(log.createdAt);
        const start = new Date(startDate);
        if (logDate < start) return false;
      }
      if (endDate) {
        const logDate = new Date(log.createdAt);
        const end = new Date(endDate);
        end.setHours(23, 59, 59);
        if (logDate > end) return false;
      }
      return true;
    });
    data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, [codeSearch, selectedOps, startDate, endDate]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const clearAll = () => {
    setCodeSearch('');
    setSelectedOps(new Set());
    setStartDate('');
    setEndDate('');
  };

  const getSourceTagColor = (tag: OpinionSource | null) => {
    if (!tag) return '';
    switch (tag) {
      case 'OLD_PROCESS':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'SUPPLEMENT_NOTE':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'LATEST_EXPORT':
        return 'bg-violet-100 text-violet-700 border-violet-200';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">历史记录</h1>
        <p className="text-sm text-slate-500 mt-1">全量操作审计日志，支持按材料、操作类型和时间范围筛选</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center text-xs text-slate-500 font-medium mr-2">
            <Filter className="w-4 h-4 mr-1.5" />
            日志筛选
          </div>

          <div className="relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="材料编号..."
              value={codeSearch}
              onChange={(e) => setCodeSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>

          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setOpDropdownOpen(!opDropdownOpen)}
              className="flex items-center gap-2 px-3.5 py-2 text-sm rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-colors min-w-[180px]"
            >
              <Tag className="w-4 h-4 text-slate-400" />
              <span className="text-slate-700 truncate">
                {selectedOps.size === 0
                  ? '全部操作类型'
                  : `已选 ${selectedOps.size} 项`}
              </span>
              <ChevronDown className={cn('w-4 h-4 text-slate-400 ml-auto', opDropdownOpen && 'rotate-180')} />
            </button>
            {opDropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-56 bg-white rounded-lg border border-slate-200 shadow-lg py-1 z-30 max-h-64 overflow-y-auto">
                <button
                  onClick={() => setSelectedOps(new Set())}
                  className="w-full flex items-center px-3.5 py-2 text-sm hover:bg-slate-50 text-slate-500 text-left border-b border-slate-100"
                >
                  清除全部选择
                </button>
                {allOperations.map((op) => {
                  const cfg = operationLabels[op];
                  return (
                    <button
                      key={op}
                      onClick={() => toggleOp(op)}
                      className="w-full flex items-center px-3.5 py-2 text-sm hover:bg-slate-50 text-left"
                    >
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border mr-2', cfg.className)}>
                        {cfg.label}
                      </span>
                      {selectedOps.has(op) && <Check className="w-4 h-4 ml-auto text-blue-600" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            <span className="text-slate-400 text-sm">至</span>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
          </div>

          {(codeSearch || selectedOps.size > 0 || startDate || endDate) && (
            <button
              onClick={clearAll}
              className="text-xs text-slate-500 hover:text-rose-600 transition-colors px-2 py-1"
            >
              清除筛选
            </button>
          )}

          <div className="ml-auto text-xs text-slate-500">
            共 <span className="font-semibold text-slate-700">{logs.length}</span> 条记录
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400">加载中...</div>
        ) : logs.length === 0 ? (
          <div className="py-16">
            <Empty />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="text-left font-semibold px-5 py-3.5 w-[170px]">时间</th>
                  <th className="text-left font-semibold px-5 py-3.5 w-[140px]">材料编号</th>
                  <th className="text-left font-semibold px-5 py-3.5 w-[110px]">操作人</th>
                  <th className="text-left font-semibold px-5 py-3.5 w-[100px]">角色</th>
                  <th className="text-left font-semibold px-5 py-3.5 w-[110px]">操作类型</th>
                  <th className="text-left font-semibold px-5 py-3.5">变更内容</th>
                  <th className="text-left font-semibold px-5 py-3.5 w-[100px]">来源标记</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => {
                  const opCfg = operationLabels[log.operation];
                  return (
                    <tr
                      key={log.id}
                      className={cn(
                        'border-b border-slate-100 last:border-0 align-top',
                        idx % 2 === 1 && 'bg-slate-50/30'
                      )}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-2">
                          <Clock className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                          <span className="text-xs font-mono text-slate-700 leading-relaxed">
                            {formatTime(log.createdAt)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {log.materialId ? (
                          <code className="font-mono text-xs bg-slate-100 text-slate-800 px-2 py-1 rounded font-semibold">
                            {log.materialCode}
                          </code>
                        ) : (
                          <span className="text-xs text-slate-500">{log.materialCode}</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs">{log.operator}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-medium',
                            log.operatorRole === 'PM'
                              ? 'bg-violet-100 text-violet-700'
                              : 'bg-sky-100 text-sky-700'
                          )}
                        >
                          {log.operatorRole === 'PM' ? '项目经理' : '工程师'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={cn(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
                            opCfg.className
                          )}
                        >
                          {opCfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <pre className="text-xs bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto max-h-40 font-mono leading-relaxed whitespace-pre-wrap">
{log.changeDetail}
                        </pre>
                      </td>
                      <td className="px-5 py-4">
                        {log.sourceTag ? (
                          <span
                            className={cn(
                              'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border',
                              getSourceTagColor(log.sourceTag)
                            )}
                          >
                            {log.sourceTag === 'OLD_PROCESS' && '旧处理'}
                            {log.sourceTag === 'SUPPLEMENT_NOTE' && '后补备注'}
                            {log.sourceTag === 'LATEST_EXPORT' && '最新导出'}
                            {log.sourceTag !== 'OLD_PROCESS' && log.sourceTag !== 'SUPPLEMENT_NOTE' && log.sourceTag !== 'LATEST_EXPORT' && (
                              <StatusBadge source={log.sourceTag as OpinionSource} />
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
