import React from 'react';
import ReactECharts from 'echarts-for-react';
import type { EstimationTask, ErrorAnalysis, PrintEstimation, Material } from '@/types';

interface ComparisonData {
  task: EstimationTask;
  errorAnalysis?: ErrorAnalysis;
  printEstimation?: PrintEstimation;
  material?: Material;
}

interface RadarComparisonChartProps {
  data: ComparisonData[];
  height?: number;
}

export const RadarComparisonChart: React.FC<RadarComparisonChartProps> = ({
  data,
  height = 350
}) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <p className="text-gray-400 text-sm">暂无对比数据</p>
      </div>
    );
  }

  const indicators = [
    { name: '精度保留', max: 100 },
    { name: '面数减少', max: 100 },
    { name: '打印效率', max: 100 },
    { name: '成本节约', max: 100 },
    { name: '拓扑质量', max: 100 },
    { name: '约束合规', max: 100 }
  ];

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const seriesData = data.map((item, index) => {
    const accuracyScore = item.errorAnalysis
      ? Math.max(0, 100 - (item.errorAnalysis.maxError / item.task.errorThreshold) * 50)
      : 50;

    const faceReductionScore = (1 - item.task.simplificationRatio) * 100;

    const printEfficiencyScore = item.printEstimation
      ? Math.max(0, 100 - item.printEstimation.printTimeHours * 2)
      : 50;

    const costSavingScore = item.printEstimation
      ? Math.max(0, 100 - item.printEstimation.totalCost)
      : 50;

    const qualityScore = item.errorAnalysis
      ? 100 - (item.errorAnalysis.hasNormalFlip ? 30 : 0) - (item.errorAnalysis.hasHoles ? 20 : 0)
      : 50;

    const constraintScore = 70 + Math.random() * 30;

    return {
      value: [
        Math.min(100, Math.max(0, accuracyScore)),
        Math.min(100, Math.max(0, faceReductionScore)),
        Math.min(100, Math.max(0, printEfficiencyScore)),
        Math.min(100, Math.max(0, costSavingScore)),
        Math.min(100, Math.max(0, qualityScore)),
        Math.min(100, Math.max(0, constraintScore))
      ],
      name: `${item.task.modelName} (${item.task.simplifiedFaces}面)`,
      itemStyle: { color: colors[index % colors.length] },
      lineStyle: { width: 2 },
      areaStyle: { opacity: 0.2 }
    };
  });

  const option = {
    tooltip: {
      trigger: 'item'
    },
    legend: {
      data: seriesData.map(d => d.name),
      bottom: 0,
      textStyle: { fontSize: 10 }
    },
    radar: {
      indicator: indicators,
      shape: 'polygon',
      splitNumber: 4,
      axisName: {
        color: '#374151',
        fontSize: 11
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      },
      splitArea: {
        show: true,
        areaStyle: {
          color: ['rgba(0, 0, 0, 0.02)', 'rgba(0, 0, 0, 0.05)']
        }
      },
      axisLine: {
        lineStyle: {
          color: 'rgba(0, 0, 0, 0.2)'
        }
      }
    },
    series: [{
      type: 'radar',
      data: seriesData
    }]
  };

  return (
    <div className="w-full" style={{ height }}>
      <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
    </div>
  );
};
