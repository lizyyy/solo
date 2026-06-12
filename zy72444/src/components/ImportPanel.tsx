import { useRef, useState } from 'react';
import { Upload, Image, FileSpreadsheet, CheckCircle, AlertTriangle, Repeat, Sparkles, FileDown, FolderOpen } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import type { ImportSession, ImportResultStatus, TicketType } from '@/types';
import { formatDateTime } from '@/utils';

interface ImportPanelProps {
  batchId: string;
  type: 'photo' | 'ticket';
  onImported?: (session: ImportSession) => void;
}

type Stage = 'idle' | 'parsing' | 'done';

const statusStyle: Record<ImportResultStatus, { label: string; iconBg: string; icon: string; text: string; dot: string }> = {
  new: { label: '新增', iconBg: 'bg-emerald-100', icon: '✚', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  'duplicate-this-session': { label: '本次文件内部重复', iconBg: 'bg-amber-100', icon: '⇄', text: 'text-amber-800', dot: 'bg-amber-500' },
  'duplicate-history': { label: '历史已导入(跳过不翻倍)', iconBg: 'bg-sky-100', icon: '⟲', text: 'text-sky-800', dot: 'bg-sky-500' },
  updated: { label: '备注已更新', iconBg: 'bg-violet-100', icon: '✎', text: 'text-violet-800', dot: 'bg-violet-500' },
};

const samplePhotoRowsTemplate = [
  { name: '钱小乐', type: 'paid' as TicketType, sourcePhotoRef: 'A-row1-1', remark: '' },
  { name: '钱小乐', type: 'paid' as TicketType, sourcePhotoRef: 'A-row1-1', remark: '' }, // 本次重复
  { name: '孙小丽', type: 'free' as TicketType, sourcePhotoRef: 'photo-row-3-col-1', remark: '' }, // 历史重复
  { name: '李小红', type: 'free' as TicketType, sourcePhotoRef: 'photo-row-1-col-2', remark: '赠票-合作机构(补录来源)' }, // 历史存在但备注不同
  { name: '金小悦', type: 'paid' as TicketType, sourcePhotoRef: 'A-row1-2', remark: '' }, // 新增
  { name: '魏小宁', type: 'free' as TicketType, sourcePhotoRef: 'A-row2-1', remark: '赠票-媒体' }, // 新增
];

const sampleTicketRowsTemplate = [
  { ticketNo: 'T20240315009', type: 'paid' as TicketType, purchaser: '金先生', sourceExportRef: 'e-r9' },
  { ticketNo: 'T20240315009', type: 'paid' as TicketType, purchaser: '金先生(重复)', sourceExportRef: 'e-r9' },
  { ticketNo: 'T20240315001', type: 'paid' as TicketType, purchaser: '张先生', sourceExportRef: 'e-r2' },
  { ticketNo: 'F20240315005', type: 'free' as TicketType, purchaser: '媒体伙伴B', sourceExportRef: 'e-r10' },
];

export default function ImportPanel({ batchId, type, onImported }: ImportPanelProps) {
  const { importAttendanceFromFile, importTicketsFromFile, currentRole } = useAppStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [lastSession, setLastSession] = useState<ImportSession | null>(null);
  const [chosenFile, setChosenFile] = useState<{ name: string; content: string } | null>(null);

  const runImport = async (fileName: string, content: string, sampleMode: boolean) => {
    setStage('parsing');
    await new Promise((r) => setTimeout(r, 600));
    let session: ImportSession;
    if (type === 'photo') {
      session = importAttendanceFromFile(batchId, fileName, content, samplePhotoRowsTemplate).session;
    } else {
      session = importTicketsFromFile(batchId, fileName, content, sampleTicketRowsTemplate).session;
    }
    setLastSession(session);
    setStage('done');
    onImported?.(session);
  };

  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      setChosenFile({ name: f.name, content });
      runImport(f.name, content, false);
    };
    reader.readAsText(f);
  };

  const onRunSample = () => {
    const stamp = Date.now().toString(36);
    const sampleName =
      type === 'photo'
        ? `样例签到_${stamp}.jpg`
        : `样例票务_${stamp}.xlsx`;
    const content =
      type === 'photo'
        ? 'photo-sample::' + stamp
        : 'ticket-sample::' + stamp;
    setChosenFile({ name: sampleName, content });
    runImport(sampleName, content, true);
  };

  const reset = () => {
    setStage('idle');
    setLastSession(null);
    setChosenFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const Icon = type === 'photo' ? Image : FileSpreadsheet;
  const title = type === 'photo' ? '课时签到照片' : '票务导出表';

  const topColor =
    stage === 'done'
      ? 'bg-emerald-500'
      : stage === 'parsing'
      ? 'bg-primary-400'
      : 'bg-primary-500';

  return (
    <div className="glass rounded-2xl border border-white/50 overflow-hidden">
      <div className={`h-1.5 ${topColor} transition-colors`} />
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl ${type === 'photo' ? 'bg-primary-100 text-primary-600' : 'bg-violet-100 text-violet-700'}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-primary-900">{title}</h4>
            <p className="text-sm text-primary-500 mt-0.5">
              {chosenFile
                ? `已选择: ${chosenFile.name}`
                : type === 'photo'
                ? '支持 JPG/PNG 或 一键跑样例(包含新增/本次重复/历史重复/备注更新四种场景)'
                : '支持 CSV/XLSX 或 一键跑样例(四种去重场景)'}
            </p>
          </div>
        </div>

        {stage === 'idle' && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-2 py-3 px-2 rounded-xl bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors border border-primary-100"
            >
              <FolderOpen className="w-5 h-5" />
              <span className="text-xs font-medium">选文件导入</span>
            </button>
            <button
              onClick={onRunSample}
              className="flex flex-col items-center gap-2 py-3 px-2 rounded-xl bg-accent-50 text-accent-700 hover:bg-accent-100 transition-colors border border-accent-100"
            >
              <Sparkles className="w-5 h-5" />
              <span className="text-xs font-medium">跑样例(含重复)</span>
            </button>
            <button
              onClick={onRunSample}
              className="flex flex-col items-center gap-2 py-3 px-2 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors border border-sky-100"
            >
              <Repeat className="w-5 h-5" />
              <span className="text-xs font-medium">再次重复导入</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept={type === 'photo' ? 'image/*,.csv,.txt' : '.csv,.xlsx,.txt,image/*'}
              onChange={onFilePick}
            />
          </div>
        )}

        {stage === 'parsing' && (
          <div className="mt-5 flex items-center gap-3 text-primary-600">
            <Upload className="w-5 h-5 animate-bounce" />
            <span className="text-sm font-medium">正在解析并执行去重判断…</span>
          </div>
        )}

        {stage === 'done' && lastSession && (
          <div className="mt-4 space-y-3 animate-fade-in">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                <CheckCircle className="w-3.5 h-3.5" />
                导入完成 · 会话 {lastSession.id}
              </span>
              <span className="text-xs text-primary-400">
                {formatDateTime(lastSession.importedAt)} · 参数版本 {lastSession.calcParamsVersion}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2 rounded-lg bg-primary-50">
                <p className="font-bold text-lg text-primary-800">{lastSession.totalInputCount}</p>
                <p className="text-primary-500">输入行数</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50">
                <p className="font-bold text-lg text-emerald-700">{lastSession.newCount}</p>
                <p className="text-emerald-600">新增</p>
              </div>
              <div className="p-2 rounded-lg bg-sky-50">
                <p className="font-bold text-lg text-sky-700">{lastSession.duplicateHistoryCount}</p>
                <p className="text-sky-600">历史重复</p>
              </div>
              <div className="p-2 rounded-lg bg-amber-50">
                <p className="font-bold text-lg text-amber-700">
                  {lastSession.duplicateThisSessionCount}
                </p>
                <p className="text-amber-600">本次内部重复</p>
              </div>
            </div>

            <div className="max-h-64 overflow-auto rounded-xl border border-primary-100 divide-y divide-primary-50">
              {lastSession.details.map((d) => {
                const s = statusStyle[d.status];
                return (
                  <div key={`${d.lineNo}-${d.dedupKey}`} className="flex items-start gap-3 p-3 text-xs">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${s.dot} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-primary-400">L{d.lineNo}</span>
                        <span className="font-medium text-primary-800">{d.displayName}</span>
                        <span className={`px-1.5 py-0.5 rounded ${s.iconBg} ${s.text} font-medium`}>
                          {s.label}
                        </span>
                        {d.newRecordId && (
                          <span className="font-mono text-[10px] text-primary-400">
                            新ID:{d.newRecordId}
                          </span>
                        )}
                        {d.existingRecordId && (
                          <span className="font-mono text-[10px] text-primary-400">
                            既有ID:{d.existingRecordId}
                          </span>
                        )}
                      </div>
                      <p className="text-primary-500 mt-0.5 leading-relaxed">{d.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={onRunSample}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors"
              >
                <Repeat className="w-4 h-4" />
                再跑一次(同材料)
              </button>
              <button
                onClick={reset}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-white text-primary-600 rounded-lg hover:bg-primary-50 transition-colors border border-primary-100"
              >
                <FileDown className="w-4 h-4" />
                重置面板
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
