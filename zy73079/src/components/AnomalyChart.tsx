import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
  type ChartData,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useAppStore } from '../store/useAppStore';
import { formatTimeShort, getMetricStatus } from '../utils';
import type { InspectionRecord } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const ANOMALY_RADIUS = 7;
const NORMAL_RADIUS = 3;

export default function AnomalyChart() {
  const {
    inspections,
    criterion,
    selectedInspectionId,
    setSelectedInspection,
    toggleCriterion,
  } = useAppStore();

  const sorted = useMemo(
    () => [...inspections].sort((a, b) => a.inspectionTime - b.inspectionTime),
    [inspections]
  );

  const labels = sorted.map((i) => formatTimeShort(i.inspectionTime));

  const anomalyPoints = useMemo(() => {
    return sorted.map((r) => {
      const tStatus = getMetricStatus(r.temperature, criterion.temperatureThreshold);
      const vStatus = getMetricStatus(r.vibration, criterion.vibrationThreshold);
      const wStatus = getMetricStatus(r.cutterWear, criterion.wearThreshold);
      const isAnomaly =
        r.isAlarm ||
        tStatus === 'anomaly' ||
        vStatus === 'anomaly' ||
        wStatus === 'anomaly';
      return { record: r, isAnomaly, tStatus, vStatus, wStatus };
    });
  }, [sorted, criterion]);

  const pointRadius = anomalyPoints.map((p) =>
    p.isAnomaly ? ANOMALY_RADIUS : NORMAL_RADIUS
  );
  const pointHoverRadius = anomalyPoints.map((p) =>
    p.isAnomaly ? ANOMALY_RADIUS + 2 : NORMAL_RADIUS + 3
  );
  const pointBg = anomalyPoints.map((p) =>
    p.isAnomaly ? '#EF4444' : '#3B82F6'
  );
  const pointBorder = anomalyPoints.map((p) =>
    p.isAnomaly ? '#FCA5A5' : '#93C5FD'
  );
  const pointWidth = anomalyPoints.map((p) => (p.isAnomaly ? 3 : 1));
  const selectedIdx = sorted.findIndex((r) => r.id === selectedInspectionId);

  const makeDataset = (
    label: string,
    color: string,
    dataKey: keyof InspectionRecord,
    yAxisId: 'y' | 'y1' | 'y2',
    threshold?: number
  ) => ({
    label,
    data: sorted.map((r) => r[dataKey] as number),
    borderColor: color,
    backgroundColor: color + '20',
    fill: false,
    tension: 0.25,
    borderWidth: 2,
    pointRadius,
    pointHoverRadius,
    pointBackgroundColor: pointBg,
    pointBorderColor: pointBorder,
    pointBorderWidth: pointWidth,
    pointStyle: 'circle',
    yAxisID: yAxisId,
    segment: threshold
      ? {
          borderColor: (ctx: any) => {
            const v = ctx.p1.parsed.y;
            if (v >= threshold) return '#EF4444';
            if (v >= threshold * 0.8) return '#F97316';
            return color;
          },
        }
      : undefined,
  });

  const data: ChartData<'line'> = {
    labels,
    datasets: [
      makeDataset(
        `温度 (阈值${criterion.temperatureThreshold}℃)`,
        '#F97316',
        'temperature',
        'y',
        criterion.temperatureThreshold
      ),
      makeDataset(
        `振动 (阈值${criterion.vibrationThreshold}mm/s)`,
        '#A855F7',
        'vibration',
        'y1',
        criterion.vibrationThreshold
      ),
      makeDataset(
        `磨损 (阈值${criterion.wearThreshold}mm)`,
        '#3B82F6',
        'cutterWear',
        'y2',
        criterion.wearThreshold
      ),
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    onClick: (_e, els) => {
      if (!els || els.length === 0) return;
      const idx = els[0].index;
      const rec = sorted[idx];
      if (rec) setSelectedInspection(rec.id);
    },
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#94A3B8', boxWidth: 14, font: { size: 11 } },
      },
      tooltip: {
        backgroundColor: '#1E293B',
        borderColor: '#475569',
        borderWidth: 1,
        titleColor: '#F1F5F9',
        bodyColor: '#CBD5E1',
        padding: 10,
        cornerRadius: 4,
        callbacks: {
          title: (items) => {
            const idx = items[0]?.dataIndex;
            if (idx === undefined) return '';
            const r = sorted[idx];
            const a = anomalyPoints[idx];
            let tag = '';
            if (r.isAlarm) tag = a?.isAnomaly ? '  [⚠ 报警/异常]' : '  [⚠ 报警]';
            else if (a?.isAnomaly) tag = '  [● 指标异常]';
            return `${labels[idx]} — ${r.inspector}${tag}`;
          },
          afterBody: (items) => {
            const idx = items[0]?.dataIndex;
            if (idx === undefined) return [];
            const r = sorted[idx];
            const out = [];
            out.push('');
            out.push(`报警标志: ${r.isAlarm ? '是' : '否'}`);
            if (r.alarmType) out.push(`报警类型: ${r.alarmType}`);
            out.push('');
            out.push('👆 点击此数据点查看巡检表');
            return out;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: '#33415550' },
        ticks: { color: '#64748B', font: { size: 10 } },
      },
      y: {
        type: 'linear',
        position: 'left',
        title: {
          display: true,
          text: '温度 ℃',
          color: '#F97316',
          font: { size: 11 },
        },
        grid: { color: '#33415530' },
        ticks: { color: '#64748B', font: { size: 10 } },
      },
      y1: {
        type: 'linear',
        position: 'right',
        title: {
          display: true,
          text: '振动 mm/s',
          color: '#A855F7',
          font: { size: 11 },
        },
        grid: { drawOnChartArea: false },
        ticks: { color: '#64748B', font: { size: 10 } },
      },
      y2: {
        type: 'linear',
        position: 'right',
        offset: true,
        title: {
          display: true,
          text: '磨损 mm',
          color: '#3B82F6',
          font: { size: 11 },
        },
        grid: { drawOnChartArea: false },
        ticks: { color: '#64748B', font: { size: 10 } },
      },
    },
  };

  const selectedPointPlugin = {
    id: 'selectedPoint',
    afterDatasetsDraw(chart: any) {
      if (selectedIdx < 0) return;
      const { ctx } = chart;
      chart.data.datasets.forEach((_ds: any, di: number) => {
        const meta = chart.getDatasetMeta(di);
        if (!meta.data || !meta.data[selectedIdx]) return;
        const el = meta.data[selectedIdx];
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = '#FDE047';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.arc(el.x, el.y, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });
    },
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
        <div>
          <h3 className="text-slate-100 font-semibold tracking-wide text-sm" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            盾构刀盘异常归因 · 时序监控
          </h3>
          <p className="text-slate-500 text-xs mt-0.5">
            红色点 = 报警/异常 · 点击任一点跳转对应巡检表
          </p>
        </div>
        <button
          onClick={toggleCriterion}
          className="text-xs px-3 py-1.5 rounded border border-slate-600 bg-slate-800/60 text-slate-300 hover:bg-slate-700 hover:text-white transition flex items-center gap-1.5"
        >
          <span>📐</span> 查看计算口径
        </button>
      </div>
      <div className="flex-1 p-3 min-h-0">
        <div className="h-full w-full bg-slate-900/40 rounded border border-slate-700/60 p-2">
          {sorted.length > 0 ? (
            <Line
              options={options}
              data={data}
              plugins={[selectedPointPlugin]}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              暂无巡检数据
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
