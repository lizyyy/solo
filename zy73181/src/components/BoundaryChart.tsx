import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { Problem, ReviewResult } from '@/types';

interface BoundaryChartProps {
  problems: Problem[];
  reviewResults: ReviewResult[];
  onPointClick: (problemId: string) => void;
}

export default function BoundaryChart({ problems, reviewResults, onPointClick }: BoundaryChartProps) {
  const option = useMemo(() => {
    const normalData: [number, number, string, string][] = [];
    const abnormalData: [number, number, string, string][] = [];
    const unitData: [number, number, string, string][] = [];
    const pendingData: [number, number, string, string][] = [];

    const resolveStatus = (p: Problem, r?: ReviewResult) => {
      if (r?.status === 'unit_issue' || p.hasUnitIssue) return 'unit_issue';
      if (r?.status === 'abnormal') return 'abnormal';
      if (r?.status === 'normal') return 'normal';
      if (r?.status === 'skipped') return 'pending';
      return p.reviewStatus;
    };

    problems.forEach((p) => {
      const result = reviewResults.find((r) => r.problemId === p.id);
      const point: [number, number, string, string] = [
        p.originalRow,
        p.boundaryValue || 0,
        p.id,
        p.title,
      ];
      const status = resolveStatus(p, result);

      if (status === 'unit_issue') {
        unitData.push(point);
      } else if (status === 'abnormal') {
        abnormalData.push(point);
      } else if (status === 'pending') {
        pendingData.push(point);
      } else {
        normalData.push(point);
      }
    });

    return {
      backgroundColor: '#102036',
      grid: { left: 50, right: 30, top: 50, bottom: 50 },
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(30, 58, 95, 0.95)',
        borderColor: 'rgba(212, 168, 83, 0.5)',
        borderWidth: 1,
        textStyle: { color: '#fff', fontSize: 12 },
        formatter: (params: { value: [number, number, string, string]; seriesName: string }) => {
          const [row, val, id, title] = params.value;
          return `
            <div style="font-family: 'JetBrains Mono', monospace;">
              <div style="color:#d4a853;font-weight:600;margin-bottom:4px;">${id}</div>
              <div style="color:#d9e1ec;font-size:11px;margin-bottom:4px;max-width:200px;">${title}</div>
              <div style="color:#b3c3da;font-size:11px;">行号: ${row} | 边界值: ${val}</div>
              <div style="color:#7fa1c1;font-size:11px;">状态: ${params.seriesName}</div>
            </div>
          `;
        },
      },
      legend: {
        data: ['正常', '异常', '单位问题', '待复核'],
        textStyle: { color: '#d9e1ec', fontSize: 11 },
        top: 10,
        right: 20,
        icon: 'circle',
      },
      xAxis: {
        type: 'value',
        name: '原始行号',
        nameTextStyle: { color: '#7fa1c1', fontSize: 11 },
        axisLine: { lineStyle: { color: '#2d5a87' } },
        axisLabel: { color: '#7fa1c1', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(45, 90, 135, 0.3)' } },
      },
      yAxis: {
        type: 'value',
        name: '边界值',
        nameTextStyle: { color: '#7fa1c1', fontSize: 11 },
        axisLine: { lineStyle: { color: '#2d5a87' } },
        axisLabel: { color: '#7fa1c1', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(45, 90, 135, 0.3)' } },
      },
      series: [
        {
          name: '正常',
          type: 'scatter',
          data: normalData,
          symbolSize: 10,
          itemStyle: {
            color: '#27ae60',
            opacity: 0.85,
            shadowBlur: 8,
            shadowColor: 'rgba(39, 174, 96, 0.4)',
          },
          emphasis: {
            itemStyle: {
              color: '#27ae60',
              opacity: 1,
              shadowBlur: 16,
              shadowColor: 'rgba(39, 174, 96, 0.7)',
            },
            symbolSize: 14,
          },
        },
        {
          name: '异常',
          type: 'scatter',
          data: abnormalData,
          symbolSize: 12,
          itemStyle: {
            color: '#e74c3c',
            opacity: 0.9,
            shadowBlur: 10,
            shadowColor: 'rgba(231, 76, 60, 0.5)',
          },
          emphasis: {
            itemStyle: {
              color: '#e74c3c',
              opacity: 1,
              shadowBlur: 20,
              shadowColor: 'rgba(231, 76, 60, 0.8)',
            },
            symbolSize: 16,
          },
        },
        {
          name: '单位问题',
          type: 'scatter',
          data: unitData,
          symbolSize: 14,
          itemStyle: {
            color: '#8e44ad',
            opacity: 0.9,
            shadowBlur: 10,
            shadowColor: 'rgba(142, 68, 173, 0.5)',
          },
          emphasis: {
            itemStyle: {
              color: '#8e44ad',
              opacity: 1,
              shadowBlur: 20,
              shadowColor: 'rgba(142, 68, 173, 0.8)',
            },
            symbolSize: 18,
          },
        },
        {
          name: '待复核',
          type: 'scatter',
          data: pendingData,
          symbolSize: 9,
          itemStyle: {
            color: '#95a5a6',
            opacity: 0.7,
          },
          emphasis: {
            itemStyle: { color: '#95a5a6', opacity: 1 },
            symbolSize: 13,
          },
        },
      ],
    };
  }, [problems, reviewResults]);

  const onChartClick = (params: { value: [number, number, string, string] }) => {
    if (params.value && params.value[2]) {
      onPointClick(params.value[2]);
    }
  };

  return (
    <div className="card-academic overflow-hidden animate-fade-in stagger-2">
      <div className="px-5 py-4 border-b border-academic-100 flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-academic-800">边界值分布图</h3>
          <p className="text-xs text-academic-500 mt-0.5">点击散点可回溯到对应题目行</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-academic-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-status-normal"></span>正常
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-status-abnormal"></span>异常
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-status-unit"></span>单位
          </span>
        </div>
      </div>
      <ReactECharts
        option={option}
        style={{ height: 340 }}
        onEvents={{ click: onChartClick }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  );
}
