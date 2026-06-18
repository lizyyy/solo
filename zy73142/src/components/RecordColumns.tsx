import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  FileEdit,
  AlertTriangle,
  Send,
  MapPin,
  ShieldCheck,
  CornerDownRight,
  X,
  Layers3,
} from 'lucide-react';
import { useReplayStore } from '@/store/useReplayStore';
import type { ManualStatus, SurveyRecord } from '@/types';
import { cn } from '@/lib/utils';
import { normalizeTideToMeters } from '@/utils/anomaly';

function formatTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function shortId(id: string): string {
  const day = id.replace(/\D/g, '').slice(-3);
  return day ? '#' + day : id;
}

const MANUAL_OPTIONS: { value: ManualStatus; label: string; color: string; icon: any }[] = [
  { value: 'normal', label: '判为正常', color: 'text-kelp-dark bg-kelp/15 border-kelp/40', icon: CheckCircle2 },
  { value: 'outlier_keep', label: '保留为离群', color: 'text-coral bg-coral/12 border-coral/40', icon: ShieldCheck },
  { value: 'outlier_reject', label: '判弃排除', color: 'text-ink/70 bg-ink/10 border-ink/25', icon: X },
  { value: 'pending', label: '转待补材料', color: 'text-amber-tide bg-amber-tide/15 border-amber-tide/40', icon: Clock },
];

function ProcessedItem({
  record,
  highlight,
  onClick,
}: {
  record: SurveyRecord;
  highlight: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      layout
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      className={cn(
        'w-full text-left rounded-xl border p-3 transition-all',
        highlight
          ? 'border-coral/60 bg-coral/8 shadow-glow-coral'
          : 'border-sand-tide/40 bg-white/60 hover:border-kelp/50'
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5">
          <span className="badge bg-kelp/15 text-kelp-dark border border-kelp/30">
            <CheckCircle2 className="h-3 w-3" /> {shortId(record.id)}
          </span>
          <span className="text-[11px] font-mono text-ink/70">
            {record.timestamp.slice(5, 10)}
          </span>
        </div>
        {record.manualOverride ? (
          <span className="badge bg-amber-tide/15 text-amber-tide border border-amber-tide/40">
            <FileEdit className="h-3 w-3" /> 已改判
          </span>
        ) : (
          <span className="badge bg-sea-light/20 text-sea-deep border border-sea-light/40">
            {record.processedAt ? formatTime(record.processedAt) : '自动处理'}
          </span>
        )}
      </div>
      <div className="text-[12px] font-mono text-ink/80 mb-1">
        <b>{record.siteName}</b> · 覆盖度 <b className="text-kelp-dark">{record.coverage}%</b> · 潮位{' '}
        <b className="text-sea-mid">
          {record.tideLevel}
          {record.tideUnit}
        </b>
      </div>
      {(record.anomalyTags?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {record.anomalyTags?.slice(0, 2).map((t) => (
            <span
              key={t}
              className="badge bg-coral/10 text-coral border border-coral/30"
            >
              <AlertTriangle className="h-3 w-3" /> {t}
            </span>
          ))}
        </div>
      )}
      {record.remark && (
        <div className="mt-2 rounded-lg bg-kelp/8 border border-kelp/30 px-2 py-1.5 text-[11px] text-ink/80 font-mono line-clamp-2">
          <CornerDownRight className="inline h-3 w-3 mr-1 -mt-0.5 text-kelp-dark" />
          {record.remark}
        </div>
      )}
    </motion.button>
  );
}

function PendingItem({
  record,
  highlight,
  onClick,
}: {
  record: SurveyRecord;
  highlight: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      layout
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      className={cn(
        'w-full text-left rounded-xl border p-3 transition-all',
        highlight
          ? 'border-amber-tide/70 bg-amber-tide/10 shadow-[0_0_0_3px_rgba(232,145,58,0.3)]'
          : 'border-amber-tide/35 bg-amber-tide/5 hover:border-amber-tide/60'
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5">
          <span className="badge bg-amber-tide/15 text-amber-tide border border-amber-tide/50">
            <Clock className="h-3 w-3" /> {shortId(record.id)}
          </span>
          <span className="text-[11px] font-mono text-ink/70">
            {record.timestamp.slice(5, 10)}
          </span>
        </div>
        <span className="text-[10px] font-mono text-ink/50">
          来源第 {record.sourceRow} 行
        </span>
      </div>
      <div className="text-[12px] font-mono text-ink/80 mb-1">
        <b>{record.siteName}</b> · 覆盖度 <b>{record.coverage}%</b>
      </div>
      <div className="rounded-lg bg-white/70 border border-amber-tide/30 px-2 py-1.5 text-[11px] text-ink/90 font-mono mt-1.5">
        <AlertTriangle className="inline h-3 w-3 mr-1 -mt-0.5 text-amber-tide" />
        {record.pendingNote ?? '缺材料'}
      </div>
    </motion.button>
  );
}

function ManualItem({
  record,
  highlight,
  onClick,
}: {
  record: SurveyRecord;
  highlight: boolean;
  onClick: () => void;
}) {
  const m = record.manualOverride!;
  const opt = MANUAL_OPTIONS.find((o) => o.value === m.newStatus);
  const Icon = opt?.icon ?? FileEdit;
  return (
    <motion.button
      layout
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      className={cn(
        'w-full text-left rounded-xl border p-3 transition-all',
        highlight
          ? 'border-kelp/70 bg-kelp/10 shadow-glow-kelp'
          : 'border-kelp/35 bg-kelp/5 hover:border-kelp/60'
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="badge bg-panel-dark text-sand border border-kelp/40">
            <FileEdit className="h-3 w-3" /> {shortId(record.id)}
          </span>
          <span className={cn('badge border', opt?.color)}>
            <Icon className="h-3 w-3" /> {opt?.label ?? m.newStatus}
          </span>
        </div>
        <span className="text-[10px] font-mono text-ink/50">{formatTime(m.at)}</span>
      </div>
      <div className="text-[11.5px] font-mono text-ink/80 mb-1.5">
        <MapPin className="inline h-3 w-3 mr-1 -mt-0.5 text-sea-mid" />
        <b>{record.siteName}</b> · {record.timestamp.slice(5, 10)} · 覆盖度 {record.coverage}%
      </div>
      <div className="rounded-lg bg-white/70 border border-kelp/30 px-2 py-1.5 text-[11px] text-ink/90 font-mono">
        <CornerDownRight className="inline h-3 w-3 mr-1 -mt-0.5 text-kelp-dark" />
        <b className="text-kelp-dark">{m.by}：</b>
        {m.reason}
      </div>
    </motion.button>
  );
}

function DetailPanel({
  record,
  onClose,
}: {
  record: SurveyRecord;
  onClose: () => void;
}) {
  const setOverride = useReplayStore((s) => s.setManualOverride);
  const updateRemark = useReplayStore((s) => s.updateRemark);
  const [reason, setReason] = useState(record.manualOverride?.reason ?? '');
  const [status, setStatus] = useState<ManualStatus>(
    record.manualOverride?.newStatus ?? 'normal'
  );
  const [by, setBy] = useState(record.manualOverride?.by ?? '阿乔');
  const [remarkText, setRemarkText] = useState(record.remark ?? '');

  const handleSave = () => {
    setOverride(record.id, { by, reason: reason || '（无理由）', newStatus: status });
    if (remarkText.trim()) updateRemark(record.id, remarkText.trim());
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="rounded-2xl border border-sand-tide/60 bg-sand p-4 space-y-3 shadow-soft"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-sea-deep text-sea-foam flex items-center justify-center">
            <Layers3 className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-[13px] font-semibold text-ink">
              记录详情 · {record.id} · 第{record.sourceRow}行
            </h4>
            <p className="text-[11px] font-mono text-ink/60">
              {record.siteName} · {record.timestamp.slice(0, 10)} · 批次 {record.sourceBatch}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="h-8 w-8 rounded-full flex items-center justify-center text-ink/50 hover:bg-ink/5 hover:text-ink transition-all"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-white/70 border border-sand-tide/40 p-2">
          <div className="text-[10px] text-ink/50 font-mono">覆盖度</div>
          <div className="text-[15px] font-bold font-mono text-kelp-dark">{record.coverage}%</div>
        </div>
        <div className="rounded-lg bg-white/70 border border-sand-tide/40 p-2">
          <div className="text-[10px] text-ink/50 font-mono">潮位</div>
          <div className="text-[15px] font-bold font-mono text-sea-deep">
            {record.tideLevel}{record.tideUnit}
            <span className="ml-1 text-[10px] text-ink/50 font-normal">
              ={normalizeTideToMeters(record.tideLevel, record.tideUnit)}m
            </span>
          </div>
        </div>
        <div className="rounded-lg bg-white/70 border border-sand-tide/40 p-2">
          <div className="text-[10px] text-ink/50 font-mono">水质指数</div>
          <div className="text-[15px] font-bold font-mono text-purple-700">{record.waterQuality}</div>
        </div>
      </div>

      {(record.anomalyTags?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {record.anomalyTags?.map((t) => (
            <span
              key={t}
              className="badge bg-coral/10 text-coral border border-coral/35"
            >
              <AlertTriangle className="h-3 w-3" /> {t}
            </span>
          ))}
        </div>
      )}

      <div>
        <label className="text-[11px] font-semibold text-ink/70 mb-1 block">
          人工备注（已有内容不会被新导入覆盖）
        </label>
        <textarea
          value={remarkText}
          onChange={(e) => setRemarkText(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-sand-tide/60 bg-white/80 p-2 text-[12px] font-mono text-ink outline-none focus:border-kelp transition-colors"
          placeholder="输入备注，如：现场已复核，覆盖度异常由云层导致..."
        />
      </div>

      <div>
        <label className="text-[11px] font-semibold text-ink/70 mb-1.5 block">
          人工改判状态
        </label>
        <div className="grid grid-cols-2 gap-2">
          {MANUAL_OPTIONS.map((o) => {
            const I = o.icon;
            const selected = status === o.value;
            return (
              <button
                key={o.value}
                onClick={() => setStatus(o.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-medium transition-all',
                  selected
                    ? cn(o.color, 'shadow-md')
                    : 'border-ink/15 text-ink/70 hover:border-ink/30 bg-white/40'
                )}
              >
                <I className="h-4 w-4" /> {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-1">
          <label className="text-[11px] font-semibold text-ink/70 mb-1 block">操作人</label>
          <input
            value={by}
            onChange={(e) => setBy(e.target.value)}
            className="w-full rounded-lg border border-sand-tide/60 bg-white/80 px-2 py-1.5 text-[12px] font-mono text-ink outline-none focus:border-kelp"
          />
        </div>
        <div className="col-span-2">
          <label className="text-[11px] font-semibold text-ink/70 mb-1 block">改判理由</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-sand-tide/60 bg-white/80 px-2 py-1.5 text-[12px] font-mono text-ink outline-none focus:border-kelp"
            placeholder="记录理由，接手同事可追溯..."
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-sea-deep hover:bg-ink text-sand text-[13px] font-semibold py-2.5 transition-all"
      >
        <Send className="h-4 w-4" /> 保存改判与备注
      </button>
    </motion.div>
  );
}

function ColumnHeader({
  icon: Icon,
  title,
  count,
  color,
}: {
  icon: any;
  title: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className={cn('h-8 w-8 rounded-xl flex items-center justify-center', color)}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
          <p className="text-[10.5px] text-ink/55 font-mono">共 {count} 条</p>
        </div>
      </div>
      <span className="badge bg-ink/5 text-ink/70 border border-ink/15">
        {count > 0 ? '可点击查看' : '暂无数据'}
      </span>
    </div>
  );
}

export function RecordColumns() {
  const records = useReplayStore((s) => s.records);
  const highlightIds = useReplayStore((s) => s.highlightRecordIds);
  const selectedId = useReplayStore((s) => s.selectedRecordId);
  const selectRecord = useReplayStore((s) => s.selectRecord);
  const setHighlight = useReplayStore((s) => s.setHighlight);

  const processed = useMemo(
    () =>
      records
        .filter((r) => r.processedAt && !r.flags.isPendingMaterial)
        .sort((a, b) => (b.processedAt ?? '').localeCompare(a.processedAt ?? '')),
    [records]
  );
  const pending = useMemo(
    () =>
      records
        .filter((r) => r.flags.isPendingMaterial)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    [records]
  );
  const manual = useMemo(
    () =>
      records
        .filter((r) => r.manualOverride)
        .sort(
          (a, b) =>
            (b.manualOverride?.at ?? '').localeCompare(a.manualOverride?.at ?? '')
        ),
    [records]
  );

  const selected = useMemo(
    () => records.find((r) => r.id === selectedId) ?? null,
    [records, selectedId]
  );

  const highlightSet = new Set(highlightIds);
  const onClickItem = (id: string) => {
    selectRecord(id);
    setHighlight([id]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.18, ease: 'easeOut' }}
      className="grid grid-cols-1 xl:grid-cols-3 gap-4"
    >
      <div className="panel-glass rounded-2xl p-4 shadow-soft">
        <ColumnHeader
          icon={CheckCircle2}
          title="已处理记录"
          count={processed.length}
          color="bg-kelp/20 text-kelp-dark"
        />
        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1 scrollbar-thin">
          {processed.length === 0 ? (
            <p className="text-[12px] text-ink/50 text-center py-6 font-mono">
              暂无已处理记录
            </p>
          ) : (
            processed.map((r) => (
              <ProcessedItem
                key={r.id}
                record={r}
                highlight={highlightSet.has(r.id)}
                onClick={() => onClickItem(r.id)}
              />
            ))
          )}
        </div>
      </div>

      <div className="panel-glass rounded-2xl p-4 shadow-soft">
        <ColumnHeader
          icon={Clock}
          title="待补材料"
          count={pending.length}
          color="bg-amber-tide/20 text-amber-tide"
        />
        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1 scrollbar-thin">
          {pending.length === 0 ? (
            <p className="text-[12px] text-ink/50 text-center py-6 font-mono">
              材料齐全
            </p>
          ) : (
            pending.map((r) => (
              <PendingItem
                key={r.id}
                record={r}
                highlight={highlightSet.has(r.id)}
                onClick={() => onClickItem(r.id)}
              />
            ))
          )}
        </div>
      </div>

      <div className="panel-glass rounded-2xl p-4 shadow-soft">
        <ColumnHeader
          icon={FileEdit}
          title="人工改判"
          count={manual.length}
          color="bg-sea-light/25 text-sea-deep"
        />
        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1 scrollbar-thin">
          {manual.length === 0 ? (
            <p className="text-[12px] text-ink/50 text-center py-6 font-mono">
              点左侧记录可发起改判
            </p>
          ) : (
            manual.map((r) => (
              <ManualItem
                key={r.id}
                record={r}
                highlight={highlightSet.has(r.id)}
                onClick={() => onClickItem(r.id)}
              />
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <div className="xl:col-span-3">
            <DetailPanel
              record={selected}
              onClose={() => {
                selectRecord(null);
              }}
            />
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
