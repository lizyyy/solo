import { useState } from 'react';
import { Building2, Lightbulb, Frame, Gauge, Calendar, FileCheck, ChevronRight, ChevronDown, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMainStore } from '@/store/mainStore';
import type { DataSourceType, Artwork, LightSource } from '@/types';

const TREE_NODES: { type: DataSourceType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: 'gallery', label: '展厅', icon: <Building2 size={16} />, color: '#C9A962' },
  { type: 'lightSource', label: '光源', icon: <Lightbulb size={16} />, color: '#F2994A' },
  { type: 'artwork', label: '作品', icon: <Frame size={16} />, color: '#C9A962' },
  { type: 'sampling', label: '照度采样', icon: <Gauge size={16} />, color: '#27AE60' },
  { type: 'exhibition', label: '展期', icon: <Calendar size={16} />, color: '#2F80ED' },
  { type: 'report', label: '保护报告', icon: <FileCheck size={16} />, color: '#9B51E0' },
];

interface TreeItemProps {
  node: typeof TREE_NODES[0];
  isExpanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
  count: number;
}

function TreeItem({ node, isExpanded, onToggle, children, count }: TreeItemProps) {
  return (
    <div className="mb-1">
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#16181D] transition-colors">
        {isExpanded ? <ChevronDown size={14} className="text-[#5A5D63]" /> : <ChevronRight size={14} className="text-[#5A5D63]" />}
        <div style={{ color: node.color }}>{node.icon}</div>
        <span className="flex-1 text-left text-sm" style={{ fontFamily: "'Noto Serif SC', serif", color: '#B0B2B8' }}>{node.label}</span>
        <span className="text-xs text-[#5A5D63] font-mono">{count}</span>
      </button>
      {isExpanded && children && <div className="ml-6 mt-1 border-l border-[#2A2D34] pl-2">{children}</div>}
    </div>
  );
}

function ArtworkItem({ artwork, isSelected, onClick }: { artwork: Artwork; isSelected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn(
      'w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-all',
      isSelected ? 'bg-[#C9A962]/20 text-[#C9A962]' : 'text-[#8B8D93] hover:bg-[#16181D] hover:text-[#B0B2B8]'
    )}>
      <MapPin size={12} className="flex-shrink-0" />
      <span className="flex-1 truncate" style={{ fontFamily: "'Noto Serif SC', serif" }}>{artwork.name}</span>
      {artwork.currentIllumination !== undefined && <span className="font-mono text-[10px]">{artwork.currentIllumination.toFixed(0)}lx</span>}
    </button>
  );
}

function LightItem({ source, isSelected, onClick }: { source: LightSource; isSelected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn(
      'w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-all',
      isSelected ? 'bg-[#F2994A]/20 text-[#F2994A]' : 'text-[#8B8D93] hover:bg-[#16181D] hover:text-[#B0B2B8]'
    )}>
      <Lightbulb size={12} className="flex-shrink-0" />
      <span className="flex-1 truncate" style={{ fontFamily: "'Noto Serif SC', serif" }}>{source.name}</span>
      <span className="font-mono text-[10px]">{source.intensity.toFixed(0)}%</span>
    </button>
  );
}

export default function DataTree() {
  const [expanded, setExpanded] = useState<Set<DataSourceType>>(new Set(['gallery', 'lightSource', 'artwork']));
  const { gallery, lightSources, artworks, samplingData, exhibitions, reports, selectedArtworkId, selectedLightSourceId, selectArtwork, selectLightSource } = useMainStore();

  const toggle = (type: DataSourceType) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    return next;
  });

  const getCount = (type: DataSourceType): number => {
    switch (type) {
      case 'gallery': return gallery ? 1 : 0;
      case 'lightSource': return lightSources.length;
      case 'artwork': return artworks.length;
      case 'sampling': return samplingData.length;
      case 'exhibition': return exhibitions.length;
      case 'report': return reports.length;
      default: return 0;
    }
  };

  const renderChildren = (type: DataSourceType) => {
    if (type === 'artwork') return artworks.map(a => <ArtworkItem key={a.id} artwork={a} isSelected={selectedArtworkId === a.id} onClick={() => selectArtwork(a.id)} />);
    if (type === 'lightSource') return lightSources.map(s => <LightItem key={s.id} source={s} isSelected={selectedLightSourceId === s.id} onClick={() => selectLightSource(s.id)} />);
    if (type === 'gallery' && gallery) return (
      <div className="px-2 py-1.5 text-xs text-[#8B8D93]">
        <div style={{ fontFamily: "'Noto Serif SC', serif" }}>{gallery.name}</div>
        <div className="font-mono text-[10px] mt-1">{gallery.width}×{gallery.height}×{gallery.depth}m</div>
      </div>
    );
    if (type === 'sampling') return samplingData.slice(0, 5).map(d => (
      <div key={d.id} className="px-2 py-1.5 text-xs text-[#8B8D93] flex items-center justify-between">
        <span className="font-mono">#{d.id.slice(-6)}</span>
        <span className="text-[#27AE60]">{d.measuredValue.toFixed(1)}lx</span>
      </div>
    ));
    if (type === 'exhibition') return exhibitions.map(e => (
      <div key={e.id} className="px-2 py-1.5 text-xs text-[#8B8D93]">
        <div style={{ fontFamily: "'Noto Serif SC', serif" }}>{e.name}</div>
        <div className="font-mono text-[10px] mt-1">{e.startDate} ~ {e.endDate}</div>
      </div>
    ));
    if (type === 'report') return reports.slice(0, 5).map(r => (
      <div key={r.id} className="px-2 py-1.5 text-xs text-[#8B8D93] flex items-center justify-between">
        <span className="font-mono">{r.reportNo}</span>
        <span className="text-[#9B51E0]">{r.riskSummary.totalRisks}项</span>
      </div>
    ));
    return null;
  };

  return (
    <div className="w-72 bg-[#121418] border-r border-[#2A2D34] flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[#2A2D34]">
        <h3 className="text-sm font-semibold text-[#C9A962]" style={{ fontFamily: "'Noto Serif SC', serif" }}>数据源</h3>
        <p className="text-xs text-[#5A5D63] mt-0.5 font-mono">点击数据项定位3D场景</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {TREE_NODES.map(node => (
          <TreeItem key={node.type} node={node} isExpanded={expanded.has(node.type)} onToggle={() => toggle(node.type)} count={getCount(node.type)}>
            {renderChildren(node.type)}
          </TreeItem>
        ))}
      </div>
    </div>
  );
}
