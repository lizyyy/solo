import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { X, ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';
import type { LinkGraph as LinkGraphType, LinkGraphNode, LinkGraphLink, BusinessDataType } from '../../shared/types';
import { DATA_TYPE_LABELS } from '../../shared/types';

interface LinkGraphProps {
  data: LinkGraphType;
  onNodeClick?: (node: LinkGraphNode) => void;
  className?: string;
  width?: number;
  height?: number;
}

interface TooltipData {
  node: LinkGraphNode;
  x: number;
  y: number;
}

const typeColors: Record<BusinessDataType | 'case', string> = {
  case: '#2563eb',
  invoice: '#10b981',
  confirmation: '#8b5cf6',
  contract: '#f59e0b',
  repayment_plan: '#06b6d4',
  collection_note: '#ef4444',
  risk_report: '#f97316',
};

const typeBorderColors: Record<BusinessDataType | 'case', string> = {
  case: '#1d4ed8',
  invoice: '#059669',
  confirmation: '#7c3aed',
  contract: '#d97706',
  repayment_plan: '#0891b2',
  collection_note: '#dc2626',
  risk_report: '#ea580c',
};

const nodeRadius = 28;
const linkColors: Record<string, string> = {
  belongs_to: '#94a3b8',
  references: '#64748b',
  supports: '#22c55e',
  creates: '#3b82f6',
  default: '#cbd5e1',
};

export const LinkGraph: React.FC<LinkGraphProps> = ({
  data,
  onNodeClick,
  className,
  width = 800,
  height = 500,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [dimensions, setDimensions] = useState({ width, height });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width || width,
          height: rect.height || height,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [width, height]);

  const nodes = useMemo(() => {
    return data.nodes.map(d => ({
      ...d,
      x: (dimensions.width / 2) + (Math.random() - 0.5) * 200,
      y: (dimensions.height / 2) + (Math.random() - 0.5) * 200,
    }));
  }, [data.nodes, dimensions]);

  const links = useMemo(() => {
    return data.links.map(d => ({ ...d }));
  }, [data.links]);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const container = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom);

    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links as any)
        .id((d: any) => d.id)
        .distance(120)
        .strength(0.6))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force('collision', d3.forceCollide().radius(nodeRadius + 10));

    const linkGroup = container.append('g').attr('class', 'links');
    const link = linkGroup.selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', (d: any) => linkColors[d.linkType] || linkColors.default)
      .attr('stroke-width', (d: any) => 1 + (d.confidence || 0.5) * 2)
      .attr('stroke-opacity', 0.7);

    const linkLabelGroup = container.append('g').attr('class', 'link-labels');
    linkLabelGroup.selectAll('text')
      .data(links)
      .enter()
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#64748b')
      .attr('pointer-events', 'none')
      .text((d: any) => d.linkType);

    const nodeGroup = container.append('g').attr('class', 'nodes');
    const node = nodeGroup.selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('cursor', 'pointer')
      .call(d3.drag<any, any>()
        .on('start', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }));

    node.append('circle')
      .attr('r', nodeRadius)
      .attr('fill', (d: any) => typeColors[d.type] || '#64748b')
      .attr('stroke', (d: any) => typeBorderColors[d.type] || '#475569')
      .attr('stroke-width', 2)
      .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))')
      .on('mouseenter', function(event, d: any) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', nodeRadius + 4)
          .attr('stroke-width', 3);
        setTooltip({
          node: d,
          x: event.pageX,
          y: event.pageY,
        });
      })
      .on('mousemove', function(event) {
        if (tooltip) {
          setTooltip(prev => prev ? { ...prev, x: event.pageX, y: event.pageY } : null);
        }
      })
      .on('mouseleave', function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', nodeRadius)
          .attr('stroke-width', 2);
        setTooltip(null);
      })
      .on('click', (_, d) => {
        onNodeClick?.(d as LinkGraphNode);
      });

    node.append('text')
      .attr('dy', 4)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('fill', 'white')
      .attr('pointer-events', 'none')
      .text((d: any) => {
        const label = DATA_TYPE_LABELS[d.type] || d.type;
        return label.substring(0, 2);
      });

    node.append('text')
      .attr('y', nodeRadius + 18)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#334155')
      .attr('pointer-events', 'none')
      .text((d: any) => {
        const name = d.name || d.id;
        return name.length > 10 ? name.substring(0, 10) + '...' : name;
      });

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      linkLabelGroup.selectAll('text')
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2 - 5);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    const resetZoom = () => {
      svg.transition()
        .duration(500)
        .call(zoom.transform, d3.zoomIdentity);
    };

    return () => {
      simulation.stop();
    };
  }, [nodes, links, dimensions, onNodeClick]);

  const handleZoomIn = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(d3.zoom().scaleBy, 1.3);
  };

  const handleZoomOut = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(d3.zoom().scaleBy, 0.7);
  };

  const handleReset = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition()
      .duration(500)
      .call(d3.zoom().transform, d3.zoomIdentity);
  };

  return (
    <div className={cn('relative bg-white rounded-xl border border-slate-200 overflow-hidden', className)}>
      {/* Legend */}
      <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-sm rounded-lg border border-slate-200 p-3 shadow-sm">
        <p className="text-xs font-medium text-slate-500 mb-2">图例</p>
        <div className="space-y-1.5">
          {Object.entries(DATA_TYPE_LABELS).map(([type, label]) => (
            <div key={type} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: typeColors[type as BusinessDataType] }}
              />
              <span className="text-xs text-slate-600">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: typeColors.case }}
            />
            <span className="text-xs text-slate-600">案件</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-white/95 backdrop-blur-sm rounded-lg border border-slate-200 p-1 shadow-sm">
        <button
          onClick={handleZoomIn}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
          title="放大"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
          title="缩小"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleReset}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
          title="重置视图"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Graph Container */}
      <div
        ref={containerRef}
        className="w-full"
        style={{ height: dimensions.height }}
      >
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="bg-slate-50"
        />
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-slate-800 text-white rounded-lg shadow-xl p-3 min-w-[200px] pointer-events-none"
          style={{
            left: tooltip.x + 15,
            top: tooltip.y + 15,
          }}
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: typeColors[tooltip.node.type] || '#64748b' }}
              />
              <span className="font-medium text-sm">{tooltip.node.name || tooltip.node.id}</span>
            </div>
          </div>
          <div className="space-y-1 text-xs text-slate-300">
            <p>
              <span className="text-slate-400">类型：</span>
              {DATA_TYPE_LABELS[tooltip.node.type as BusinessDataType] || tooltip.node.type}
            </p>
            {tooltip.node.amount && (
              <p>
                <span className="text-slate-400">金额：</span>
                ¥{tooltip.node.amount.toLocaleString()}
              </p>
            )}
            {tooltip.node.status && (
              <p>
                <span className="text-slate-400">状态：</span>
                {tooltip.node.status}
              </p>
            )}
            {tooltip.node.date && (
              <p>
                <span className="text-slate-400">日期：</span>
                {new Date(tooltip.node.date).toLocaleDateString('zh-CN')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
          <div className="text-center text-slate-500">
            <Maximize2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-sm">暂无关联数据</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LinkGraph;
