import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useScheduleStore } from '@/store/useScheduleStore';
import SensorLogTable from '@/components/SensorLogTable';
import { ConclusionBadge, HandoffBadge } from '@/components/Badges';
import {
  FileText,
  Copy,
  Download,
  Check,
  ChevronRight,
  PackageOpen,
  ScrollText,
  MessageSquare,
  FileCode,
} from 'lucide-react';
import {
  cn,
  formatDateTime,
  downloadFile,
  logsToCsv,
} from '@/lib/utils';

export default function HandoverCenter() {
  const nav = useNavigate();
  const {
    schedules,
    getLogsBySchedule,
    getMaterialsBySchedule,
    getProcessRecordsBySchedule,
    exportMarkdownReport,
    exportMaterialPackage,
  } = useScheduleStore();
  const [selectedId, setSelectedId] = useState(schedules[0]?.id ?? '');
  const [copied, setCopied] = useState(false);

  const schedule = schedules.find((s) => s.id === selectedId);
  const logs = useMemo(() => getLogsBySchedule(selectedId), [selectedId, getLogsBySchedule]);
  const materials = useMemo(
    () => getMaterialsBySchedule(selectedId),
    [selectedId, getMaterialsBySchedule]
  );
  const records = useMemo(
    () => getProcessRecordsBySchedule(selectedId),
    [selectedId, getProcessRecordsBySchedule]
  );
  const md = useMemo(() => exportMarkdownReport(selectedId), [selectedId, exportMarkdownReport]);
  const pkg = useMemo(() => exportMaterialPackage(selectedId), [selectedId, exportMaterialPackage]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const handleDownloadAll = () => {
    if (!schedule) return;
    downloadFile(`${schedule.scheduleNo}_传感器日志.csv`, pkg['sensor_logs.csv'], 'text/csv;charset=utf-8');
    setTimeout(
      () =>
        downloadFile(
          `${schedule.scheduleNo}_处理记录.json`,
          pkg['process_records.json'],
          'application/json'
        ),
      200
    );
    setTimeout(
      () =>
        downloadFile(
          `${schedule.scheduleNo}_Markdown报告.md`,
          pkg['report.md'],
          'text/markdown'
        ),
      400
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <PackageOpen size={18} className="text-blue-600" />
            收尾文档中心
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            现场调度小宋的"小包材料"：传感器日志 + 处理记录 + Markdown 报告，
            一体化预览，可一键复制或下载。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="appearance-none pr-8 pl-3 py-2 text-sm border border-slate-300 rounded bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
            >
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.scheduleNo} · {s.bridgeName} {s.position}
                </option>
              ))}
            </select>
            <ChevronRight
              size={14}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none -rotate-90"
            />
          </div>
          <button
            onClick={handleCopy}
            className={cn(
              'text-xs px-3 py-2 rounded border flex items-center gap-1',
              copied
                ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            )}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? '已复制 Markdown' : '复制 Markdown 报告'}
          </button>
          <button
            onClick={handleDownloadAll}
            className="text-xs px-3 py-2 rounded bg-slate-800 text-white hover:bg-slate-900 flex items-center gap-1"
          >
            <Download size={13} /> 下载小包材料（三份）
          </button>
        </div>
      </div>

      {schedule && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-mono font-bold text-slate-800">{schedule.scheduleNo}</span>
                <ConclusionBadge value={schedule.conclusion} />
                <HandoffBadge value={schedule.handoff} />
              </div>
              <div className="text-sm text-slate-700">
                {schedule.bridgeName} · {schedule.position}
              </div>
              <div className="text-xs text-slate-500 mt-1 tabular-nums">
                创建 {formatDateTime(schedule.createdAt)} · 更新 {formatDateTime(schedule.updatedAt)}
              </div>
            </div>
            <button
              onClick={() => nav(`/schedules/${schedule.id}`)}
              className="text-xs px-3 py-1.5 rounded border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100"
            >
              打开详情 →
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-[11px] text-slate-500 mb-1">材料 / 日志 / 记录</div>
            <div className="flex gap-4 text-sm">
              <div>
                <div className="font-bold tabular-nums text-slate-800">{materials.length}</div>
                <div className="text-[10px] text-slate-500">材料批次</div>
              </div>
              <div>
                <div className="font-bold tabular-nums text-slate-800">{logs.length}</div>
                <div className="text-[10px] text-slate-500">日志行</div>
              </div>
              <div>
                <div className="font-bold tabular-nums text-slate-800">{records.length}</div>
                <div className="text-[10px] text-slate-500">处理记录</div>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-4 flex flex-col justify-between">
            <div className="text-xs opacity-90 flex items-center gap-1">
              <FileCode size={12} /> 报告文件
            </div>
            <div className="font-bold">report.md</div>
            <div className="text-[10px] opacity-80 flex gap-2">
              <span>{md.length.toLocaleString()} 字符</span>
              <span>·</span>
              <span>GFM 格式</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4" style={{ minHeight: 720 }}>
        <section className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center gap-2">
            <ScrollText size={14} className="text-blue-600" />
            <h3 className="font-semibold text-slate-800 text-sm">① 传感器日志（原始，异常保留）</h3>
            <span className="ml-auto text-[11px] text-slate-500">{logs.length} 条</span>
          </div>
          <div className="flex-1 overflow-auto">
            <div className="min-h-full">
              <SensorLogTable logs={logs} materials={materials} />
            </div>
          </div>
          <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 flex justify-between">
            <span>异常/断档行使用浅红/浅黄底色，不做均值掩盖。</span>
            <button
              onClick={() =>
                schedule &&
                downloadFile(
                  `${schedule.scheduleNo}_传感器日志.csv`,
                  logsToCsv(logs),
                  'text/csv;charset=utf-8'
                )
              }
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              下载 CSV ↓
            </button>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center gap-2">
            <MessageSquare size={14} className="text-amber-600" />
            <h3 className="font-semibold text-slate-800 text-sm">② 处理记录（补录 + 改判原因）</h3>
            <span className="ml-auto text-[11px] text-slate-500">{records.length} 条</span>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {records.length === 0 && (
              <div className="text-xs text-slate-400 py-10 text-center">暂无处理记录</div>
            )}
            {records.map((r, i) => {
              const color =
                r.type === 'rejudge'
                  ? 'border-l-amber-500 bg-amber-50/40'
                  : r.type === 'supplement'
                  ? 'border-l-blue-500 bg-blue-50/40'
                  : 'border-l-slate-400 bg-slate-50/60';
              const label = { rejudge: '改判', supplement: '补录', note: '备注' }[r.type];
              return (
                <div key={r.id} className={`border-l-4 rounded-r-md p-3 ${color}`}>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700">{r.operator}</span>
                      <span className="px-1.5 py-0.5 rounded text-white text-[10px] bg-slate-700">
                        {label}
                      </span>
                      <span className="tabular-nums">{formatDateTime(r.timestamp)}</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">#{i + 1}</span>
                  </div>
                  <div className="text-sm text-slate-800 leading-relaxed">{r.content}</div>
                  {r.rejudgeReason && (
                    <div className="mt-2 text-xs p-2 bg-red-50 border border-red-200 rounded leading-relaxed text-red-800">
                      <span className="font-semibold">改判原因：</span>
                      {r.rejudgeReason}
                    </div>
                  )}
                  {r.oldConclusion && r.newConclusion && (
                    <div className="mt-1 text-[11px] text-amber-800 font-mono">
                      {r.oldConclusion} → {r.newConclusion}
                    </div>
                  )}
                </div>
              );
            })}
            {materials.length > 0 && (
              <div className="mt-3 p-3 border border-emerald-200 rounded-md bg-emerald-50/40">
                <div className="text-xs font-semibold text-emerald-800 mb-1 flex items-center gap-1">
                  <FileText size={12} /> 材料小包追溯（可交接给接手人）
                </div>
                {materials.map((m) => (
                  <div key={m.id} className="text-xs text-emerald-900 leading-relaxed">
                    <div>
                      <span className="font-semibold">{m.name}</span>
                      <span className="ml-1 font-mono bg-white px-1 rounded text-emerald-700">
                        批次 {m.batchNo}
                      </span>
                    </div>
                    <div className="opacity-80">
                      规格 {m.spec} · 数量 {m.qty} · 入库 {m.inboundNo}
                    </div>
                    {m.remark && <div className="opacity-80 italic mt-0.5">{m.remark}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 flex justify-between">
            <span>改判原因在历史版本里以红框强调。</span>
            <button
              onClick={() =>
                schedule &&
                downloadFile(
                  `${schedule.scheduleNo}_处理记录.json`,
                  JSON.stringify({ schedule, processRecords: records }, null, 2),
                  'application/json'
                )
              }
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              下载 JSON ↓
            </button>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center gap-2">
            <FileCode size={14} className="text-violet-600" />
            <h3 className="font-semibold text-slate-800 text-sm">③ Markdown 报告（实时渲染预览）</h3>
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={handleCopy}
                className={cn(
                  'text-[11px] px-2 py-1 rounded border flex items-center gap-0.5',
                  copied
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                    : 'border-slate-300 text-slate-700 hover:bg-white'
                )}
              >
                {copied ? <Check size={10} /> : <Copy size={10} />}
                {copied ? '已复制' : '复制'}
              </button>
              <button
                onClick={() =>
                  schedule &&
                  downloadFile(
                    `${schedule.scheduleNo}_Markdown报告.md`,
                    pkg['report.md'],
                    'text/markdown'
                  )
                }
                className="text-[11px] px-2 py-1 rounded bg-slate-800 text-white hover:bg-slate-900 flex items-center gap-0.5"
              >
                <Download size={10} /> MD
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <article className="p-5 prose prose-sm prose-slate max-w-none prose-headings:text-slate-800 prose-headings:mt-4 prose-headings:mb-2 prose-h1:text-xl prose-h2:text-base prose-h3:text-sm prose-th:bg-slate-50 prose-th:text-slate-700 prose-th:border prose-th:border-slate-200 prose-th:px-3 prose-th:py-1.5 prose-td:border prose-td:border-slate-200 prose-td:px-3 prose-td:py-1.5 prose-table:border-collapse prose-table:text-xs prose-blockquote:border-amber-400 prose-blockquote:bg-amber-50/50 prose-blockquote:py-1 prose-blockquote:pr-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
            </article>
          </div>
          <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500">
            报告内容 = 基本信息 + 日志摘要 + 材料追溯 + 处理记录 + 历史版本；与左侧①②完全对应。
          </div>
        </section>
      </div>
    </div>
  );
}
