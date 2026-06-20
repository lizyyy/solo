import { useCallback, useMemo, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
  type Point,
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import { useAppStore } from '@/store/useAppStore';
import type { Sample } from '@/types';
import { Info } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface ChartPoint {
  x: number;
  y: number;
  sample: Sample;
}

export function ScatterChart() {
  const chartRef = useRef<ChartJS<'scatter'>>(null);

  const paramVersions = useAppStore((state) => state.paramVersions);
  const currentParamVersionId = useAppStore((state) => state.currentParamVersionId);
  const allSamples = useAppStore((state) => state.samples);
  const filters = useAppStore((state) => state.filters);
  const setSelectedSample = useAppStore((state) => state.setSelectedSample);
  const selectedSampleId = useAppStore((state) => state.selectedSampleId);

  const currentVersion = useMemo(
    () => paramVersions.find((v) => v.id === currentParamVersionId),
    [paramVersions, currentParamVersionId]
  );

  const samples = useMemo(() => {
    return allSamples.filter((sample) => {
      if (filters.status.length > 0 && !filters.status.includes(sample.status)) {
        return false;
      }
      if (
        filters.sampleCode &&
        !sample.sampleCode.toLowerCase().includes(filters.sampleCode.toLowerCase())
      ) {
        return false;
      }
      if (filters.dateRange) {
        const sampleDate = new Date(sample.createdAt);
        const startDate = new Date(filters.dateRange[0]);
        const endDate = new Date(filters.dateRange[1]);
        if (sampleDate < startDate || sampleDate > endDate) {
          return false;
        }
      }
      return true;
    });
  }, [allSamples, filters]);

  const threshold = currentVersion?.threshold || 5;

  const getPointStyle = (status: string) => {
    switch (status) {
      case 'abnormal':
        return 'circle' as const;
      case 'duplicate':
        return 'triangle' as const;
      case 'pending':
        return 'rect' as const;
      default:
        return 'circle' as const;
    }
  };

  const getPointColor = (status: string, deviation: number) => {
    switch (status) {
      case 'abnormal':
        return `rgba(214, 69, 69, ${0.6 + (deviation - threshold) * 0.04})`;
      case 'duplicate':
        return 'rgba(243, 156, 18, 0.85)';
      case 'pending':
        return 'rgba(52, 152, 219, 0.85)';
      default:
        return `rgba(39, 174, 96, ${0.6 + (5 - deviation) * 0.08})`;
    }
  };

  const { normalData, abnormalData, duplicateData, pendingData, allPoints } = useMemo(() => {
    const normalData: ChartPoint[] = [];
    const abnormalData: ChartPoint[] = [];
    const duplicateData: ChartPoint[] = [];
    const pendingData: ChartPoint[] = [];

    samples.forEach((sample, index) => {
      const point = { x: index + 1, y: sample.deviation, sample };
      switch (sample.status) {
        case 'normal':
          normalData.push(point);
          break;
        case 'abnormal':
          abnormalData.push(point);
          break;
        case 'duplicate':
          duplicateData.push(point);
          break;
        case 'pending':
          pendingData.push(point);
          break;
      }
    });

    const allPoints = [...normalData, ...abnormalData, ...duplicateData, ...pendingData];

    return { normalData, abnormalData, duplicateData, pendingData, allPoints };
  }, [samples]);

  const data: ChartData<'scatter'> = useMemo(
    () => ({
      datasets: [
        {
          label: '正常',
          data: normalData as Point[],
          backgroundColor: normalData.map((p) => getPointColor('normal', p.y)),
          pointStyle: 'circle',
          pointRadius: 8,
          pointHoverRadius: 12,
        },
        {
          label: '异常',
          data: abnormalData as Point[],
          backgroundColor: abnormalData.map((p) => getPointColor('abnormal', p.y)),
          pointStyle: 'circle',
          pointRadius: 10,
          pointHoverRadius: 14,
        },
        {
          label: '重复',
          data: duplicateData as Point[],
          backgroundColor: '#F39C12',
          pointStyle: 'triangle',
          pointRadius: 10,
          pointHoverRadius: 14,
        },
        {
          label: '待确认',
          data: pendingData as Point[],
          backgroundColor: '#3498DB',
          pointStyle: 'rect',
          pointRadius: 10,
          pointHoverRadius: 14,
        },
      ],
    }),
    [normalData, abnormalData, duplicateData, pendingData, threshold]
  );

  const handleClick = useCallback(
    (_event: unknown, elements: { index: number; datasetIndex: number }[]) => {
      if (elements.length > 0 && chartRef.current) {
        const { datasetIndex, index } = elements[0];
        const dataset = data.datasets[datasetIndex];
        const point = dataset.data[index] as ChartPoint;
        if (point?.sample) {
          setSelectedSample(point.sample.id);
        }
      }
    },
    [data, setSelectedSample]
  );

  const options: ChartOptions<'scatter'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      onClick: handleClick,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 20,
            font: {
              size: 12,
            },
          },
        },
        title: {
          display: false,
        },
        tooltip: {
          backgroundColor: 'rgba(15, 42, 74, 0.95)',
          titleFont: { size: 13, weight: 'bold' },
          bodyFont: { size: 12 },
          padding: 12,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            title: (context) => {
              const point = context[0].raw as ChartPoint;
              return `${point.sample.sampleCode} · ${
                point.sample.status === 'normal'
                  ? '正常'
                  : point.sample.status === 'abnormal'
                  ? '异常'
                  : point.sample.status === 'duplicate'
                  ? '重复'
                  : '待确认'
              }`;
            },
            label: (context) => {
              const point = context.raw as ChartPoint;
              return [
                `偏差: ${point.y.toFixed(2)}%`,
                `预期值: ${point.sample.expected}`,
                `计算值: ${point.sample.actual.toFixed(2)}`,
                `序列: [${point.sample.sequence.join(', ')}]`,
              ];
            },
            footer: () => '点击查看详情',
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: '样本序号',
            font: { size: 12 },
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
          },
        },
        y: {
          title: {
            display: true,
            text: '偏差 (%)',
            font: { size: 12 },
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
          },
          ticks: {
            callback: (value) => value + '%',
          },
        },
      },
    }),
    [handleClick]
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">偏差分布图</h3>
          <p className="mt-0.5 text-xs text-slate-500">点击数据点可快速定位样本并查看详情</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Info size={14} />
          <span>阈值线: {threshold}%</span>
        </div>
      </div>

      {samples.length > 0 ? (
        <>
          <div className="relative h-64">
            <Scatter ref={chartRef} data={data} options={options} />
            {currentVersion && allPoints.length > 0 && (
              <div
                className="pointer-events-none absolute left-12 right-6 border-b-2 border-dashed border-red-300"
                style={{
                  bottom: `${(threshold / Math.max(...allPoints.map((p) => p.y), 10)) * 100}%`,
                }}
              />
            )}
          </div>
          {selectedSampleId && (
            <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
              已选中样本：{samples.find((s) => s.id === selectedSampleId)?.sampleCode}，右侧面板显示详细信息
            </div>
          )}
        </>
      ) : (
        <div className="flex h-64 items-center justify-center text-sm text-slate-400">
          当前筛选条件下无数据
        </div>
      )}
    </div>
  );
}
