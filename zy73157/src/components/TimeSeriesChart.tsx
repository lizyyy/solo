import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { Play, Pause, SkipBack, SkipForward, Thermometer, Droplets, Wind, Gauge } from 'lucide-react';

type MetricKey = 'temperature' | 'salinity' | 'dissolvedOxygen' | 'pressure';

const METRIC_CONFIG: Record<MetricKey, { label: string; color: string; unit: string; icon: typeof Thermometer }> = {
  temperature: { label: '温度', color: '#F4A261', unit: '°C', icon: Thermometer },
  salinity: { label: '盐度', color: '#5F87B8', unit: 'psu', icon: Droplets },
  dissolvedOxygen: { label: '溶解氧', color: '#2A9D8F', unit: 'mg/L', icon: Wind },
  pressure: { label: '压力', color: '#98B8DA', unit: 'dbar', icon: Gauge },
};

export function TimeSeriesChart() {
  const {
    samples, selectedStationId, selectedSampleId,
    setSelectedSample, anomalies, driftEvents,
    playheadIndex, setPlayheadIndex, isPlaying, setIsPlaying,
  } = useAppStore(useShallow((s) => ({
    samples: s.samples,
    selectedStationId: s.selectedStationId,
    selectedSampleId: s.selectedSampleId,
    setSelectedSample: s.setSelectedSample,
    anomalies: s.anomalies,
    driftEvents: s.driftEvents,
    playheadIndex: s.playheadIndex,
    setPlayheadIndex: s.setPlayheadIndex,
    isPlaying: s.isPlaying,
    setIsPlaying: s.setIsPlaying,
  })));

  const filtered = useMemo(
    () => (selectedStationId ? samples.filter((s) => s.stationId === selectedStationId) : samples),
    [samples, selectedStationId],
  );

  const [metric, setMetric] = useState<MetricKey>('temperature');
  const timerRef = useRef<number | null>(null);

  const stationDrifts = useMemo(
    () => (selectedStationId ? driftEvents.filter((d) => d.affectedStationIds.includes(selectedStationId)) : []),
    [selectedStationId, driftEvents],
  );

  const stationAnomalies = useMemo(
    () => anomalies.filter((a) => a.stationId === selectedStationId && a.metric === metric),
    [anomalies, selectedStationId, metric],
  );

  useEffect(() => {
    if (!isPlaying) return;
    timerRef.current = window.setInterval(() => {
      const cur = useAppStore.getState().playheadIndex;
      setPlayheadIndex(cur + 1 >= filtered.length ? 0 : cur + 1);
    }, 500);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [isPlaying, filtered.length, setPlayheadIndex]);

  if (filtered.length === 0) {
    return (
      <div className="panel">
        <div className="panel-header">时序回放</div>
        <div className="flex h-64 items-center justify-center text-sm text-deepsea-300">请选择左侧采样站位</div>
      </div>
    );
  }

  const values = filtered.map((s) => s[metric]);
  const minV = Math.min(...values) - (METRIC_CONFIG[metric].unit === 'dbar' ? 10 : 0.3);
  const maxV = Math.max(...values) + (METRIC_CONFIG[metric].unit === 'dbar' ? 10 : 0.3);
  const range = maxV - minV || 1;

  const W = 780;
  const H = 260;
  const padL = 48;
  const padR = 16;
  const padT = 20;
  const padB = 32;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const xAt = (i: number) => padL + (i / (filtered.length - 1)) * innerW;
  const yAt = (v: number) => padT + innerH - ((v - minV) / range) * innerH;

  const pathD = filtered
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(s[metric])}`)
    .join(' ');

  const areaD =
    `M ${xAt(0)} ${yAt(minV)} ` +
    filtered.map((s, i) => `L ${xAt(i)} ${yAt(s[metric])}`).join(' ') +
    ` L ${xAt(filtered.length - 1)} ${yAt(minV)} Z`;

  const mc = METRIC_CONFIG[metric];

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
  };

  const sampleAtPlayhead = filtered[Math.min(playheadIndex, filtered.length - 1)];

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span>时序回放</span>
          {selectedStationId && (
            <span className="tag tag-processed">
              {useAppStore.getState().stations.find((s) => s.id === selectedStationId)?.name}
            </span>
          )}
          <span className="tag tag-drift">{mc.label} · {mc.unit}</span>
        </div>
        <div className="flex gap-1">
          {(Object.keys(METRIC_CONFIG) as MetricKey[]).map((k) => {
            const Cfg = METRIC_CONFIG[k].icon;
            return (
              <button
                key={k}
                onClick={() => setMetric(k)}
                className={`btn ${metric === k ? 'btn-primary' : 'btn-ghost'}`}
                title={METRIC_CONFIG[k].label}
              >
                <Cfg size={12} />
                {METRIC_CONFIG[k].label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative px-4 pt-2">
        <svg width={W} height={H} className="block">
          <defs>
            <linearGradient id={`area-${metric}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={mc.color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={mc.color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = padT + innerH * t;
            const v = maxV - range * t;
            return (
              <g key={t}>
                <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="rgba(95,135,184,0.15)" strokeDasharray="2 4" />
                <text x={padL - 6} y={y + 3} textAnchor="end" fill="#98B8DA" fontSize="10" fontFamily="JetBrains Mono">
                  {v.toFixed(2)}
                </text>
              </g>
            );
          })}

          {filtered.filter((_, i) => i % 4 === 0).map((s, i) => {
            const idx = i * 4;
            return (
              <text
                key={s.id}
                x={xAt(idx)}
                y={H - 10}
                textAnchor="middle"
                fill="#98B8DA"
                fontSize="10"
                fontFamily="JetBrains Mono"
              >
                {fmtTime(s.timestamp)}
              </text>
            );
          })}

          {stationDrifts.map((d) => {
            if (d.sensorType !== metric) return null;
            const startIdx = filtered.findIndex((s) => s.timestamp >= d.startTimestamp);
            const endIdx = [...filtered].reverse().findIndex((s) => s.timestamp <= d.endTimestamp);
            const realEnd = endIdx === -1 ? filtered.length - 1 : filtered.length - 1 - endIdx;
            if (startIdx === -1 || realEnd === -1 || realEnd < startIdx) return null;
            const x1 = xAt(startIdx);
            const x2 = xAt(realEnd);
            return (
              <g key={d.id}>
                <rect
                  x={x1}
                  y={padT}
                  width={x2 - x1}
                  height={innerH}
                  fill="rgba(247,127,0,0.18)"
                  stroke="rgba(247,127,0,0.5)"
                  strokeDasharray="4 3"
                  className="animate-driftBlink"
                />
                <text x={x1 + 4} y={padT + 12} fill="#F77F00" fontSize="10" fontFamily="JetBrains Mono">
                  漂移 dr-{d.id.slice(-3)} · ±{d.driftMagnitude.toFixed(2)}{mc.unit}
                </text>
              </g>
            );
          })}

          <path d={areaD} fill={`url(#area-${metric})`} />
          <path d={pathD} fill="none" stroke={mc.color} strokeWidth="1.8" />

          {filtered.map((s, i) => {
            if (s.isWithdrawn) return null;
            return (
              <circle
                key={s.id}
                cx={xAt(i)}
                cy={yAt(s[metric])}
                r="2.5"
                fill={mc.color}
                opacity={i <= playheadIndex ? 1 : 0.25}
                className="cursor-pointer transition-opacity hover:r-4"
                onClick={() => setSelectedSample(s.id)}
              />
            );
          })}

          {filtered.filter((s) => s.isWithdrawn).map((s) => {
            const i = filtered.findIndex((x) => x.id === s.id);
            if (i === -1) return null;
            return (
              <g key={`w-${s.id}`}>
                <line
                  x1={xAt(i) - 6}
                  y1={yAt(s[metric]) - 6}
                  x2={xAt(i) + 6}
                  y2={yAt(s[metric]) + 6}
                  stroke="#6C757D"
                  strokeWidth="2"
                />
                <line
                  x1={xAt(i) - 6}
                  y1={yAt(s[metric]) + 6}
                  x2={xAt(i) + 6}
                  y2={yAt(s[metric]) - 6}
                  stroke="#6C757D"
                  strokeWidth="2"
                />
                <circle cx={xAt(i)} cy={yAt(s[metric])} r="5" fill="none" stroke="#6C757D" strokeWidth="1" strokeDasharray="2 2" />
              </g>
            );
          })}

          {stationAnomalies.map((a) => {
            const i = filtered.findIndex((s) => s.id === a.sampleId);
            if (i === -1) return null;
            return (
              <g
                key={a.id}
                className="cursor-pointer"
                onClick={() => setSelectedSample(a.sampleId)}
              >
                <circle cx={xAt(i)} cy={yAt(a.value)} r="10" fill="rgba(230,57,70,0.18)" className="animate-pulseSlow" />
                <circle cx={xAt(i)} cy={yAt(a.value)} r="5" fill="#E63946" stroke="#fff" strokeWidth="1.5" />
                <text
                  x={xAt(i)}
                  y={yAt(a.value) - 14}
                  textAnchor="middle"
                  fill="#E63946"
                  fontSize="10"
                  fontFamily="JetBrains Mono"
                  fontWeight="600"
                >
                  {a.id.slice(-3)}
                </text>
              </g>
            );
          })}

          <line
            x1={xAt(playheadIndex)}
            x2={xAt(playheadIndex)}
            y1={padT - 4}
            y2={H - padB + 4}
            stroke="#E8F0F8"
            strokeWidth="1.2"
            strokeDasharray="3 3"
          />
          <circle cx={xAt(playheadIndex)} cy={yAt(sampleAtPlayhead[metric])} r="6" fill="#E8F0F8" stroke={mc.color} strokeWidth="2" />
        </svg>
      </div>

      <div className="flex items-center justify-between border-t border-deepsea-700 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-deepsea-200">
          <span className="font-mono">{fmtTime(sampleAtPlayhead.timestamp)}</span>
          <span className="text-deepsea-400">|</span>
          <span>{mc.label}</span>
          <span className="font-mono text-deepsea-50" style={{ color: mc.color }}>
            {sampleAtPlayhead[metric].toFixed(3)} {mc.unit}
          </span>
          {sampleAtPlayhead.isWithdrawn && <span className="tag tag-withdrawn">已撤回</span>}
          {sampleAtPlayhead.status === 'blocked' && <span className="tag tag-blocked">卡着</span>}
          {sampleAtPlayhead.status === 'pending' && <span className="tag tag-pending">待补证据</span>}
        </div>
        <div className="flex items-center gap-1">
          <button className="btn btn-ghost" onClick={() => setPlayheadIndex(0)}>
            <SkipBack size={14} />
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            {isPlaying ? '暂停' : '播放'}
          </button>
          <button className="btn btn-ghost" onClick={() => setPlayheadIndex(filtered.length - 1)}>
            <SkipForward size={14} />
          </button>
          <input
            type="range"
            min={0}
            max={filtered.length - 1}
            value={playheadIndex}
            onChange={(e) => setPlayheadIndex(Number(e.target.value))}
            className="ml-3 w-44 accent-status-processed"
          />
        </div>
      </div>
    </div>
  );
}
