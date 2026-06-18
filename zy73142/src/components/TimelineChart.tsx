import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Ban,
  FileText,
  MapPin,
  Ruler,
  Tag,
} from 'lucide-react';
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { useReplayStore } from '@/store/useReplayStore';
import type { SurveyRecord } from '@/types';
import { normalizeTideToMeters } from '@/utils/anomaly';
import { cn } from '@/lib/utils';

type ChartDatum = {
  date: string;
  ts: number;
  site: string;
  recordId: string;
  coverage: number;
  waterQuality: number;
  tideMeters: number;
  tideRaw: number;
  tideUnit: string;
  flags: SurveyRecord['flags'];
  anomalyTags: string[];
  sourceRow: number;
  hasManual: boolean;
  statusLabel: string;
  statusColor: string;
  dotSize: number;
  remark?: string;
  manualOverride?: SurveyRecord['manualOverride'];
  pendingNote?: string;
};

function statusOf(r: SurveyRecord): { label: string; color: string; size: number } {
  if (r.manualOverride) {
    const s = r.manualOverride.newStatus;
    if (s === 'outlier_keep') return { label: '人工判留', color: '#E8913A', size: 130 };
    if (s === 'outlier_reject') return { label: '人工判弃', color: '#D9534F', size: 130 };
    if (s === 'pending') return { label: '转待补', color: '#E8913A', size: 110 };
    return { label: '人工已核', color: '#3BAF7B', size: 110 };
  }
  if (r.flags.isPendingMaterial) return { label: '待补材料', color: '#E8913A', size: 110 };
  if (r.flags.isOutlier) return { label: '疑似离群', color: '#D9534F', size: 130 };
  if (r.flags.isUnitMismatch) return { label: '单位混写', color: '#4A90B8', size: 110 };
  if (r.flags.isNameMismatch) return { label: '命名不符', color: '#8B5CF6', size: 110 };
  return { label: '正常', color: '#3BAF7B', size: 70 };
}

function CustomDot(props: any) {
  const { cx, cy, payload, isHighlighted, onClick, onMouseEnter, onMouseLeave } = props;
  if (!payload) return null;
  const { statusColor, dotSize, recordId, hasManual } = payload;
  return (
    <g
      onClick={() => onClick?.(recordId)}
      onMouseEnter={() => onMouseEnter?.(recordId)}
      onMouseLeave={() => onMouseLeave?.()}
      style={{ cursor: 'pointer' }}
    >
      {isHighlighted && (
        <circle
          cx={cx}
          cy={cy}
          r={Math.sqrt(dotSize) + 10}
          fill="none"
          stroke="#D9534F"
          strokeWidth={2}
          strokeDasharray="4 3"
          opacity={0.9}
        >
          <animate attributeName="r" values={`${Math.sqrt(dotSize) + 6};${Math.sqrt(dotSize) + 12};${Math.sqrt(dotSize) + 6}`} dur="1.6s" repeatCount="indefinite" />
        </circle>
      )}
      {hasManual && (
        <circle
          cx={cx}
          cy={cy}
          r={Math.sqrt(dotSize) + 4}
          fill="none"
          stroke="#F4EFE6"
          strokeWidth={2}
        />
      )}
      <circle cx={cx} cy={cy} r={Math.sqrt(dotSize) / 1.4} fill={statusColor} stroke="#0E1F27" strokeWidth={1.5} />
    </g>
  );
}

function CustomTooltipContent({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload as ChartDatum | undefined;
  if (!d) return null;
  const tags = d.anomalyTags ?? [];
  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="bubble min-w-[260px] rounded-xl border border-sand-tide/70 bg-sand/98 p-3 shadow-soft text-[12px] text-ink"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">{d.site}</div>
        <span
          className="badge"
          style={{ background: d.statusColor + '22', color: d.statusColor, borderColor: d.statusColor + '55' }}
        >
          {d.statusLabel}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px] text-ink/80 mb-2">
        <div>时间</div><div className="text-right">{d.date}</div>
        <div>覆盖度</div><div className="text-right text-kelp-dark font-semibold">{d.coverage} %</div>
        <div>水质指数</div><div className="text-right text-sea-deep font-semibold">{d.waterQuality}</div>
        <div>潮位</div>
        <div className="text-right font-semibold">
          {d.tideRaw} {d.tideUnit}
          {d.tideUnit !== 'm' && (
            <span className="ml-1 text-ink/50">= {d.tideMeters} m</span>
          )}
        </div>
        <div className="flex items-center gap-1"><FileText className="h-3 w-3 text-ink/50" />来源行</div>
        <div className="text-right text-coral font-semibold">第 {d.sourceRow} 行</div>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {tags.map((t) => (
            <span key={t} className="badge bg-coral/10 text-coral border border-coral/30">
              <AlertTriangle className="h-3 w-3" /> {t}
            </span>
          ))}
        </div>
      )}
      {d.remark && (
        <div className="rounded-lg bg-kelp/10 border border-kelp/30 p-2 text-[11px] text-ink/80">
          <div className="flex items-center gap-1 text-kelp-dark font-semibold mb-0.5">
            <Tag className="h-3 w-3" /> 人工备注
          </div>
          {d.remark}
        </div>
      )}
      {d.manualOverride && (
        <div className="mt-2 rounded-lg bg-amber-tide/15 border border-amber-tide/40 p-2 text-[11px] text-ink/80">
          <div className="flex items-center gap-1 font-semibold text-amber-tide mb-0.5">
            <MapPin className="h-3 w-3" /> 人工改判 · {d.manualOverride.by}
          </div>
          {d.manualOverride.reason}
        </div>
      )}
      {d.pendingNote && (
        <div className="mt-2 rounded-lg bg-sea-light/15 border border-sea-light/40 p-2 text-[11px] text-ink/80">
          <div className="flex items-center gap-1 font-semibold text-sea-mid mb-0.5">
            <Ruler className="h-3 w-3" /> 待补材料
          </div>
          {d.pendingNote}
        </div>
      )}
    </motion.div>
  );
}

export function TimelineChart() {
  const records = useReplayStore((s) => s.records);
  const highlightIds = useReplayStore((s) => s.highlightRecordIds);
  const selectedId = useReplayStore((s) => s.selectedRecordId);
  const selectRecord = useReplayStore((s) => s.selectRecord);
  const setHighlight = useReplayStore((s) => s.setHighlight);
  const activeVersion = useReplayStore((s) => s.activeVersion);

  const [hoverId, setHoverId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...records].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    [records]
  );

  const data = useMemo<ChartDatum[]>(() => {
    return sorted.map((r) => {
      const s = statusOf(r);
      return {
        date: r.timestamp.slice(5, 10),
        ts: new Date(r.timestamp).getTime(),
        site: r.siteName,
        recordId: r.id,
        coverage: r.coverage,
        waterQuality: r.waterQuality,
        tideMeters: normalizeTideToMeters(r.tideLevel, r.tideUnit),
        tideRaw: r.tideLevel,
        tideUnit: r.tideUnit,
        flags: r.flags,
        anomalyTags: r.anomalyTags ?? [],
        sourceRow: r.sourceRow,
        hasManual: !!r.manualOverride,
        statusLabel: s.label,
        statusColor: s.color,
        dotSize: s.size,
        remark: r.remark,
        manualOverride: r.manualOverride,
        pendingNote: r.pendingNote,
      };
    });
  }, [sorted]);

  const coverageLine = useMemo(
    () => data.map((d) => ({ date: d.date, ts: d.ts, coverage: d.coverage })),
    [data]
  );

  const activeHighlight = new Set(highlightIds);
  if (selectedId) activeHighlight.add(selectedId);
  if (hoverId) activeHighlight.add(hoverId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.12, ease: 'easeOut' }}
      className="panel-dark rounded-2xl p-5 shadow-soft relative overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background:
            'radial-gradient(600px 260px at 50% 120%, rgba(59,175,123,0.18) 0%, rgba(11,61,79,0) 70%)',
        }}
      />
      <div className="flex items-center justify-between mb-4 relative">
        <div>
          <h3 className="text-[15px] font-semibold text-sand title-serif">
            时序回放 · 覆盖度 & 潮位 & 水质
          </h3>
          <p className="text-[11px] text-sea-foam/70 font-mono mt-1">
            点击数据点查看来源行与异常说明 · 圆圈外虚线高亮为当前版本变化点
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="badge bg-kelp/15 text-kelp-soft border border-kelp/40">覆盖度 %</span>
          <span className="badge bg-sea-light/20 text-sea-foam border border-sea-light/40">水质指数</span>
          <span className="badge bg-sand-tide/25 text-sand-tide border border-sand-tide/50">潮位 m</span>
          <span className="badge bg-coral/15 text-coral-soft border border-coral/40">异常点</span>
          <span className="badge bg-panel-dark text-sand border border-kelp/50">
            <Ban className="h-3 w-3" style={{ color: '#F4EFE6' }} />
            {activeVersion}
          </span>
        </div>
      </div>

      <div className="relative" style={{ height: 420 }}>
        <AnimatePresence>
          <motion.div
            key="chart"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0"
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={data}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="coverageArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3BAF7B" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3BAF7B" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(142,197,217,0.1)" strokeDasharray="3 4" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="rgba(244,239,230,0.55)"
                  tick={{ fill: 'rgba(244,239,230,0.75)', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(244,239,230,0.3)' }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#3BAF7B"
                  tick={{ fill: '#7BCFA6', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(59,175,123,0.4)' }}
                  domain={[0, 160]}
                  label={{
                    value: '覆盖度 %',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#7BCFA6',
                    fontSize: 11,
                    fontFamily: 'JetBrains Mono',
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#C9B896"
                  tick={{ fill: '#C9B896', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(201,184,150,0.5)' }}
                  domain={[0, 3]}
                  label={{
                    value: '潮位 m',
                    angle: 90,
                    position: 'insideRight',
                    fill: '#C9B896',
                    fontSize: 11,
                    fontFamily: 'JetBrains Mono',
                  }}
                />
                <ZAxis dataKey="dotSize" range={[40, 200]} />
                <Tooltip
                  content={<CustomTooltipContent />}
                  cursor={{ stroke: 'rgba(142,197,217,0.25)', strokeDasharray: '4 3' }}
                  isAnimationActive={false}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: 'rgba(244,239,230,0.8)' }}
                  iconType="circle"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="coverage"
                  data={coverageLine}
                  stroke="#3BAF7B"
                  strokeWidth={2.5}
                  dot={false}
                  name="覆盖度 %"
                  strokeDasharray="2000"
                  className="anim-draw"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="waterQuality"
                  stroke="#4A90B8"
                  strokeWidth={1.6}
                  strokeDasharray="5 4"
                  dot={false}
                  name="水质指数"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="tideMeters"
                  stroke="#C9B896"
                  strokeWidth={1.6}
                  strokeDasharray="2 3"
                  dot={false}
                  name="潮位 m"
                />
                <Scatter
                  yAxisId="left"
                  dataKey="coverage"
                  name="记录点"
                  isAnimationActive={false}
                  shape={(props: any) => (
                    <CustomDot
                      {...props}
                      isHighlighted={activeHighlight.has(props.payload?.recordId)}
                      onClick={(id: string) => {
                        selectRecord(id);
                        setHighlight([id]);
                      }}
                      onMouseEnter={(id: string) => setHoverId(id)}
                      onMouseLeave={() => setHoverId(null)}
                    />
                  )}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className={cn('mt-3 flex items-center justify-between text-[11px] font-mono text-sea-foam/70')}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-kelp" /> 正常
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-coral" /> 离群/噪声
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-sea-light" /> 单位混写
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-purple-400" /> 命名不符
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-tide" /> 待补/判留
          </span>
        </div>
        <div>共 {sorted.length} 个记录点</div>
      </div>
    </motion.div>
  );
}
