import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Loader2, FileText, FileCheck, FileSignature, Calendar, Phone, AlertTriangle, Folder } from 'lucide-react';
import type { LinkGraph, LinkGraphNode, LinkGraphLink } from '../../shared/types';
import { DATA_TYPE_LABELS } from '../../shared/types';
import { cn } from '@/lib/utils';

interface LinkGraphViewProps {
  data?: LinkGraph;
  loading?: boolean;
  className?: string;
  onNodeClick?: (node: LinkGraphNode) => void;
}

const nodeIcons: Record<string, typeof FileText> = {
  case: Folder,
  invoice: FileText,
  confirmation: FileCheck,
  contract: FileSignature,
  repayment_plan: Calendar,
  collection_note: Phone,
  risk_report: AlertTriangle,
};

const nodeColors: Record<string, string> = {
  case: '#3b82f6',
  invoice: '#10b981',
  confirmation: '#8b5cf6',
  contract: '#f59e0b',
  repayment_plan: '#06b6d4',
  collection_note: '#ec4899',
  risk_report: '#ef4444',
};

export default function LinkGraphView({ data, loading, className, onNodeClick }: LinkGraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const [hoveredNode, setHoveredNode] = useState<LinkGraphNode | null>(null);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height: Math.max(400, height) });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current || loading) return;

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const defs = svg.append('defs');
    
    const arrowMarker = defs
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6);

    arrowMarker.append('path').attr('d', 'M 0,-5 L 10,0 L 0,5').attr('fill', '#94a3b8');

    const nodes: (LinkGraphNode & d3.SimulationNodeDatum)[] = data.nodes.map((d) => ({ ...d }));
    const links = data.links.map((d) => ({
      ...d,
      source: nodes.find((n) => n.id === d.source)!,
      target: nodes.find((n) => n.id === d.target)!,
    })) as unknown as d3.SimulationLinkDatum<LinkGraphNode & d3.SimulationNodeDatum>[];

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink(links)
          .id((d: any) => d.id)
          .distance(120)
      )
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50));

    const linkGroup = svg.append('g').attr('class', 'links');
    const nodeGroup = svg.append('g').attr('class', 'nodes');

    const link = linkGroup
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#cbd5e1')
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrowhead)');

    const linkLabel = linkGroup
      .selectAll('text')
      .data(links)
      .enter()
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#64748b')
      .text((d: any) => d.linkType);

    const node = nodeGroup
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('cursor', 'pointer')
      .call(
        d3
          .drag<SVGGElement, any>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      )
      .on('click', (event, d) => onNodeClick?.(d))
      .on('mouseenter', (event, d) => setHoveredNode(d))
      .on('mouseleave', () => setHoveredNode(null));

    node
      .append('circle')
      .attr('r', 24)
      .attr('fill', (d) => nodeColors[d.type] || '#3b82f6')
      .attr('stroke', 'white')
      .attr('stroke-width', 3);

    node
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', 'white')
      .attr('font-size', '14px')
      .text((d) => {
        const label = DATA_TYPE_LABELS[d.type as keyof typeof DATA_TYPE_LABELS] || d.type;
        return label.charAt(0);
      });

    node
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 42)
      .attr('font-size', '11px')
      .attr('fill', '#475569')
      .attr('font-weight', '500')
      .text((d) => d.name.substring(0, 8) + (d.name.length > 8 ? '...' : ''));

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      linkLabel
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2 - 8);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [data, dimensions, loading, onNodeClick]);

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center h-96 bg-slate-50 rounded-xl', className)}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-blue-600 w-8 h-8" />
          <p className="text-sm text-slate-500">加载关联图谱...</p>
        </div>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-96 bg-slate-50 rounded-xl', className)}>
        <div className="text-center">
          <Folder className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">暂无关联数据</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('relative bg-slate-50 rounded-xl border border-slate-200', className)}>
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="w-full" />
      
      {hoveredNode && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg border border-slate-200 p-3 min-w-[200px]">
          <div className="flex items-center gap-2 mb-2">
            {(() => {
              const Icon = nodeIcons[hoveredNode.type] || FileText;
              return <Icon size={16} className="text-blue-600" />;
            })()}
            <span className="font-medium text-sm text-slate-800">{hoveredNode.name}</span>
          </div>
          <div className="space-y-1 text-xs text-slate-500">
            <p>
              类型: {DATA_TYPE_LABELS[hoveredNode.type as keyof typeof DATA_TYPE_LABELS] || hoveredNode.type}
            </p>
            {hoveredNode.amount && <p>金额: ¥{hoveredNode.amount.toLocaleString()}</p>}
            {hoveredNode.status && <p>状态: {hoveredNode.status}</p>}
            {hoveredNode.date && <p>日期: {hoveredNode.date}</p>}
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-sm border border-slate-200 p-3">
        <p className="text-xs font-medium text-slate-600 mb-2">图例</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {Object.entries(DATA_TYPE_LABELS).map(([type, label]) => {
            const Icon = nodeIcons[type] || FileText;
            return (
              <div key={type} className="flex items-center gap-1.5">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: nodeColors[type] || '#3b82f6' }}
                />
                <span className="text-xs text-slate-500">{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
