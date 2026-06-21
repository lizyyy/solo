import { Anchor, FileWarning, MapPin, ThermometerSun, ScrollText } from 'lucide-react';
import { useTidalStore } from '@/store/useTidalStore';
import type { TideStationAnnotation, AnnotationStatus } from '@/engine/types';
import { cn } from '@/lib/utils';

const STATUS_META: Record<AnnotationStatus, { label: string; cls: string }> = {
  processed: { label: '正常解析', cls: 'border-glow-cyan/40 bg-glow-cyan/10 text-glow-cyan' },
  reprocessed: { label: '备注修正后', cls: 'border-glow-teal/40 bg-glow-teal/10 text-glow-teal' },
  pending_review: { label: '待核查', cls: 'border-signal-amber/40 bg-signal-amber/10 text-signal-amber' },
  exception: { label: '异常·原始保留', cls: 'border-signal-coral/50 bg-signal-coral/10 text-signal-coral' },
};

function StatusBadge({ status }: { status: AnnotationStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn('rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold', meta.cls)}>
      {meta.label}
    </span>
  );
}

function Field({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-signal-moon/40">{label}</span>
      <span
        className={cn(
          'font-mono text-[11px] font-medium',
          danger ? 'text-signal-coral' : 'text-signal-moon',
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function StationPanel() {
  const batch = useTidalStore((s) => s.batch);
  const selectedId = useTidalStore((s) => s.selectedAnnotationId);
  const setRemarkTarget = useTidalStore((s) => s.setRemarkTarget);

  if (!batch || !selectedId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <Anchor className="h-8 w-8 text-glow-teal/40" />
        <p className="font-mono text-[11px] text-signal-moon/40">点选三维场景中的浮标点位</p>
        <p className="font-mono text-[10px] text-signal-moon/30">异常站点会标红并显示原始日志全文</p>
      </div>
    );
  }

  const ann = batch.annotations.find((a) => a.annotationId === selectedId);
  if (!ann) return null;

  const isException = ann.status === 'exception';
  const isPending = ann.status === 'pending_review';
  const raw = ann.buoyRecord.rawLog;
  const coords = ann.buoyRecord.coordinates;
  const tide = ann.buoyRecord.tide;
  const latValid = coords?.latitude != null;
  const lngValid = coords?.longitude != null;
  const tideValid = tide?.valueMeters != null;

  const issueList = ann.csvRow.issues ? ann.csvRow.issues.split(' | ').filter(Boolean) : [];
  const sideNoteLines = ann.sideNote.split('\n');

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-glow-cyan" />
            <h2 className="font-display text-base font-bold text-signal-moon">{ann.stationName}</h2>
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-signal-moon/40">
            时间 {raw.timestamp || '—'} · 来源 {ann.csvRow.source_ref}
          </p>
        </div>
        <StatusBadge status={ann.status} />
      </div>

      <section className="mb-3 rounded-lg border border-glow-teal/20 bg-abyss-700/50 p-3">
        <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-glow-cyan/70">
          <ScrollText className="h-3 w-3" /> 场景标注 · 来自统一数据源
        </h3>
        <p className="font-mono text-[11px] leading-relaxed text-signal-moon/85 whitespace-pre-wrap break-all">
          {ann.sceneAnnotation}
        </p>
      </section>

      {(isException || isPending) && (
        <section className={cn(
          'mb-3 rounded-lg border p-3',
          isException ? 'border-signal-coral/40 bg-signal-coral/5' : 'border-signal-amber/40 bg-signal-amber/5',
        )}>
          <h3 className={cn(
            'mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider',
            isException ? 'text-signal-coral' : 'text-signal-amber',
          )}>
            <FileWarning className="h-3 w-3" /> 解析失败原因与影响判断
          </h3>
          <ul className="space-y-1">
            {issueList.map((n, i) => (
              <li key={i} className="flex gap-1.5 font-mono text-[10px] leading-relaxed text-signal-moon/80">
                <span className={isException ? 'text-signal-coral' : 'text-signal-amber'}>▸</span>
                {n}
              </li>
            ))}
          </ul>
          <p className={cn(
            'mt-2 border-t pt-2 font-mono text-[10px] font-semibold',
            isException ? 'border-signal-coral/20 text-signal-coral' : 'border-signal-amber/20 text-signal-amber',
          )}>
            影响判断：该记录不落海面坐标，CSV 中失败字段记为 PARSE_FAILED，不伪装为 0.000000
          </p>
        </section>
      )}

      <section className="mb-3 rounded-lg border border-glow-teal/20 bg-abyss-800/50 p-3">
        <h3 className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-signal-moon/50">规范化字段 · CSV 明细</h3>
        <div className="divide-y divide-glow-teal/10">
          <Field label="纬度 lat" value={ann.csvRow.latitude} danger={!latValid} />
          <Field label="经度 lng" value={ann.csvRow.longitude} danger={!lngValid} />
          <Field label="潮位(米)" value={ann.csvRow.tide_meters} danger={!tideValid} />
          <Field label="潮位等级" value={ann.csvRow.tide_level} danger={isException} />
          <Field label="原始潮位" value={ann.csvRow.tide_original} />
          <Field label="坐标格式" value={ann.csvRow.coordinate_format} />
          <Field label="原始纬度写法" value={ann.csvRow.latitude_raw} />
          <Field label="原始经度写法" value={ann.csvRow.longitude_raw} />
        </div>
        {(!latValid || !lngValid || !tideValid) && (
          <p className="mt-2 rounded bg-signal-coral/10 px-2 py-1 font-mono text-[10px] text-signal-coral/90">
            ⚠ 失败字段记为 PARSE_FAILED，未伪装为 0.000000 这类看似有效的数值
          </p>
        )}
      </section>

      <section className="mb-3 rounded-lg border border-glow-teal/20 bg-abyss-700/50 p-3">
        <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-glow-cyan/70">
          <ThermometerSun className="h-3 w-3" /> 侧边说明 · 来自统一数据源
        </h3>
        <div className="space-y-0.5 font-mono text-[11px] leading-relaxed text-signal-moon/85">
          {sideNoteLines.map((line, i) => (
            <p key={i} className={line === '---' ? 'text-glow-teal/40' : ''}>{line}</p>
          ))}
        </div>
      </section>

      <section className="mb-3 rounded-lg border border-glow-teal/20 bg-abyss-900/70 p-3">
        <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-signal-moon/50">原始浮标日志全文</h3>
        <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-abyss-900 p-2 font-mono text-[10px] leading-relaxed text-glow-cyan/80">
{raw.rawText}
        </pre>
      </section>

      <button
        onClick={() => setRemarkTarget(ann.annotationId)}
        className={cn(
          'mt-auto w-full rounded-lg border py-2.5 font-mono text-[11px] font-semibold transition-all',
          isException || isPending
            ? 'border-signal-amber/50 bg-signal-amber/15 text-signal-amber hover:bg-signal-amber/25'
            : 'border-glow-cyan/40 bg-glow-cyan/10 text-glow-cyan hover:bg-glow-cyan/20',
        )}
      >
        {isException || isPending ? '针对此站点补备注 / 重跑判断' : '针对此站点追加备注'}
      </button>
    </div>
  );
}
