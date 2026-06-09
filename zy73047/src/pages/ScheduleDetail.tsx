import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useScheduleStore } from '@/store/useScheduleStore';
import AnomalyChart from '@/components/AnomalyChart';
import SensorLogTable from '@/components/SensorLogTable';
import Drawer from '@/components/Drawer';
import Modal from '@/components/Modal';
import { ConclusionBadge, HandoffBadge } from '@/components/Badges';
import type { ScheduleConclusion } from '@/types';
import {
  ArrowLeft,
  Edit3,
  GitCompareArrows,
  Package,
  CalendarClock,
  MessageSquarePlus,
  History,
  User,
  Check,
  AlertTriangle,
  FileDown,
  Copy,
  RefreshCw,
} from 'lucide-react';
import {
  cn,
  conclusionMeta,
  formatDateTime,
  logsToCsv,
  downloadFile,
} from '@/lib/utils';

export default function ScheduleDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const {
    getScheduleById,
    getLogsBySchedule,
    getMaterialsBySchedule,
    getProcessRecordsBySchedule,
    getVersionsBySchedule,
    supplementNote,
    rejudge,
    exportMarkdownReport,
  } = useScheduleStore();

  const schedule = getScheduleById(id);
  const logs = useMemo(() => getLogsBySchedule(id), [id, getLogsBySchedule]);
  const materials = useMemo(() => getMaterialsBySchedule(id), [id, getMaterialsBySchedule]);
  const records = useMemo(() => getProcessRecordsBySchedule(id), [id, getProcessRecordsBySchedule]);
  const versions = useMemo(() => getVersionsBySchedule(id), [id, getVersionsBySchedule]);

  const [logDrawer, setLogDrawer] = useState(false);
  const [highlightLogId, setHighlightLogId] = useState<string | undefined>(undefined);
  const [noteOpen, setNoteOpen] = useState(false);
  const [rejudgeOpen, setRejudgeOpen] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [rjConclusion, setRjConclusion] = useState<ScheduleConclusion>('rejudged_normal');
  const [rjReason, setRjReason] = useState('');
  const [rjRemark, setRjRemark] = useState('');
  const [copied, setCopied] = useState(false);

  if (!schedule) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-500">
        找不到该排程{' '}
        <button onClick={() => nav('/schedules')} className="ml-2 text-blue-600 underline">
          返回列表
        </button>
      </div>
    );
  }

  const submitNote = () => {
    if (!noteContent.trim()) return;
    supplementNote(id, { content: noteContent.trim(), operator: '现场调度-小宋' });
    setNoteContent('');
    setNoteOpen(false);
  };

  const submitRejudge = () => {
    if (!rjReason.trim()) return;
    rejudge(id, {
      newConclusion: rjConclusion,
      rejudgeReason: rjReason.trim(),
      remark: rjRemark.trim() || undefined,
      operator: '运营主管-王工',
    });
    setRjConclusion('rejudged_normal');
    setRjReason('');
    setRjRemark('');
    setRejudgeOpen(false);
  };

  const handleCopyReport = async () => {
    const md = exportMarkdownReport(id);
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownloadLogs = () =>
    downloadFile(`${schedule.scheduleNo}_传感器日志.csv`, logsToCsv(logs), 'text/csv;charset=utf-8');

  const anomalyCount = logs.filter((l) => l.status === 'anomaly').length;
  const gapCount = logs.filter((l) => l.status === 'gap').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => nav('/schedules')}
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-blue-700 border border-slate-200 rounded px-2.5 py-1.5 hover:border-blue-300 transition"
          >
            <ArrowLeft size={14} /> 返回看板
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">
                <span className="font-mono">{schedule.scheduleNo}</span>
                <span className="mx-2 text-slate-300">·</span>
                {schedule.bridgeName}
                <span className="text-slate-500 text-sm font-medium">{schedule.position}</span>
              </h2>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
              <span className="flex items-center gap-1"><CalendarClock size={12} /> 创建 {formatDateTime(schedule.createdAt)}</span>
              <span>·</span>
              <span>最近更新 {formatDateTime(schedule.updatedAt)}</span>
              <span>·</span>
              <span>支座编号 {schedule.bearingCode}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ConclusionBadge value={schedule.conclusion} />
          <HandoffBadge value={schedule.handoff} />
          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-slate-200 bg-slate-50 text-slate-600">
            <History size={12} /> v{schedule.versionCount}
          </span>
          <button
            onClick={() => setNoteOpen(true)}
            className="text-xs px-3 py-1.5 rounded border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 flex items-center gap-1"
          >
            <MessageSquarePlus size={13} /> 补录备注
          </button>
          <button
            onClick={() => setRejudgeOpen(true)}
            className="text-xs px-3 py-1.5 rounded bg-amber-600 text-white hover:bg-amber-700 flex items-center gap-1"
          >
            <GitCompareArrows size={13} /> 改判结论
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">
          <section className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-slate-800 text-[15px]">传感器时序 · 异常不被均值掩盖</h3>
              <div className="text-xs text-slate-500 flex gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-600 ring-1 ring-white" />
                  异常 {anomalyCount}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  断档 {gapCount}
                </span>
                <button
                  onClick={() => setLogDrawer(true)}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  查看全部日志 →
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-2">
              红色点为原始异常值（独立绘制不被均值线抹平），橙色三角标记采样断档，
              点击任一散点可直接定位到对应传感器日志行及原始说法。
            </p>
            <AnomalyChart
              logs={logs}
              height={360}
              onPointClick={(logId) => {
                setLogDrawer(true);
                setTimeout(() => setHighlightLogId(logId), 80);
              }}
            />
          </section>

          <section className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50/60">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <GitCompareArrows size={15} className="text-amber-600" />
                历史版本对比 · 旧结论 / 新备注 / 改判原因
              </h3>
              <div className="text-xs text-slate-500">共 {versions.length} 个版本</div>
            </div>
            {versions.length === 1 ? (
              <div className="p-5 text-sm text-slate-500">
                仅有初始版本 v1，尚未发生改判或补录。
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-xs">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">版本</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 w-[110px]">时间</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">结论快照</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">备注 / 变更摘要</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 min-w-[260px]">改判原因</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((v, idx) => {
                      const prev = versions[idx - 1];
                      const changed = prev && prev.snapshot.conclusion !== v.snapshot.conclusion;
                      return (
                        <tr
                          key={v.id}
                          className={cn(
                            'border-b border-slate-100',
                            changed ? 'bg-amber-50/50' : idx === versions.length - 1 ? 'bg-blue-50/30' : ''
                          )}
                        >
                          <td className="px-3 py-3 align-top">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[12px] font-bold text-slate-800 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                                v{v.versionNo}
                              </span>
                              {idx === versions.length - 1 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600 text-white">当前</span>
                              )}
                              {changed && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500 text-white">已改判</span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                              <User size={10} /> {v.operator}
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top text-xs text-slate-600 tabular-nums whitespace-nowrap">
                            {formatDateTime(v.createdAt)}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <div className="flex items-center gap-2">
                              <ConclusionBadge value={v.snapshot.conclusion} />
                              {prev && changed && (
                                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                  <span className="line-through opacity-60">
                                    {conclusionMeta[prev.snapshot.conclusion].label}
                                  </span>
                                  <span>→</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top text-xs text-slate-700 max-w-[420px]">
                            <div className="mb-1 font-medium text-slate-800">{v.changeSummary}</div>
                            <div className="leading-relaxed opacity-90">{v.snapshot.remark}</div>
                            <div className="mt-1 text-[11px] text-slate-500">
                              材料：{v.snapshot.materialBatchNos.length ? v.snapshot.materialBatchNos.join(', ') : '未关联'}
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top">
                            {changed ? (
                              <div className="text-xs bg-red-50 border border-red-200 rounded p-2 leading-relaxed text-red-800">
                                {records
                                  .filter((r) => r.type === 'rejudge' && r.timestamp >= v.createdAt)
                                  .slice(0, 1)
                                  .map((r) => (
                                    <div key={r.id}>
                                      <div className="font-semibold mb-1">
                                        {r.oldConclusion} → {r.newConclusion}
                                      </div>
                                      <div>{r.rejudgeReason}</div>
                                    </div>
                                  ))[0] ||
                                  '（详见处理记录）'}
                              </div>
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
          </section>
        </div>

        <div className="space-y-5">
          <section className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Package size={15} className="text-emerald-600" /> 追溯材料小包
            </h3>
            {materials.length === 0 ? (
              <div className="border-2 border-dashed border-amber-300 rounded-lg p-4 bg-amber-50/60">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-800 leading-relaxed">
                    <div className="font-semibold mb-0.5">缺材料</div>
                    当前排程未关联任何支座备件批次。请现场调度小宋补录入库后再提请放行。
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {materials.map((m) => (
                  <div key={m.id} className="border border-slate-200 rounded-md p-3 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-semibold text-slate-800 text-sm">{m.name}</div>
                      <span className="text-[11px] font-mono bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                        {m.batchNo}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-600">
                      <div>规格：<span className="text-slate-800">{m.spec}</span></div>
                      <div>数量：<span className="text-slate-800 tabular-nums">{m.qty}</span></div>
                      <div>入库号：<span className="text-slate-800 font-mono">{m.inboundNo}</span></div>
                      <div>到货：<span className="text-slate-800 tabular-nums">{formatDateTime(m.receivedAt).slice(0, 7)}</span></div>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">供应商：{m.supplier}</div>
                    {m.remark && (
                      <div className="text-[11px] mt-2 pt-2 border-t border-slate-200 text-slate-700 leading-relaxed">
                        {m.remark}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Edit3 size={15} className="text-blue-600" /> 处理记录时间线
            </h3>
            <div className="relative pl-5">
              <div className="absolute left-[5px] top-1 bottom-1 w-0.5 bg-slate-200" />
              {records.length === 0 && (
                <div className="text-sm text-slate-400">暂无处理记录，点击右上角"补录备注"添加。</div>
              )}
              {records.map((r, idx) => {
                const color =
                  r.type === 'rejudge'
                    ? 'bg-amber-500'
                    : r.type === 'supplement'
                    ? 'bg-blue-500'
                    : 'bg-slate-400';
                const label = { rejudge: '改判', supplement: '补录', note: '备注' }[r.type];
                return (
                  <div key={r.id} className="relative pb-4 last:pb-0">
                    <span
                      className={cn(
                        'absolute -left-[15px] top-1 w-3 h-3 rounded-full ring-2 ring-white',
                        color
                      )}
                    />
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
                      <span className="font-medium text-slate-700">{r.operator}</span>
                      <span className={cn('px-1.5 py-0.5 rounded text-white text-[10px]', color)}>
                        {label}
                      </span>
                      <span className="tabular-nums">{formatDateTime(r.timestamp)}</span>
                      {r.affectedLogIds && (
                        <span className="text-[10px] text-slate-500">
                          涉及日志 {r.affectedLogIds.length} 条
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-800 leading-relaxed">{r.content}</div>
                    {r.rejudgeReason && (
                      <div className="mt-1.5 text-xs p-2 bg-red-50 border border-red-200 rounded text-red-800 leading-relaxed">
                        <span className="font-semibold">改判原因：</span>
                        {r.rejudgeReason}
                      </div>
                    )}
                    {idx === 0 && r.oldConclusion && r.newConclusion && (
                      <div className="mt-1.5 text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800">
                        <span className="line-through">{conclusionMeta[r.oldConclusion].label}</span>
                        <span>→</span>
                        <span className="font-semibold">{conclusionMeta[r.newConclusion].label}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 space-y-2">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <FileDown size={15} className="text-slate-700" /> 快速导出
            </h3>
            <button
              onClick={handleDownloadLogs}
              className="w-full text-left text-sm px-3 py-2 rounded border border-slate-200 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
            >
              <FileDown size={14} className="text-blue-600" />
              下载传感器日志 CSV
            </button>
            <button
              onClick={handleCopyReport}
              className={cn(
                'w-full text-left text-sm px-3 py-2 rounded border hover:bg-slate-50 flex items-center gap-2',
                copied
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 text-slate-700'
              )}
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} className="text-slate-500" />}
              {copied ? 'Markdown 报告已复制' : '复制 Markdown 报告'}
            </button>
            <button
              onClick={() => nav('/handover')}
              className="w-full text-left text-sm px-3 py-2 rounded bg-slate-800 text-white hover:bg-slate-900 flex items-center gap-2"
            >
              <RefreshCw size={14} /> 前往收尾文档中心（三合一）
            </button>
          </section>
        </div>
      </div>

      <Drawer
        open={logDrawer}
        onClose={() => {
          setLogDrawer(false);
          setHighlightLogId(undefined);
        }}
        title={
          <span>
            <span className="font-mono">{schedule.scheduleNo}</span>
            <span className="text-slate-500 text-xs ml-2 font-normal">
              传感器原始日志 · 共 {logs.length} 条（{anomalyCount} 异常 / {gapCount} 断档）
            </span>
          </span>
        }
        widthClass="w-[960px] max-w-[95vw]"
      >
        <div className="p-4 space-y-4">
          <AnomalyChart
            logs={logs}
            height={260}
            onPointClick={(logId) => setHighlightLogId(logId)}
          />
          <div className="border border-slate-200 rounded-md overflow-hidden">
            <SensorLogTable
              logs={logs}
              materials={materials}
              highlightLogId={highlightLogId}
              onHighlightCleared={() => setHighlightLogId(undefined)}
            />
          </div>
        </div>
      </Drawer>

      <Modal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title={
          <span className="flex items-center gap-2">
            <MessageSquarePlus size={16} className="text-blue-600" />
            补录备注 · {schedule.scheduleNo}
          </span>
        }
        footer={
          <>
            <button
              onClick={() => setNoteOpen(false)}
              className="px-4 py-1.5 text-sm rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              onClick={submitNote}
              disabled={!noteContent.trim()}
              className="px-4 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              保存补录（将生成新处理记录）
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded p-2.5 leading-relaxed">
            补录将作为"处理记录"中的一条追加，历史版本中可追溯；
            若需要同时改变结论，请使用"改判结论"操作。
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              补录说明（传感器断档原因、现场巡视情况、与材料批次核对结论等）
            </label>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none leading-relaxed"
              placeholder="例：13:00 断档 GAP-20260608-01 已由通信组查明为移动基站割接所致；现场已复紧航空插头并做防水处理……"
            />
          </div>
          <div className="text-xs text-slate-500">操作人：现场调度-小宋</div>
        </div>
      </Modal>

      <Modal
        open={rejudgeOpen}
        onClose={() => setRejudgeOpen(false)}
        title={
          <span className="flex items-center gap-2">
            <GitCompareArrows size={16} className="text-amber-600" />
            改判结论 · {schedule.scheduleNo}
          </span>
        }
        footer={
          <>
            <button
              onClick={() => setRejudgeOpen(false)}
              className="px-4 py-1.5 text-sm rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              onClick={submitRejudge}
              disabled={!rjReason.trim()}
              className="px-4 py-1.5 text-sm rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              确认改判（自动保存历史快照）
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded border border-slate-200 bg-slate-50">
              <div className="text-slate-500 mb-1">当前（旧）结论</div>
              <ConclusionBadge value={schedule.conclusion} />
              <div className="mt-2 text-[11px] text-slate-600 leading-relaxed">
                {schedule.primaryRemark.slice(0, 80)}…
              </div>
            </div>
            <div className="p-3 rounded border-2 border-amber-300 bg-amber-50/50">
              <div className="text-amber-800 mb-1">改判后（新）结论</div>
              <select
                value={rjConclusion}
                onChange={(e) => setRjConclusion(e.target.value as ScheduleConclusion)}
                className="w-full px-2 py-1 border border-amber-400 rounded bg-white text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="rejudged_normal">改判正常（改判后正常）</option>
                <option value="rejudged_anomaly">改判异常（改判后仍异常）</option>
                <option value="normal">正常（初次判定）</option>
                <option value="anomaly">异常（初次判定）</option>
                <option value="pending">待判定</option>
              </select>
              <div className="mt-2 text-[11px] text-amber-800">
                将生成版本号 v{schedule.versionCount + 1}，旧快照会完整保留。
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-red-700 mb-1">
              * 改判原因 <span className="text-red-500">（必填，将在历史版本中公示）</span>
            </label>
            <textarea
              value={rjReason}
              onChange={(e) => setRjReason(e.target.value)}
              rows={4}
              required
              className="w-full px-3 py-2 border border-red-200 rounded text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none leading-relaxed bg-red-50/40"
              placeholder="例：两条压力超限异常经现场比对为传感器零点漂移（偏移 +2.4MPa），已用标准砝码二次校准；支座本体经敲击法与目视检查均无异常……"
            />
            <div className="text-[11px] text-red-600 mt-1">
              运营主管临走前会核对改判原因；历史对比表中以红框强调此字段。
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              新备注（可选，留空则沿用旧备注）
            </label>
            <textarea
              value={rjRemark}
              onChange={(e) => setRjRemark(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none leading-relaxed"
              placeholder={schedule.primaryRemark}
            />
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-2">
            <User size={12} /> 操作人：运营主管-王工
          </div>
        </div>
      </Modal>
    </div>
  );
}
