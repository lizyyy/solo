import { useMemo, useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { ECharts } from 'echarts';
import type { StressPoint, RiskLevel } from '../../types';
import { getRiskLevelColor, getRiskLevelLabel } from '../../utils/stressCalculator';
import { usePrintStore } from '../../store/usePrintStore';

interface StressHeatmapProps {
  stressDistribution: StressPoint[][];
  onChartReady?: (chart: ECharts) => void;
}

export const StressHeatmap = ({ stressDistribution, onChartReady }: StressHeatmapProps) => {
  const { selectDetailRow, selectedPoint } = usePrintStore();
  const chartRef = useRef<ReactECharts>(null);

  const chartOption = useMemo(() => {
    if (!stressDistribution || stressDistribution.length === 0) {
      return {};
    }

    const xLabels = Array.from({ length: stressDistribution[0].length }, (_, i) => `X${i}`);
    const yLabels = Array.from({ length: stressDistribution.length }, (_, i) => `Y${i}`);

    const data: [number, number, number, string, string][] = [];
    for (let y = 0; y < stressDistribution.length; y++) {
      for (let x = 0; x < stressDistribution[y].length; x++) {
        const point = stressDistribution[y][x];
        data.push([x, y, point.value, point.detailRowId, point.riskLevel]);
      }
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        position: 'top',
        formatter: (params: { data: [number, number, number, string, string] }) => {
          const [x, y, value, , riskLevel] = params.data;
          const levelLabel = getRiskLevelLabel(riskLevel as RiskLevel);
          const color = getRiskLevelColor(riskLevel as RiskLevel);
          return `
            <div style="font-family: monospace; padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 4px;">位置 (${x}, ${y})</div>
              <div>应力值: <span style="font-weight: bold; color: ${color}">${value.toFixed(1)}</span></div>
              <div>风险等级: <span style="color: ${color}">${levelLabel}</span></div>
              <div style="font-size: 11px; color: #888; margin-top: 4px;">点击查看明细</div>
            </div>
          `;
        },
      },
      grid: {
        left: 40,
        right: 40,
        top: 30,
        bottom: 40,
      },
      xAxis: {
        type: 'category',
        data: xLabels,
        splitArea: { show: true },
        axisLabel: { color: '#94a3b8', fontSize: 10 },
        axisLine: { lineStyle: { color: '#334155' } },
      },
      yAxis: {
        type: 'category',
        data: yLabels,
        splitArea: { show: true },
        axisLabel: { color: '#94a3b8', fontSize: 10 },
        axisLine: { lineStyle: { color: '#334155' } },
      },
      visualMap: {
        min: 0,
        max: 100,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        textStyle: { color: '#94a3b8' },
        inRange: {
          color: ['#00B42A', '#FFAA00', '#FF7D00', '#F53F3F'],
        },
        formatter: (value: number) => {
          if (value < 30) return '低风险';
          if (value < 55) return '中风险';
          if (value < 75) return '高风险';
          return '极高风险';
        },
      },
      series: [
        {
          name: '应力分布',
          type: 'heatmap',
          data,
          label: {
            show: true,
            color: '#fff',
            fontSize: 10,
            formatter: (params: { data: [number, number, number] }) => params.data[2].toFixed(0),
          },
          emphasis: {
            itemStyle: {
              borderColor: '#fff',
              borderWidth: 2,
            },
          },
          itemStyle: {
            borderColor: '#1e293b',
            borderWidth: 1,
          },
          select: {
            itemStyle: {
              borderColor: '#165DFF',
              borderWidth: 3,
            },
          },
          selectedMode: 'single',
        },
      ],
    };
  }, [stressDistribution]);

  const onEvents = useMemo(
    () => ({
      click: (params: { data: [number, number, number, string, string] }) => {
        const [x, y, , detailRowId] = params.data;
        selectDetailRow(detailRowId, { x, y });
      },
    }),
    [selectDetailRow],
  );

  useEffect(() => {
    const chart = chartRef.current?.getEchartsInstance();
    if (chart && selectedPoint) {
      chart.dispatchAction({
        type: 'select',
        seriesIndex: 0,
        dataIndex: selectedPoint.y * stressDistribution[0].length + selectedPoint.x,
      });
    }
  }, [selectedPoint, stressDistribution]);

  if (!stressDistribution || stressDistribution.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 bg-slate-800/30 rounded-lg border border-slate-700 border-dashed">
        <div className="text-gray-500 text-center">
          <div className="text-4xl mb-2">📊</div>
          <div>暂无应力数据</div>
          <div className="text-sm">请先运行应力分析</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
      <h4 className="text-sm font-medium text-gray-300 mb-2">应力分布热力图</h4>
      <ReactECharts
        ref={chartRef}
        option={chartOption}
        style={{ height: '360px' }}
        onEvents={onEvents}
        onChartReady={(chart) => onChartReady?.(chart)}
        notMerge
      />
    </div>
  );
};
