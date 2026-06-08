import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceDot,
} from 'recharts';
import type { WeightPoint } from '../../shared/types.js';
import { AnomalyBadge } from './StatusBadge.js';

interface Props {
  points: WeightPoint[];
  onPointClick?: (pt: WeightPoint) => void;
}

export function WeightChart({ points, onPointClick }: Props) {
  const [showOld, setShowOld] = useState(true);
  const [activeDate, setActiveDate] = useState<string | null>(null);

  const currentPts = useMemo(() => points.filter(p => p.isCurrent), [points]);
  const oldPts = useMemo(() => points.filter(p => !p.isCurrent), [points]);

  const chartData = useMemo(() => {
    const map = new Map<string, { date: string; current?: number; old?: number; remark: string; isAnomaly: boolean }>();
    currentPts.forEach(p => {
      map.set(p.date, {
        date: p.date,
        current: p.weight,
        remark: p.remark,
        isAnomaly: p.remark.includes('⚠️') || p.remark.includes('异常') || p.remark.includes('下降'),
      });
    });
    if (showOld) {
      oldPts.forEach(p => {
        const cur = map.get(p.date) || { date: p.date, remark: '', isAnomaly: false };
        cur.old = p.weight;
        map.set(p.date, cur);
      });
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [currentPts, oldPts, showOld]);

  const anomalyDates = chartData.filter(d => d.isAnomaly).map(d => d.date);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <AnomalyBadge kind="weight" />
          <span className="text-xs text-ink-500">
            共 {currentPts.length} 次测量，{anomalyDates.length} 次异常波动
          </span>
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-ink-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showOld}
            onChange={e => setShowOld(e.target.checked)}
            className="w-3.5 h-3.5 accent-brand-600"
          />
          叠加旧版曲线（虚线对比）
        </label>
      </div>

      <div className="w-full h-[320px] bg-gradient-to-b from-brand-50/30 to-white rounded-2xl p-4 border border-ink-100">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
            onClick={e => {
              if (e?.activeLabel && onPointClick) {
                const pt = currentPts.find(p => p.date === e.activeLabel) || oldPts.find(p => p.date === e.activeLabel);
                if (pt) onPointClick(pt);
              }
            }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E6DE" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#5A564A' }} stroke="#B7B4A8" />
            <YAxis tick={{ fontSize: 11, fill: '#5A564A' }} stroke="#B7B4A8" domain={['auto', 'auto']}
              tickFormatter={v => `${v}kg`} width={52} />
            <Tooltip
              contentStyle={{
                borderRadius: 12, border: '1px solid #E8E6DE',
                boxShadow: '0 8px 32px -12px rgba(27,67,50,.25)',
                padding: '8px 12px', fontSize: 12,
              }}
              labelStyle={{ fontWeight: 600, color: '#1B4332', marginBottom: 4 }}
              formatter={(value: any, name: string) => [
                `${value} kg`,
                name === 'current' ? '当前版本' : '旧版数据',
              ]}
              labelFormatter={l => {
                const d = chartData.find(x => x.date === l);
                return d ? `${l} — ${d.remark || '正常'}` : l;
              }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }}
              formatter={v => v === 'current' ? '当前版本体重' : '旧版体重曲线（归档）'} />
            <Line
              type="monotone" dataKey="current" stroke="#1B4332" strokeWidth={2.8}
              dot={{ r: 4, fill: '#1B4332', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 7, stroke: '#1B4332', strokeWidth: 2, fill: '#95D5B2' }}
              onClick={(d: any) => {
                setActiveDate(d.date);
                const pt = currentPts.find(p => p.date === d.date);
                if (pt && onPointClick) onPointClick(pt);
              }}
            />
            {showOld && (
              <Line
                type="monotone" dataKey="old" stroke="#B7B4A8" strokeWidth={2} strokeDasharray="5 5"
                dot={{ r: 3, fill: '#fff', stroke: '#B7B4A8', strokeWidth: 2 }}
                connectNulls
              />
            )}
            {anomalyDates.map(date => {
              const pt = chartData.find(d => d.date === date);
              return pt ? (
                <ReferenceDot key={'anom-' + date} x={date} y={pt.current}
                  r={9} stroke="#E76F51" strokeWidth={2.5} fill="none"
                  className="animate-pulse-soft" />
              ) : null;
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {activeDate && (
        <div className="text-xs text-ink-500 bg-brand-50/60 border border-brand-100 rounded-xl px-3 py-2 animate-slide-down">
          💡 提示：点击体重曲线上的节点，可以直接跳转到当日对应的异常照片和复核备注。
          当前高亮日期：<span className="font-semibold text-brand-700">{activeDate}</span>
        </div>
      )}
    </div>
  );
}
