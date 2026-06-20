import { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  Layers,
  Box,
  AlertTriangle,
  GitBranch,
  Clock,
  Activity,
  FileText,
  User,
  ChevronDown,
  Search,
  Filter,
  PlayCircle,
  Download,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Maximize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReviewStore } from '@/store/useReviewStore';
import RemarkModal from '../components/Modals/RemarkModal';
import DiffModal from '../components/Modals/DiffModal';
import type {
  Component,
  MaterialItem,
  Anomaly,
  TimelineEvent,
  InfluenceNode,
  MaterialRevision,
  Remark,
  ReviewConclusion,
  ComponentCategory,
} from '@/types';

const CATEGORY_COLORS: Record<ComponentCategory, string> = {
  '竖梃': '#6BA3D6',
  '横梃': '#8DB87D',
  '玻璃': '#5B8DEF',
  '连接件': '#C49A6C',
};

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  '严重': { bg: 'bg-accent-red/15', text: 'text-accent-red', border: 'border-accent-red/50' },
  '一般': { bg: 'bg-accent-orange/15', text: 'text-accent-orange', border: 'border-accent-orange/50' },
  '轻微': { bg: 'bg-accent-blue/15', text: 'text-accent-blue', border: 'border-accent-blue/50' },
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  '送审表': '#5B8DEF',
  '备注': '#B4C2CC',
  '异常': '#E5484D',
  '复核': '#F08A3E',
  '导入': '#3E935A',
};

function Header() {
  const runReview = useReviewStore((s) => s.runReview);
  const exportReport = useReviewStore((s) => s.exportReport);
  const conclusions = useReviewStore((s) => s.conclusions);
  const filters = useReviewStore((s) => s.filters);
  const selectedComponentId = useReviewStore((s) => s.selectedComponentId);
  const components = useReviewStore((s) => s.components);
  const activeRevisionId = useReviewStore((s) => s.activeRevisionId);

  const ctx = useMemo(() => {
    const store = useReviewStore.getState();
    return store.getReviewContext();
  }, [activeRevisionId, filters, selectedComponentId]);

  const sortedConclusions = [...conclusions].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  const latestConclusion = sortedConclusions[0];
  const previousConclusion = sortedConclusions[1];
  const selectedComponent = components.find((c) => c.id === selectedComponentId);

  const conclusionStyle = useMemo(() => {
    if (!latestConclusion) return { text: 'text-metal', label: '未复核' };
    if (latestConclusion.status === '通过') return { text: 'text-accent-green', label: '通过' };
    if (latestConclusion.status === '不通过') return { text: 'text-accent-red', label: '不通过' };
    return { text: 'text-accent-orange', label: '有条件通过' };
  }, [latestConclusion]);

  const contextLabel = useMemo(() => {
    const parts: string[] = [];
    if (selectedComponent) parts.push(`构件：${selectedComponent.name}`);
    if (filters.mismatchOnly) parts.push('仅口径不一致');
    if (filters.anomalyOnly) parts.push('仅异常构件');
    if (filters.eventTypes.length > 0) parts.push(`${filters.eventTypes.length} 类事件`);
    return parts.length > 0 ? `筛选：${parts.join(' · ')}` : null;
  }, [selectedComponent, filters]);

  const conclusionChanged = previousConclusion && latestConclusion && previousConclusion.status !== latestConclusion.status;

  return (
    <header className="panel flex items-center justify-between px-5 h-12">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-accent-blue/20 rounded-sm flex items-center justify-center">
            <Layers className="w-4 h-4 text-accent-blue" />
          </div>
          <span className="text-sm font-semibold tracking-wide text-metal-light">幕墙节点图纸复核系统</span>
          <span className="chip border-metal/20 text-metal-dark bg-metal/5">v2.3</span>
        </div>
        <div className="divider-v h-5" />
        <div className="flex items-center gap-2 text-xs text-metal">
          <FileText className="w-3.5 h-3.5" />
          <span>项目：东立面幕墙节点 M1-M2</span>
        </div>
        {contextLabel && (
          <>
            <div className="divider-v h-5" />
            <div className="flex items-center gap-1.5 text-[11px] text-accent-blue">
              <Filter className="w-3 h-3" />
              <span>{contextLabel}</span>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1 bg-metal/5 border border-metal/15">
          <div className={cn('w-2 h-2 rounded-sm', latestConclusion?.status === '通过' ? 'bg-accent-green' : latestConclusion?.status === '不通过' ? 'bg-accent-red' : 'bg-accent-orange anomaly-blink')} />
          <span className="text-[11px] text-metal">当前结论</span>
          <span className={cn('text-xs font-semibold', conclusionStyle.text)}>{conclusionStyle.label}</span>
          {conclusionChanged && (
            <span className="chip !py-0 !px-1.5 text-[9px] bg-accent-orange/15 text-accent-orange border-accent-orange/40 ml-1">
              较上次变化
            </span>
          )}
          <ChevronDown className="w-3 h-3 text-metal-dark" />
        </div>
        <div className="divider-v h-5" />
        <button className="btn" onClick={() => {
          const blob = new Blob([JSON.stringify(exportReport(), null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `review-report-${Date.now()}.json`; a.click();
          URL.revokeObjectURL(url);
        }}>
          <Download className="w-3.5 h-3.5" /> 导出报告
        </button>
        <button className="btn btn-primary" onClick={() => runReview()}>
          <PlayCircle className="w-3.5 h-3.5" /> 运行复核
        </button>
        <div className="flex items-center gap-2 ml-1">
          <div className="w-7 h-7 bg-metal/10 rounded-sm flex items-center justify-center text-[10px] font-medium text-metal-light">岑</div>
          <div className="text-xs">
            <div className="text-metal-light font-medium">岑（BIM协调）</div>
          </div>
        </div>
      </div>
    </header>
  );
}

function MaterialPanel() {
  const revisions = useReviewStore((s) => s.materialRevisions);
  const activeRevisionId = useReviewStore((s) => s.activeRevisionId);
  const setActiveRevision = useReviewStore((s) => s.setActiveRevision);
  const components = useReviewStore((s) => s.components);
  const filters = useReviewStore((s) => s.filters);
  const toggleFilterType = useReviewStore((s) => s.toggleFilterType);
  const setMismatchOnly = useReviewStore((s) => s.setMismatchOnly);
  const setAnomalyOnly = useReviewStore((s) => s.setAnomalyOnly);
  const selectedComponentId = useReviewStore((s) => s.selectedComponentId);
  const flyToComponent = useReviewStore((s) => s.flyToComponent);
  const openRemark = useReviewStore((s) => s.openRemark);
  const remarks = useReviewStore((s) => s.remarks);

  const ctx = useMemo(() => {
    const store = useReviewStore.getState();
    return store.getReviewContext();
  }, [activeRevisionId, filters, selectedComponentId]);

  const activeMaterials = ctx.filteredMaterials;
  const activeRevisionMaterials = ctx.activeRevisionMaterials;

  const getComponent = (cid?: string) => components.find((c) => c.id === cid);
  const getMatchedRemark = (mid: string) => remarks.find((r) => r.linkedMaterialId === mid);

  return (
    <div className="panel flex flex-col col-span-2 overflow-hidden">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Box className="w-3.5 h-3.5 text-accent-blue" />
          <span className="panel-title">材料清单 / Material</span>
        </div>
        <div className="flex items-center gap-1">
          {revisions.map((r) => (
            <button
              key={r.id}
              onClick={() => setActiveRevision(r.id)}
              className={cn(
                'chip',
                activeRevisionId === r.id
                  ? 'border-accent-blue/60 bg-accent-blue/15 text-accent-blue'
                  : 'border-metal/20 text-metal-dark hover:text-metal-light hover:border-metal/40'
              )}
            >
              {r.version} · {r.reviewDate.slice(5)}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 py-2 border-b border-metal/10 flex flex-wrap items-center gap-2 bg-metal/[0.03]">
        <div className="flex items-center gap-1.5 px-2 py-1 bg-bg border border-metal/15 text-[11px] text-metal flex-1 min-w-[140px] max-w-[200px]">
          <Search className="w-3 h-3 text-metal-dark" />
          <input className="bg-transparent border-0 p-0 outline-none text-[11px] w-full placeholder:text-metal-dark/60" placeholder="搜索材料/构件..." />
        </div>
        <button
          className={cn('chip', filters.mismatchOnly ? 'bg-accent-orange/15 text-accent-orange border-accent-orange/50' : 'border-metal/20 text-metal-dark')}
          onClick={() => setMismatchOnly(!filters.mismatchOnly)}
        >
          <AlertCircle className="w-3 h-3" /> 仅差异
        </button>
        <button
          className={cn('chip', filters.anomalyOnly ? 'bg-accent-red/15 text-accent-red border-accent-red/50' : 'border-metal/20 text-metal-dark')}
          onClick={() => setAnomalyOnly(!filters.anomalyOnly)}
        >
          <AlertTriangle className="w-3 h-3" /> 异常构件
        </button>
        <button className="chip border-metal/20 text-metal-dark ml-auto">
          <Filter className="w-3 h-3" /> 筛选
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {activeMaterials.map((m, idx) => {
          const cmp = getComponent(m.componentId);
          const remark = getMatchedRemark(m.id);
          const isSelected = selectedComponentId === m.componentId;
          return (
            <div
              key={m.id}
              className={cn(
                'px-3 py-2.5 border-b border-metal/8 transition-colors cursor-pointer group',
                isSelected ? 'bg-accent-blue/10 border-l-2 border-l-accent-blue' : 'hover:bg-metal/5'
              )}
              onClick={() => m.componentId && flyToComponent(m.componentId)}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-1.5 h-6 rounded-sm flex-shrink-0" style={{ background: CATEGORY_COLORS[cmp?.category ?? '连接件'] }} />
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-metal-light truncate">{m.materialName}</div>
                    <div className="text-[10px] text-metal-dark font-mono">{cmp?.name ?? '未关联'} · {m.source}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  {m.isMismatch && !remark && (
                    <span className="chip bg-accent-red/12 text-accent-red border-accent-red/40">
                      <XCircle className="w-2.5 h-2.5" /> 口径不一致
                    </span>
                  )}
                  {m.isMismatch && remark && (
                    <span className="chip bg-accent-green/12 text-accent-green border-accent-green/40">
                      <CheckCircle2 className="w-2.5 h-2.5" /> 已备注
                    </span>
                  )}
                  {!m.isMismatch && (
                    <span className="chip bg-accent-green/10 text-accent-green/80 border-accent-green/30">
                      <CheckCircle2 className="w-2.5 h-2.5" /> 一致
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className={cn('px-2 py-1.5 text-[10px] font-mono border', m.isMismatch ? 'bg-accent-orange/8 border-accent-orange/30 text-accent-orange' : 'bg-metal/5 border-metal/10 text-metal')}>
                  <div className="text-[9px] text-metal-dark uppercase tracking-wider mb-0.5">送审</div>
                  {m.submissionSpec}
                </div>
                <div className={cn('px-2 py-1.5 text-[10px] font-mono border', m.isMismatch ? 'bg-accent-red/8 border-accent-red/30 text-accent-red' : 'bg-metal/5 border-metal/10 text-metal')}>
                  <div className="text-[9px] text-metal-dark uppercase tracking-wider mb-0.5">施工</div>
                  {m.constructionSpec}
                </div>
              </div>

              {remark && (
                <div className="px-2 py-1.5 bg-accent-blue/8 border border-accent-blue/20 text-[10px] text-metal-light">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className={cn('chip text-[9px]', remark.type === '口头' ? 'bg-accent-blue/15 text-accent-blue border-accent-blue/40' : 'bg-accent-orange/15 text-accent-orange border-accent-orange/40')}>
                      {remark.type}备注
                    </span>
                    <span className="text-metal-dark">{remark.author} · {new Date(remark.createdAt).toLocaleDateString('zh-CN')}</span>
                  </div>
                  <div className="text-[10.5px] leading-relaxed">{remark.content}</div>
                </div>
              )}

              {m.isMismatch && !remark && (
                <button
                  className={cn(
                    'w-full mt-1 py-1 text-[10.5px] opacity-0 group-hover:opacity-100 transition-opacity',
                    'border border-dashed border-metal/25 text-metal-dark hover:border-accent-blue/60 hover:text-accent-blue hover:bg-accent-blue/5'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    openRemark({ linkedMaterialId: m.id, linkedComponentId: m.componentId });
                  }}
                >
                  + 添加备注修正
                </button>
              )}
            </div>
          );
        })}
        {activeMaterials.length === 0 && (
          <div className="flex items-center justify-center h-32 text-metal-dark text-xs">无匹配记录</div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-metal/10 text-[10px] text-metal-dark flex items-center justify-between bg-metal/[0.03]">
        <span>共 {activeMaterials.length} 条 · 差异 {activeRevisionMaterials.filter(m => m.isMismatch).length} 条</span>
        <span>{activeRevisionId ? revisions.find(r => r.id === activeRevisionId)?.sourceFile : '-'}</span>
      </div>
    </div>
  );
}

function ComponentMesh({
  component,
  selected,
  dimmed,
  onClick,
}: {
  component: Component;
  selected: boolean;
  dimmed: boolean;
  onClick: () => void;
}) {
  const color = CATEGORY_COLORS[component.category];
  const isGlass = component.category === '玻璃';
  const baseOpacity = dimmed ? 0.2 : 0.75;

  return (
    <group
      position={[component.positionX, component.positionY, component.positionZ]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[component.sizeW, component.sizeH, component.sizeD]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={isGlass ? (dimmed ? 0.15 : 0.35) : selected ? 0.9 : baseOpacity}
          emissive={selected ? '#5B8DEF' : component.isAnomaly ? '#E5484D' : '#000000'}
          emissiveIntensity={selected ? 0.35 : component.isAnomaly ? 0.6 : 0}
          roughness={isGlass ? 0.1 : 0.55}
          metalness={isGlass ? 0.9 : 0.3}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(component.sizeW, component.sizeH, component.sizeD)]} />
        <lineBasicMaterial color={selected ? '#5B8DEF' : component.isAnomaly ? '#E5484D' : '#8A9BA8'} transparent opacity={dimmed ? 0.15 : 0.53} linewidth={1} />
      </lineSegments>
      {(selected || component.isAnomaly) && (
        <Html position={[0, component.sizeH / 2 + 0.3, 0]} center distanceFactor={10} zIndexRange={[10, 0]}>
          <div className={cn(
            'px-2 py-0.5 text-[10px] whitespace-nowrap font-mono shadow-lg backdrop-blur-sm',
            component.isAnomaly
              ? 'bg-accent-red/90 text-white border border-accent-red'
              : 'bg-accent-blue/90 text-white border border-accent-blue'
          )}>
            {component.name}
          </div>
        </Html>
      )}
    </group>
  );
}

function CameraController() {
  const cameraTarget = useReviewStore((s) => s.cameraTarget);
  const { camera } = useThree();
  useEffect(() => {
    if (cameraTarget) {
      camera.position.set(
        cameraTarget.x + 6,
        cameraTarget.y + 4,
        cameraTarget.z + 8
      );
    }
  }, [cameraTarget, camera]);
  return null;
}

function Scene3D() {
  const components = useReviewStore((s) => s.components);
  const selectedComponentId = useReviewStore((s) => s.selectedComponentId);
  const selectComponent = useReviewStore((s) => s.selectComponent);
  const anomalies = useReviewStore((s) => s.anomalies);
  const remarks = useReviewStore((s) => s.remarks);
  const activeRevisionId = useReviewStore((s) => s.activeRevisionId);
  const filters = useReviewStore((s) => s.filters);
  const ctx = useMemo(() => {
    const store = useReviewStore.getState();
    return store.getReviewContext();
  }, [activeRevisionId, selectedComponentId, filters]);

  const filteredComponentIds = new Set(ctx.filteredComponents.map((c) => c.id));
  const anomalyCount = ctx.filteredAnomalies.length;
  const mismatchCount = ctx.materialMismatches.length;
  const remarkCount = ctx.filteredRemarks.length;

  const isFilteredOut = (cid: string) => {
    if (filteredComponentIds.size === components.length) return false;
    return !filteredComponentIds.has(cid);
  };

  return (
    <div className="panel flex flex-col col-span-3 overflow-hidden relative">
      <div className="panel-header z-10">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-accent-green" />
          <span className="panel-title">三维场景 / Scene 3D</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[10px]">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CATEGORY_COLORS['竖梃'] }} />
            <span className="text-metal-dark">竖梃</span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CATEGORY_COLORS['横梃'] }} />
            <span className="text-metal-dark">横梃</span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CATEGORY_COLORS['玻璃'] }} />
            <span className="text-metal-dark">玻璃</span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CATEGORY_COLORS['连接件'] }} />
            <span className="text-metal-dark">连接件</span>
          </div>
          <div className="divider-v h-4" />
          <button className="btn !py-1 !px-2">
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="absolute top-12 left-3 z-10 flex flex-col gap-2 pt-2">
        <div className="panel !bg-bg/80 !border-metal/20 px-2.5 py-1.5 text-[10px]">
          <div className="text-metal-dark mb-1">构件统计</div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="text-metal-light">{components.length}</span>
            <span className="text-metal-dark">总</span>
            <span className="text-accent-red">{anomalyCount}</span>
            <span className="text-metal-dark">异常</span>
            <span className="text-accent-orange">{mismatchCount}</span>
            <span className="text-metal-dark">差</span>
            <span className="text-accent-blue">{remarkCount}</span>
            <span className="text-metal-dark">备注</span>
          </div>
        </div>
      </div>

      <div className="flex-1 three-canvas-wrap relative bg-black/20">
        <Canvas
          shadows
          camera={{ position: [8, 5, 10], fov: 45 }}
          onPointerMissed={() => selectComponent(null)}
        >
          <color attach="background" args={['#070E17']} />
          <fog attach="fog" args={['#070E17', 20, 50]} />

          <ambientLight intensity={0.4} />
          <directionalLight
            position={[10, 15, 8]}
            intensity={1.1}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <directionalLight position={[-5, 5, -5]} intensity={0.3} />
          <pointLight position={[0, 10, 0]} intensity={0.4} color="#5B8DEF" />

          <Grid
            args={[30, 30]}
            cellSize={1}
            cellThickness={0.3}
            cellColor="#1B232F"
            sectionSize={5}
            sectionThickness={0.6}
            sectionColor="#2F3B4E"
            fadeDistance={40}
            fadeStrength={1}
            infiniteGrid
            position={[0, -2, 0]}
          />

          <Line
            points={[[-15, -2, 0], [15, -2, 0]]}
            color="#4A6FA5"
            lineWidth={1}
          />
          <Line
            points={[[0, -2, -15], [0, -2, 15]]}
            color="#A86132"
            lineWidth={1}
          />

          {components.map((c) => (
            <ComponentMesh
              key={c.id}
              component={c}
              selected={selectedComponentId === c.id}
              dimmed={isFilteredOut(c.id)}
              onClick={() => selectComponent(c.id)}
            />
          ))}

          <CameraController />
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.08}
            minDistance={3}
            maxDistance={30}
            maxPolarAngle={Math.PI / 2 - 0.05}
          />
        </Canvas>

        <div className="absolute bottom-3 left-3 text-[10px] font-mono text-metal-dark/70 space-y-0.5">
          <div>● 左键拖拽 · 旋转视角</div>
          <div>● 滚轮 · 缩放</div>
          <div>● 右键拖拽 · 平移</div>
        </div>
      </div>
    </div>
  );
}

function InfluenceNodeCard({ node, depth = 0 }: { node: InfluenceNode; depth?: number }) {
  const flyToComponent = useReviewStore((s) => s.flyToComponent);
  const materialItems = useReviewStore((s) => s.materialItems);
  const components = useReviewStore((s) => s.components);

  const statusStyle = useMemo(() => {
    switch (node.status) {
      case 'danger': return SEVERITY_STYLES['严重'];
      case 'warning': return SEVERITY_STYLES['一般'];
      case 'info': return { bg: 'bg-accent-blue/12', text: 'text-accent-blue', border: 'border-accent-blue/40' };
      case 'ok': return { bg: 'bg-accent-green/12', text: 'text-accent-green', border: 'border-accent-green/40' };
      default: return { bg: 'bg-metal/10', text: 'text-metal', border: 'border-metal/20' };
    }
  }, [node.status]);

  const iconMap = {
    conclusion: <CheckCircle2 className="w-3 h-3" />,
    material: <Box className="w-3 h-3" />,
    remark: <FileText className="w-3 h-3" />,
    anomaly: <AlertTriangle className="w-3 h-3" />,
  };

  const handleClick = () => {
    if (node.kind === 'anomaly') {
      const anomId = node.id.replace('anom-', '');
      const anomalies = useReviewStore.getState().anomalies;
      const a = anomalies.find((x) => x.id === anomId);
      if (a?.componentId) flyToComponent(a.componentId);
    }
    if (node.kind === 'material') {
      const matId = node.id.replace('mat-', '');
      const m = materialItems.find((x) => x.id === matId);
      if (m?.componentId) flyToComponent(m.componentId);
    }
  };

  return (
    <div className="mb-1.5" style={{ marginLeft: depth * 10 }}>
      <div
        className={cn(
          'px-2 py-1.5 border text-[11px] transition-all cursor-pointer',
          statusStyle.bg, statusStyle.border, 'hover:brightness-125'
        )}
        onClick={handleClick}
      >
        <div className="flex items-center gap-1.5">
          <span className={statusStyle.text}>{iconMap[node.kind]}</span>
          <span className="font-medium text-metal-light flex-1 truncate">{node.title}</span>
          {node.weight > 0.8 && (
            <span className="text-[9px] font-mono text-metal-dark">高影响</span>
          )}
        </div>
        {node.subtitle && (
          <div className="text-[10px] text-metal-dark mt-0.5 leading-snug line-clamp-2">{node.subtitle}</div>
        )}
      </div>
      {node.children && node.children.length > 0 && (
        <div className="mt-1 border-l border-metal/15 pl-2">
          {node.children.map((child) => (
            <InfluenceNodeCard key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function InfluencePanel() {
  const conclusions = useReviewStore((s) => s.conclusions);
  const computeInfluenceChain = useReviewStore((s) => s.computeInfluenceChain);
  const activeRevisionId = useReviewStore((s) => s.activeRevisionId);
  const selectedComponentId = useReviewStore((s) => s.selectedComponentId);
  const filters = useReviewStore((s) => s.filters);
  const components = useReviewStore((s) => s.components);

  const ctx = useMemo(() => {
    const store = useReviewStore.getState();
    return store.getReviewContext();
  }, [activeRevisionId, filters, selectedComponentId]);

  const chain = useMemo(() => computeInfluenceChain(), [conclusions, computeInfluenceChain]);
  const selectedCmp = ctx.selectedComponent;
  const cmpMats = ctx.filteredMaterials;
  const cmpRemarks = ctx.filteredRemarks;
  const cmpAnomalies = ctx.filteredAnomalies;

  return (
    <div className="panel flex flex-col col-span-2 overflow-hidden">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <GitBranch className="w-3.5 h-3.5 text-accent-orange" />
          <span className="panel-title">影响链 / Influence</span>
        </div>
        <button className="chip border-metal/20 text-metal-dark hover:text-metal-light">
          <Eye className="w-3 h-3" /> 展开全部
        </button>
      </div>

      {selectedCmp && (
        <div className="mx-2 mt-2 p-2.5 border border-accent-blue/30 bg-accent-blue/8">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-1.5 h-4 rounded-sm" style={{ background: CATEGORY_COLORS[selectedCmp.category] }} />
            <div>
              <div className="text-[12px] font-semibold text-accent-blue">{selectedCmp.name}</div>
              <div className="text-[10px] text-metal-dark font-mono">
                {selectedCmp.zone} · {selectedCmp.floor}F · pos({selectedCmp.positionX.toFixed(1)}, {selectedCmp.positionY.toFixed(1)})
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1 text-[10px]">
            <div className="bg-metal/5 px-1.5 py-1 text-center">
              <div className="text-metal-dark">材料</div>
              <div className="text-metal-light font-mono">{cmpMats.length}</div>
            </div>
            <div className="bg-metal/5 px-1.5 py-1 text-center">
              <div className="text-metal-dark">备注</div>
              <div className="text-metal-light font-mono">{cmpRemarks.length}</div>
            </div>
            <div className={cn('px-1.5 py-1 text-center', cmpAnomalies.length > 0 ? 'bg-accent-red/12' : 'bg-metal/5')}>
              <div className="text-metal-dark">异常</div>
              <div className={cn('font-mono', cmpAnomalies.length > 0 ? 'text-accent-red' : 'text-metal-light')}>{cmpAnomalies.length}</div>
            </div>
          </div>
        </div>
      )}

      {selectedCmp && (
        <div className="mx-2 mt-2 p-2 border border-accent-orange/30 bg-accent-orange/5">
          <div className="flex items-center gap-1 mb-1.5">
            <Activity className="w-3 h-3 text-accent-orange" />
            <span className="text-[11px] font-semibold text-accent-orange">结论影响分析</span>
          </div>
          <div className="space-y-1.5">
            {cmpMats.filter((m) => m.isMismatch).map((m) => {
              const rmk = cmpRemarks.find((r) => r.linkedMaterialId === m.id);
              return (
                <div key={m.id} className="text-[10px]">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className={cn('w-1.5 h-1.5 rounded-sm', rmk ? 'bg-accent-green' : 'bg-accent-red')} />
                    <span className="text-metal-light font-medium">{m.materialName}</span>
                  </div>
                  {rmk ? (
                    <div className="pl-2.5 text-metal-dark">
                      <span className="text-accent-green">已备注修正</span> · {rmk.type}备注「{rmk.content.slice(0, 15)}...」
                      {rmk.affectsConclusion && <span className="text-accent-orange ml-1">· 影响结论</span>}
                    </div>
                  ) : (
                    <div className="pl-2.5 text-accent-red">未备注 · 口径不一致导致结论降级</div>
                  )}
                </div>
              );
            })}
            {cmpAnomalies.map((a) => (
              <div key={a.id} className="text-[10px]">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-sm bg-accent-red" />
                  <span className="text-accent-red font-medium">{a.type}</span>
                </div>
                <div className="pl-2.5 text-metal-dark">
                  坐标偏移{a.offsetY > 0 ? 'Y+' : 'Y'}{a.offsetY}mm · 结论需现场复核
                </div>
              </div>
            ))}
            {cmpMats.filter((m) => m.isMismatch).length === 0 && cmpAnomalies.length === 0 && (
              <div className="text-[10px] text-accent-green">该构件无影响结论的风险项</div>
            )}
          </div>
        </div>
      )}

      <div className="px-3 py-2 border-b border-metal/10 text-[10px] text-metal-dark flex items-center gap-2">
        <ArrowRight className="w-3 h-3 text-accent-orange" />
        <span>复核结论 → 影响材料 → 修正备注</span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-2">
        {chain.length > 0 ? (
          chain.map((root) => <InfluenceNodeCard key={root.id} node={root} />)
        ) : (
          <div className="flex items-center justify-center h-32 text-metal-dark text-xs">
            暂无复核结论，点击「运行复核」生成影响链
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-metal/10 text-[10px] text-metal-dark flex items-center justify-between bg-metal/[0.03]">
        <span>节点数：{chain.reduce((acc, n) => acc + (n.children?.length ?? 0) + 1, 0)}</span>
        <span className="font-mono">weight 0.4~1.0</span>
      </div>
    </div>
  );
}

function Timeline() {
  const events = useReviewStore((s) => s.timelineEvents);
  const currentEventId = useReviewStore((s) => s.currentEventId);
  const gotoTimelineEvent = useReviewStore((s) => s.gotoTimelineEvent);
  const filters = useReviewStore((s) => s.filters);
  const toggleFilterType = useReviewStore((s) => s.toggleFilterType);
  const activeRevisionId = useReviewStore((s) => s.activeRevisionId);
  const selectedComponentId = useReviewStore((s) => s.selectedComponentId);

  const ctx = useMemo(() => {
    const store = useReviewStore.getState();
    return store.getReviewContext();
  }, [activeRevisionId, filters, selectedComponentId]);

  const filteredEvents = ctx.filteredTimelineEvents;

  return (
    <div className="panel flex flex-col col-span-7 overflow-hidden">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-accent-green" />
          <span className="panel-title">时间线 / Timeline</span>
          <span className="chip border-metal/20 text-metal-dark bg-metal/5">
            {events.length} 条事件
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {(['导入', '送审表', '异常', '备注', '复核'] as const).map((t) => (
            <button
              key={t}
              onClick={() => toggleFilterType(t)}
              className={cn(
                'chip text-[10px]',
                filters.eventTypes.includes(t)
                  ? 'border-transparent'
                  : 'border-metal/20 text-metal-dark/60 hover:text-metal-light'
              )}
              style={filters.eventTypes.includes(t) ? {
                background: `${EVENT_TYPE_COLORS[t]}22`,
                color: EVENT_TYPE_COLORS[t],
                borderColor: `${EVENT_TYPE_COLORS[t]}66`,
              } : undefined}
            >
              <span className="w-1.5 h-1.5 rounded-sm mr-1" style={{ background: EVENT_TYPE_COLORS[t] }} />
              {t}
            </button>
          ))}
          <div className="divider-v h-4 mx-1" />
          <button className="chip border-metal/20 text-metal-dark">
            <Filter className="w-3 h-3" /> 更多
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto scrollbar-thin overflow-y-hidden">
        <div className="h-full flex items-stretch px-4 py-0 gap-1 min-w-max">
          {filteredEvents.map((ev, idx) => {
            const color = EVENT_TYPE_COLORS[ev.type];
            const isActive = ev.id === currentEventId;
            const isCurrent = idx === filteredEvents.length - 1;
            return (
              <div key={ev.id} className="flex items-center h-full">
                <button
                  onClick={() => gotoTimelineEvent(ev.id)}
                  className={cn(
                    'group relative h-24 w-44 flex flex-col justify-center text-left transition-all',
                    isActive ? 'scale-[1.02]' : 'opacity-90 hover:opacity-100'
                  )}
                >
                  <div
                    className={cn(
                      'absolute top-1/2 -translate-y-1/2 w-0 h-0 transition-all',
                      'left-0 border-y-[8px] border-y-transparent',
                      idx > 0 ? 'border-l-[8px]' : '',
                      isActive ? '' : 'opacity-50'
                    )}
                    style={{ borderLeftColor: idx > 0 ? `${color}33` : undefined }}
                  />
                  <div
                    className={cn(
                      'h-full ml-2 px-3 py-2 border transition-all flex flex-col',
                      isActive ? 'border-l-2' : 'border-l'
                    )}
                    style={{
                      borderColor: isActive ? color : `${color}44`,
                      background: isActive ? `${color}14` : `${color}08`,
                      boxShadow: isActive ? `inset 1px 0 0 ${color}` : undefined,
                    }}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-1.5 h-1.5 rounded-sm" style={{ background: color }} />
                      <span className="text-[10px] font-medium" style={{ color }}>{ev.type}</span>
                      {isCurrent && (
                        <span className="chip border-accent-green/40 bg-accent-green/12 text-accent-green text-[9px] ml-auto">当前</span>
                      )}
                    </div>
                    <div className="text-[11.5px] font-medium text-metal-light line-clamp-2 mb-1 leading-tight">{ev.title}</div>
                    {ev.description && (
                      <div className="text-[10px] text-metal-dark line-clamp-2 leading-tight">{ev.description}</div>
                    )}
                    <div className="mt-auto flex items-center justify-between text-[9.5px] text-metal-dark font-mono pt-1">
                      <span>{new Date(ev.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="truncate max-w-[60px]">{ev.operator}</span>
                    </div>
                  </div>
                </button>
                {idx < filteredEvents.length - 1 && (
                  <div className="h-px w-4 self-center" style={{ background: `${EVENT_TYPE_COLORS[filteredEvents[idx + 1].type]}33` }} />
                )}
              </div>
            );
          })}
          {filteredEvents.length === 0 && (
            <div className="flex items-center justify-center text-metal-dark text-xs w-full h-24">
              无匹配事件，调整筛选条件
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-1.5 border-t border-metal/10 text-[10px] text-metal-dark flex items-center justify-between bg-metal/[0.03] font-mono">
        <span>时间范围：{filteredEvents.length > 0 ? `${new Date(filteredEvents[0].timestamp).toLocaleDateString('zh-CN')} ~ ${new Date(filteredEvents[filteredEvents.length - 1].timestamp).toLocaleDateString('zh-CN')}` : '-'}</span>
        <span>事件 ID：{currentEventId ?? '-'}</span>
      </div>
    </div>
  );
}

function AnomalyCard() {
  const components = useReviewStore((s) => s.components);
  const flyToComponent = useReviewStore((s) => s.flyToComponent);
  const selectedComponentId = useReviewStore((s) => s.selectedComponentId);
  const activeRevisionId = useReviewStore((s) => s.activeRevisionId);
  const filters = useReviewStore((s) => s.filters);

  const ctx = useMemo(() => {
    const store = useReviewStore.getState();
    return store.getReviewContext();
  }, [activeRevisionId, filters, selectedComponentId]);

  const anomalies = ctx.filteredAnomalies;
  if (anomalies.length === 0 && !filters.anomalyOnly) return null;
  if (anomalies.length === 0 && filters.anomalyOnly) return null;

  return (
    <div className="fixed top-16 right-4 z-50 w-80 panel shadow-2xl overflow-hidden">
      <div className="panel-header border-accent-red/30 bg-accent-red/10">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-accent-red anomaly-blink" />
          <span className="panel-title !text-accent-red">异常告警 / Anomaly Alert</span>
          <span className="chip bg-accent-red/20 text-accent-red border-accent-red/50">
            {anomalies.length} 项
          </span>
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto scrollbar-thin">
        {anomalies.map((a) => {
          const cmp = components.find((c) => c.id === a.componentId);
          const style = SEVERITY_STYLES[a.severity];
          const isFocused = selectedComponentId === a.componentId;
          return (
            <button
              key={a.id}
              onClick={() => a.componentId && flyToComponent(a.componentId)}
              className={cn(
                'w-full text-left px-3 py-2.5 border-b border-metal/8 transition-all hover:brightness-125',
                isFocused ? 'bg-accent-blue/8' : ''
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <AlertTriangle className={cn('w-3.5 h-3.5 flex-shrink-0 mt-0.5', style.text)} />
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-metal-light">{a.type}</div>
                    <div className="text-[10px] font-mono text-metal-dark">{cmp?.name ?? '未知构件'}</div>
                  </div>
                </div>
                <span className={cn('chip flex-shrink-0 text-[9px]', style.bg, style.text, style.border)}>{a.severity}</span>
              </div>
              <div className="text-[11px] text-metal leading-relaxed mb-1">{a.description}</div>
              <div className="flex items-center gap-3 text-[10px] font-mono">
                {a.offsetX !== 0 && <span className="text-accent-orange">X{a.offsetX > 0 ? '+' : ''}{a.offsetX}mm</span>}
                {a.offsetY !== 0 && <span className="text-accent-orange">Y{a.offsetY > 0 ? '+' : ''}{a.offsetY}mm</span>}
                {a.offsetZ !== 0 && <span className="text-accent-orange">Z{a.offsetZ > 0 ? '+' : ''}{a.offsetZ}mm</span>}
                <span className="text-metal-dark ml-auto">{new Date(a.detectedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Workbench() {
  const loadMockData = useReviewStore((s) => s.loadMockData);

  useEffect(() => {
    loadMockData();
  }, [loadMockData]);

  return (
    <div className="h-screen w-screen flex flex-col gap-1 p-1 box-border">
      <div className="shrink-0">
        <Header />
      </div>

      <div
        className="flex-1 grid gap-1 min-h-0"
        style={{
          gridTemplateColumns: '16fr 22fr 48fr 18fr',
          gridTemplateRows: '1fr',
        }}
      >
        <div className="contents" style={{ gridColumn: '1 / span 2' }}>
          <div className="col-span-2 row-span-1 min-h-0">
            <MaterialPanel />
          </div>
        </div>
        <div className="col-span-3 row-span-1 min-h-0" style={{ gridColumn: '3 / span 1' }}>
          <Scene3D />
        </div>
        <div className="col-span-2 row-span-1 min-h-0" style={{ gridColumn: '4 / span 1' }}>
          <InfluencePanel />
        </div>
      </div>

      <div className="shrink-0 h-[160px]">
        <Timeline />
      </div>

      <AnomalyCard />
      <RemarkModal />
      <DiffModal />
    </div>
  );
}
