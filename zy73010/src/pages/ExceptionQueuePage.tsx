import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviewStore } from '@/store/reviewStore.js';
import { useExportStore } from '@/store/exportStore.js';
import { StatusBadge, ExceptionTypeBadge } from '@/components/StatusBadge.js';
import type { ExceptionType, ReviewStatus } from '../../shared/types.js';
import {
  AlertTriangle, CheckCircle2, XCircle, Download, FileSearch, RefreshCw, ArrowRight,
  Filter, Eye,
} from 'lucide-react';

const excTypeLabels: { value: ExceptionType | 'all'; label: string }[] = [
  { value: 'all', label: '全部类型' },
  { value: 'weight', label: '体重异常' },
  { value: 'vaccine', label: '疫苗缺失' },
  { value: 'photo', label: '照片异常' },
  { value: 'verbal', label: '口头备注' },
  { value: 'withdrawn', label: '撤回记录' },
];

export default function ExceptionQueuePage() {
  const nav = useNavigate();
  const list = useReviewStore(s => s.exceptions);
  const loading = useReviewStore(s => s.loading.exceptions);
  const fetchList = useReviewStore(s => s.fetchExceptions);
  const updateStatus = useReviewStore(s => s.updateExceptionStatus);
  const runExport = useExportStore(s => s.runExceptions);
  const downloadFile = useExportStore(s => s.downloadExceptionsFile);
  const exportLoading = useExportStore(s => s.loading.exceptions);
  const dlLoading = useExportStore(s => s.loading.dlExc);

  const [typeFilter, setTypeFilter] = useState<ExceptionType | 'all'>('all');
  const [consistencyFilter, setConsistencyFilter] = useState<'all' | 'ok' | 'bad'>('all');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => { fetchList(); }, []);

  const filtered = useMemo(() => list.filter(e => {
    if (typeFilter !== 'all' && e.exceptionType !== typeFilter) return false;
    if (consistencyFilter === 'ok' && !e.isConsistent) return false;
    if (consistencyFilter === 'bad' && e.isConsistent) return false;
    return true;
  }), [list, typeFilter, consistencyFilter]);

  const stats = useMemo(() => {
    const groups = new Map<ExceptionType, number>();
    list.forEach(e => groups.set(e.exceptionType, (groups.get(e.exceptionType) || 0) + 1));
    return {
      total: list.length,
      inconsistent: list.filter(e => !e.isConsistent).length,
      groups,
    };
  }, [list]);

  const handleExport = async () => {
    const res = await runExport();
    if (res) {
      setNotice(res.warning);
      if (res.inconsistentCount === 0) setTimeout(() => setNotice(null), 4000);
    }
  };

  return (
    <div className="space-y-6 stagger">
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card card-hover p-5 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-gradient-to-br from-warn-400 to-warn-600 opacity-15" />
          <div className="space-y-2 relative">
            <div className="w-10 h-10 rounded-xl bg-warn-400/10 flex items-center justify-center">
              <AlertTriangle size={20} className="text-warn-500" />
            </div>
            <div className="font-serif font-bold text-4xl text-ink-700 leading-none">{stats.total}</div>
            <div className="text-sm text-ink-500">异常总数</div>
          </div>
        </div>
        <div className={`card card-hover p-5 relative overflow-hidden ${stats.inconsistent ? 'ring-2 ring-warn-400/40 animate-pulse-soft' : ''}`}>
          <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-gradient-to-br from-accent-300 to-accent-500 opacity-15" />
          <div className="space-y-2 relative">
            <div className="w-10 h-10 rounded-xl bg-accent-300/15 flex items-center justify-center">
              <XCircle size={20} className="text-accent-500" />
            </div>
            <div className="font-serif font-bold text-4xl text-ink-700 leading-none">{stats.inconsistent}</div>
            <div className="text-sm text-ink-500">状态/备注/结论不一致</div>
          </div>
        </div>
        <div className="card card-hover p-5 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 opacity-15" />
          <div className="space-y-2 relative">
            <div className="w-10 h-10 rounded-xl bg-brand-400/10 flex items-center justify-center">
              <CheckCircle2 size={20} className="text-brand-600" />
            </div>
            <div className="font-serif font-bold text-4xl text-ink-700 leading-none">{stats.total - stats.inconsistent}</div>
            <div className="text-sm text-ink-500">一致性校验通过</div>
          </div>
        </div>
      </section>

      {notice && (
        <div className={`animate-slide-down rounded-xl border-2 p-4 flex items-start gap-3 ${
          notice.includes('不一致') ? 'bg-warn-400/10 border-warn-400/50 text-warn-600' : 'bg-brand-50 border-brand-200 text-brand-700'
        }`}>
          {notice.includes('不一致') ? <AlertTriangle size={18} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={18} className="shrink-0 mt-0.5" />}
          <div className="flex-1 text-sm leading-relaxed">
            <div className="font-semibold mb-0.5">导出一致性检查</div>
            {notice}
          </div>
        </div>
      )}

      <section className="card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-ink-500" />
            <span className="text-sm font-semibold text-ink-700">筛选异常队列</span>
            <span className="text-xs text-ink-300">共 {filtered.length} / {list.length} 条</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchList} className="btn-ghost">
              <RefreshCw size={13} /> 刷新
            </button>
            <button onClick={handleExport} disabled={exportLoading || dlLoading} className="btn-secondary">
              <FileSearch size={14} /> {exportLoading ? '生成中...' : '预览导出'}
            </button>
            <button onClick={downloadFile} disabled={dlLoading} className="btn-primary">
              <Download size={14} /> {dlLoading ? <RefreshCw size={14} className="animate-spin" /> : '导出 Excel'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-ink-500">异常类型：</span>
          {excTypeLabels.map(opt => (
            <button key={opt.value} onClick={() => setTypeFilter(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all
                ${typeFilter === opt.value ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20' : 'bg-ink-50 text-ink-500 hover:bg-ink-100 border border-ink-100'}`}>
              {opt.label}
            </button>
          ))}
          <div className="w-px h-6 bg-ink-200 mx-1 hidden sm:block" />
          <span className="text-xs text-ink-500">一致性：</span>
          {[
            { v: 'all', l: '全部' },
            { v: 'ok', l: '✓ 一致' },
            { v: 'bad', l: '⚠ 不一致' },
          ].map(o => (
            <button key={o.v} onClick={() => setConsistencyFilter(o.v as any)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all
                ${consistencyFilter === o.v ? 'bg-warn-500 text-white shadow-md shadow-warn-500/20' : 'bg-ink-50 text-ink-500 hover:bg-ink-100 border border-ink-100'}`}>
              {o.l}
            </button>
          ))}
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr>
                <th className="table-th rounded-tl-2xl">编号/宠物</th>
                <th className="table-th">异常类型</th>
                <th className="table-th">处理状态</th>
                <th className="table-th w-[26%]">关联备注</th>
                <th className="table-th w-[26%]">文件结论</th>
                <th className="table-th">一致性</th>
                <th className="table-th rounded-tr-2xl w-[120px]">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="table-td text-center py-12 text-ink-300">加载中...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="table-td text-center py-12 text-ink-300">无匹配的异常记录</td></tr>
              ) : filtered.map((e, i) => (
                <tr key={e.id}
                  className={`${i % 2 ? 'bg-ink-50/30' : ''} ${!e.isConsistent ? 'bg-warn-400/5' : ''} hover:bg-brand-50/40 transition-colors`}>
                  <td className="table-td">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-ink-700">{e.petName}</span>
                        <span className="text-[10px] text-ink-300">{e.id}</span>
                      </div>
                      <button onClick={() => nav(`/record/${e.recordId}`)} className="text-[11px] text-brand-600 font-medium hover:underline inline-flex items-center gap-0.5">
                        查看原始记录 <Eye size={10} />
                      </button>
                    </div>
                  </td>
                  <td className="table-td"><ExceptionTypeBadge type={e.exceptionType} /></td>
                  <td className="table-td"><StatusBadge status={e.status} size="sm" /></td>
                  <td className="table-td">
                    <div className="text-xs text-ink-700 leading-relaxed line-clamp-3">{e.remark}</div>
                  </td>
                  <td className="table-td">
                    <div className="text-xs text-ink-700 leading-relaxed line-clamp-3">{e.fileConclusion}</div>
                  </td>
                  <td className="table-td">
                    {e.isConsistent ? (
                      <span className="chip bg-brand-100 text-brand-700 inline-flex items-center gap-1">
                        <CheckCircle2 size={12} /> 一致
                      </span>
                    ) : (
                      <span className="chip bg-warn-500/15 text-warn-600 inline-flex items-center gap-1 animate-pulse-soft">
                        <XCircle size={12} /> 不一致
                      </span>
                    )}
                  </td>
                  <td className="table-td">
                    <select
                      value={e.status}
                      onChange={async ev => {
                        const res = await updateStatus(e.id, ev.target.value as ReviewStatus);
                        if (res && !res.passed) setNotice(res.message);
                      }}
                      className="text-xs rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-ink-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300/30">
                      <option value="pending">待复核</option>
                      <option value="needsInfo">需补充</option>
                      <option value="exception">有异常</option>
                      <option value="approved">通过</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="text-xs text-ink-500 bg-brand-50/40 border border-brand-100/60 rounded-xl px-4 py-3 leading-relaxed">
        💡 <span className="font-semibold text-brand-700">老周交付测试指引：</span>
        在复核工作台从任意宠物（如布丁/奶糖）进入，翻完体重曲线和异常照片，编辑备注后保存，
        再回到本页查看对应异常的状态和备注是否同步变更，文件结论是否与新状态对应（一致性列会实时自动校验）。
        <button onClick={() => nav('/')} className="ml-2 text-brand-600 font-medium hover:underline inline-flex items-center gap-0.5">
          前往复核工作台测试 <ArrowRight size={11} />
        </button>
      </div>
    </div>
  );
}
