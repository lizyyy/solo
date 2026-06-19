import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useMemo } from 'react';
import type { GraphData } from '../types';

interface Props {
  data: GraphData;
  title: string;
}

export default function PathGraph({ data, title }: Props) {
  const option: EChartsOption = useMemo(() => {
    const categories = [
      { name: '起点' },
      { name: '中间节点' },
      { name: '终点' },
    ];
    return {
      title: {
        text: title,
        left: 'center',
        top: 8,
        textStyle: { fontSize: 13, color: '#1e3a5f', fontFamily: 'Noto Serif SC, serif', fontWeight: 600 },
      },
      tooltip: {
        formatter: (p: unknown) => {
          const d = p as { dataType: string; data: { name?: string; weight?: number } };
          if (d.dataType === 'node') return `节点：${d.data.name ?? ''}`;
          if (d.dataType === 'edge') return `权重：${d.data.weight ?? 0}`;
          return '';
        },
      },
      legend: [{ data: categories.map((c) => c.name), bottom: 4, textStyle: { fontSize: 11 } }],
      animationDuration: 600,
      series: [
        {
          type: 'graph',
          layout: 'force',
          categories,
          roam: false,
          draggable: false,
          label: {
            show: true,
            position: 'right',
            fontSize: 12,
            fontFamily: 'JetBrains Mono, monospace',
          },
          edgeLabel: {
            show: true,
            fontSize: 11,
            fontFamily: 'JetBrains Mono, monospace',
            formatter: (p: unknown) => {
              const params = p as { data: { weight?: number } };
              return String(params.data?.weight ?? 0);
            },
          },
          force: { repulsion: 260, edgeLength: [80, 140] },
          data: data.nodes.map((n) => ({
            id: n.id,
            name: n.name,
            category: n.category ?? 1,
            symbolSize: n.affected ? 48 : 36,
            itemStyle: {
              color: n.affected ? '#d97706' : '#1e3a5f',
              borderColor: n.affected ? '#b45309' : '#15273e',
              borderWidth: 2,
            },
          })),
          edges: data.edges.map((e) => ({
            source: e.source,
            target: e.target,
            weight: e.weight,
            lineStyle: {
              width: e.affected ? 3.5 : 1.5,
              color: e.affected ? '#d97706' : '#94a3b8',
              curveness: 0.1,
            },
          })),
          emphasis: { focus: 'adjacency', lineStyle: { width: 4 } },
        },
      ],
    };
  }, [data, title]);

  return (
    <div className="h-[340px] w-full">
      <ReactECharts option={option} style={{ width: '100%', height: '100%' }} notMerge />
      <div className="flex justify-center gap-6 text-xs text-slate-500 -mt-2">
        <span>最短路径：<span className="font-mono-data text-navy-800 font-semibold">{data.path.join(' → ') || '无解'}</span></span>
        <span>总权重：<span className="font-mono-data text-navy-800 font-semibold">{Number.isFinite(data.totalCost) ? data.totalCost.toFixed(1) : '∞'}</span></span>
      </div>
    </div>
  );
}
