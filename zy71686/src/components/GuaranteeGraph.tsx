import { useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import type { GraphResponse, GraphNode, GraphEdge, RiskLevel } from '../../shared/types';
import { getRiskLevelText } from '../store';
import { LoadingSpinner } from './LoadingSpinner';

interface GuaranteeGraphProps {
  data: GraphResponse | null;
  loading?: boolean;
  onNodeClick?: (node: GraphNode) => void;
  height?: string;
}

const riskLevelColors: Record<RiskLevel, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#dc2626',
};

const nodeTypeColors: Record<string, string> = {
  customer: '#4f46e5',
  guarantee: '#059669',
  credit: '#d97706',
};

const nodeTypeLabels: Record<string, string> = {
  customer: '客户',
  guarantee: '担保',
  credit: '授信',
};

const relationTypeLabels: Record<string, string> = {
  directGuarantee: '直接担保',
  counterGuarantee: '反担保',
  creditLine: '授信额度',
};

export function GuaranteeGraph({
  data,
  loading = false,
  onNodeClick,
  height = '600px',
}: GuaranteeGraphProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const chartOption = useMemo(() => {
    if (!data || data.nodes.length === 0) {
      return {
        title: {
          text: '暂无数据',
          left: 'center',
          top: 'center',
          textStyle: {
            color: '#9ca3af',
            fontSize: 16,
          },
        },
      };
    }

    const nodes = data.nodes.map((node) => ({
      id: node.id,
      name: node.name,
      category: node.type,
      symbolSize: node.type === 'customer' ? 50 : 35,
      itemStyle: {
        color: node.type === 'customer' 
          ? riskLevelColors[node.riskLevel] 
          : nodeTypeColors[node.type],
        borderColor: '#ffffff',
        borderWidth: 2,
        shadowBlur: 10,
        shadowColor: node.type === 'customer' 
          ? `${riskLevelColors[node.riskLevel]}40` 
          : `${nodeTypeColors[node.type]}40`,
      },
      label: {
        show: true,
        position: 'bottom',
        distance: 5,
        fontSize: 11,
        color: '#374151',
        formatter: (params: any) => {
          const name = params.name.length > 8 
            ? params.name.slice(0, 8) + '...' 
            : params.name;
          return name;
        },
      },
      value: node.type === 'customer' ? (node.data as any)?.riskScore || 50 : 30,
    }));

    const edges = data.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      lineStyle: {
        color: edge.riskLevel === 'high' || edge.riskLevel === 'critical' 
          ? riskLevelColors[edge.riskLevel] 
          : '#94a3b8',
        width: edge.riskLevel === 'high' || edge.riskLevel === 'critical' ? 2 : 1,
        curveness: 0.1,
        opacity: 0.7,
      },
      label: {
        show: edge.amount !== undefined,
        formatter: edge.amount 
          ? `${(edge.amount / 10000).toFixed(0)}万` 
          : '',
        fontSize: 10,
        color: '#6b7280',
        backgroundColor: '#ffffff',
        padding: [2, 4],
        borderRadius: 4,
      },
      emphasis: {
        lineStyle: {
          width: 3,
          opacity: 1,
        },
      },
      value: edge.amount || 0,
    }));

    const categories = [
      { name: '客户', itemStyle: { color: nodeTypeColors.customer } },
      { name: '担保', itemStyle: { color: nodeTypeColors.guarantee } },
      { name: '授信', itemStyle: { color: nodeTypeColors.credit } },
    ];

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        padding: 12,
        textStyle: {
          color: '#374151',
          fontSize: 12,
        },
        formatter: (params: any) => {
          if (params.dataType === 'node') {
            const nodeData = data.nodes.find(n => n.id === params.data.id);
            if (!nodeData) return '';

            let html = `<div style="font-weight: 600; margin-bottom: 8px;">${nodeData.name}</div>`;
            html += `<div style="color: #6b7280; margin-bottom: 4px;">类型：${nodeTypeLabels[nodeData.type]}</div>`;
            
            if (nodeData.type === 'customer') {
              html += `<div style="color: #6b7280; margin-bottom: 4px;">风险等级：<span style="color: ${riskLevelColors[nodeData.riskLevel]}; font-weight: 600;">${getRiskLevelText(nodeData.riskLevel)}</span></div>`;
              const riskScore = (nodeData.data as any)?.riskScore;
              if (riskScore !== undefined) {
                html += `<div style="color: #6b7280;">风险评分：${riskScore}</div>`;
              }
            } else if (nodeData.type === 'guarantee') {
              const amount = (nodeData.data as any)?.amount;
              if (amount !== undefined) {
                html += `<div style="color: #6b7280;">金额：${(amount / 10000).toLocaleString()}万元</div>`;
              }
            } else if (nodeData.type === 'credit') {
              const totalAmount = (nodeData.data as any)?.totalAmount;
              if (totalAmount !== undefined) {
                html += `<div style="color: #6b7280;">总额度：${(totalAmount / 10000).toLocaleString()}万元</div>`;
              }
            }

            return html;
          } else if (params.dataType === 'edge') {
            const edgeData = data.edges.find(
              e => e.source === params.data.source && e.target === params.data.target
            );
            if (!edgeData) return '';

            const sourceNode = data.nodes.find(n => n.id === edgeData.source);
            const targetNode = data.nodes.find(n => n.id === edgeData.target);

            let html = `<div style="font-weight: 600; margin-bottom: 8px;">${relationTypeLabels[edgeData.relationType] || '关系'}</div>`;
            html += `<div style="color: #6b7280; margin-bottom: 4px;">${sourceNode?.name || edgeData.source} → ${targetNode?.name || edgeData.target}</div>`;
            
            if (edgeData.amount) {
              html += `<div style="color: #6b7280; margin-bottom: 4px;">金额：${(edgeData.amount / 10000).toLocaleString()}万元</div>`;
            }
            
            html += `<div style="color: #6b7280;">风险：<span style="color: ${riskLevelColors[edgeData.riskLevel]}; font-weight: 600;">${getRiskLevelText(edgeData.riskLevel)}</span></div>`;

            return html;
          }
          return '';
        },
      },
      legend: {
        show: true,
        orient: 'vertical',
        right: 20,
        top: 20,
        data: categories.map(c => c.name),
        textStyle: {
          color: '#6b7280',
          fontSize: 12,
        },
      },
      series: [
        {
          type: 'graph',
          layout: 'force',
          roam: true,
          draggable: true,
          categories,
          data: nodes,
          links: edges,
          label: {
            position: 'right',
            formatter: '{b}',
          },
          lineStyle: {
            color: 'source',
            curveness: 0.1,
          },
          emphasis: {
            focus: 'adjacency',
            lineStyle: {
              width: 4,
            },
          },
          force: {
            repulsion: 500,
            edgeLength: [100, 200],
            gravity: 0.1,
            friction: 0.6,
          },
          animationDuration: 1500,
          animationEasingUpdate: 'quinticInOut',
        },
      ],
    };
  }, [data]);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    chartInstance.current.setOption(chartOption);

    const handleClick = (params: any) => {
      if (params.dataType === 'node' && onNodeClick) {
        const node = data?.nodes.find(n => n.id === params.data.id);
        if (node) {
          onNodeClick(node);
        }
      }
    };

    chartInstance.current.on('click', handleClick);

    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      chartInstance.current?.off('click', handleClick);
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, [chartOption, data, onNodeClick]);

  return (
    <div className="relative w-full bg-white rounded-xl border border-gray-100 overflow-hidden">
      {loading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
          <LoadingSpinner size="lg" />
        </div>
      )}
      <div ref={chartRef} style={{ width: '100%', height }} />
      
      {data && data.riskSummary && (
        <div className="absolute bottom-4 left-4 flex gap-4">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">客户数</p>
            <p className="text-lg font-bold text-gray-900">{data.riskSummary.totalCustomers}</p>
          </div>
          <div className="bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">担保数</p>
            <p className="text-lg font-bold text-gray-900">{data.riskSummary.totalGuarantees}</p>
          </div>
          <div className="bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">总暴露</p>
            <p className="text-lg font-bold text-gray-900">
              {(data.riskSummary.totalExposure / 10000).toLocaleString()}万
            </p>
          </div>
          <div className="bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">高/极高风险</p>
            <p className="text-lg font-bold text-risk-high">
              {data.riskSummary.highRiskCount + data.riskSummary.criticalRiskCount}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
