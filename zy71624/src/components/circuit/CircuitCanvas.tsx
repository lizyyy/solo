import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CircuitComponent as CircuitComponentType, Wire, CircuitNode } from '@/types';
import { CircuitComponent } from './CircuitComponent';
import { useGameStore } from '@/store/gameStore';
import { getNodeWorldPosition } from '@/utils/componentFactory';

interface CircuitCanvasProps {
  width?: number;
  height?: number;
}

interface DragState {
  isDragging: boolean;
  componentId: string | null;
  offsetX: number;
  offsetY: number;
}

interface WiringState {
  isWiring: boolean;
  fromNodeId: string | null;
  mouseX: number;
  mouseY: number;
}

export function CircuitCanvas({ width = 1200, height = 600 }: CircuitCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    componentId: null,
    offsetX: 0,
    offsetY: 0,
  });
  const [wiringState, setWiringState] = useState<WiringState>({
    isWiring: false,
    fromNodeId: null,
    mouseX: 0,
    mouseY: 0,
  });

  const circuit = useGameStore(state => state.circuit);
  const selectedComponentId = useGameStore(state => state.selectedComponentId);
  const selectedWireId = useGameStore(state => state.selectedWireId);
  const highlightedErrorId = useGameStore(state => state.highlightedErrorId);
  const incidents = useGameStore(state => state.incidents);
  const moveComponent = useGameStore(state => state.moveComponent);
  const selectComponent = useGameStore(state => state.selectComponent);
  const selectWire = useGameStore(state => state.selectWire);
  const addWire = useGameStore(state => state.addWire);
  const removeWire = useGameStore(state => state.removeWire);
  const toggleSwitch = useGameStore(state => state.toggleSwitch);
  const highlightError = useGameStore(state => state.highlightError);

  const getNodePosition = useCallback((nodeId: string): { x: number; y: number } | null => {
    for (const comp of circuit.components) {
      const nodeIndex = comp.nodes.findIndex(n => n.id === nodeId);
      if (nodeIndex >= 0) {
        return getNodeWorldPosition(comp, nodeIndex);
      }
    }
    return null;
  }, [circuit.components]);

  const handleDragStart = useCallback((e: React.MouseEvent, component: CircuitComponentType) => {
    if (e.button !== 0) return;

    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;

    const x = e.clientX - svgRect.left;
    const y = e.clientY - svgRect.top;

    setDragState({
      isDragging: true,
      componentId: component.id,
      offsetX: x - component.x,
      offsetY: y - component.y,
    });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;

    const x = e.clientX - svgRect.left;
    const y = e.clientY - svgRect.top;

    if (dragState.isDragging && dragState.componentId) {
      const newX = Math.max(0, Math.min(width - 100, x - dragState.offsetX));
      const newY = Math.max(0, Math.min(height - 100, y - dragState.offsetY));
      moveComponent(dragState.componentId, newX, newY);
    }

    if (wiringState.isWiring) {
      setWiringState(prev => ({
        ...prev,
        mouseX: x,
        mouseY: y,
      }));
    }
  }, [dragState, wiringState.isWiring, width, height, moveComponent]);

  const handleMouseUp = useCallback(() => {
    setDragState({
      isDragging: false,
      componentId: null,
      offsetX: 0,
      offsetY: 0,
    });
  }, []);

  const handleNodeClick = useCallback((nodeId: string) => {
    if (!wiringState.isWiring) {
      const pos = getNodePosition(nodeId);
      if (pos) {
        setWiringState({
          isWiring: true,
          fromNodeId: nodeId,
          mouseX: pos.x,
          mouseY: pos.y,
        });
      }
    } else if (wiringState.fromNodeId && wiringState.fromNodeId !== nodeId) {
      addWire(wiringState.fromNodeId, nodeId);
      setWiringState({
        isWiring: false,
        fromNodeId: null,
        mouseX: 0,
        mouseY: 0,
      });
    } else {
      setWiringState({
        isWiring: false,
        fromNodeId: null,
        mouseX: 0,
        mouseY: 0,
      });
    }
  }, [wiringState, getNodePosition, addWire]);

  const handleCanvasClick = useCallback(() => {
    selectComponent(null);
    selectWire(null);
    highlightError(null);
    setWiringState({
      isWiring: false,
      fromNodeId: null,
      mouseX: 0,
      mouseY: 0,
    });
  }, [selectComponent, selectWire, highlightError]);

  const handleWireClick = useCallback((e: React.MouseEvent, wireId: string) => {
    e.stopPropagation();
    if (e.detail === 2) {
      removeWire(wireId);
    } else {
      selectWire(wireId);
    }
  }, [selectWire, removeWire]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setWiringState({
        isWiring: false,
        fromNodeId: null,
        mouseX: 0,
        mouseY: 0,
      });
      selectComponent(null);
      selectWire(null);
      highlightError(null);
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedComponentId) {
        useGameStore.getState().removeComponent(selectedComponentId);
      }
      if (selectedWireId) {
        removeWire(selectedWireId);
      }
    }
  }, [selectedComponentId, selectedWireId, selectComponent, selectWire, highlightError, removeWire]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const isHighlightedComponent = (compId: string) => {
    if (!highlightedErrorId) return false;
    const incident = incidents.find(i => i.id === highlightedErrorId);
    return incident?.sourceComponentId === compId;
  };

  const isHighlightedWire = (wireId: string) => {
    if (!highlightedErrorId) return false;
    const incident = incidents.find(i => i.id === highlightedErrorId);
    return incident?.sourceWireId === wireId;
  };

  const renderWire = (wire: Wire) => {
    const fromPos = getNodePosition(wire.fromNodeId);
    const toPos = getNodePosition(wire.toNodeId);
    if (!fromPos || !toPos) return null;

    const isSelected = selectedWireId === wire.id;
    const isHighlighted = isHighlightedWire(wire.id);
    const isError = wire.isShort || isHighlighted;
    const isActive = wire.isActive;

    return (
      <g key={wire.id}>
        <path
          d={`M${fromPos.x},${fromPos.y} Q${(fromPos.x + toPos.x) / 2},${(fromPos.y + toPos.y) / 2 - 20} ${toPos.x},${toPos.y}`}
          fill="none"
          stroke="transparent"
          strokeWidth="12"
          onClick={(e) => handleWireClick(e, wire.id)}
          className="cursor-pointer"
        />
        <motion.path
          d={`M${fromPos.x},${fromPos.y} Q${(fromPos.x + toPos.x) / 2},${(fromPos.y + toPos.y) / 2 - 20} ${toPos.x},${toPos.y}`}
          fill="none"
          stroke={isError ? '#EF4444' : isActive ? '#06B6D4' : '#64748B'}
          strokeWidth={isSelected || isHighlighted ? 4 : 2.5}
          strokeLinecap="round"
          onClick={(e) => handleWireClick(e, wire.id)}
          className={`cursor-pointer ${isActive && !isError ? 'animated-flow-line' : ''}`}
          style={{
            filter: isError
              ? 'drop-shadow(0 0 8px #EF4444)'
              : isActive
              ? 'drop-shadow(0 0 6px #06B6D4)'
              : 'none',
          }}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        />
        {isSelected && (
          <path
            d={`M${fromPos.x},${fromPos.y} Q${(fromPos.x + toPos.x) / 2},${(fromPos.y + toPos.y) / 2 - 20} ${toPos.x},${toPos.y}`}
            fill="none"
            stroke="#8B5CF6"
            strokeWidth="6"
            strokeLinecap="round"
            opacity="0.3"
            className="animate-pulse"
          />
        )}
      </g>
    );
  };

  const renderWiringPreview = () => {
    if (!wiringState.isWiring || !wiringState.fromNodeId) return null;

    const fromPos = getNodePosition(wiringState.fromNodeId);
    if (!fromPos) return null;

    return (
      <motion.line
        x1={fromPos.x}
        y1={fromPos.y}
        x2={wiringState.mouseX}
        y2={wiringState.mouseY}
        stroke="#8B5CF6"
        strokeWidth="2"
        strokeDasharray="8,4"
        opacity="0.8"
        style={{ pointerEvents: 'none' }}
      />
    );
  };

  const renderGrid = () => {
    const lines = [];
    const gridSize = 20;

    for (let x = 0; x <= width; x += gridSize) {
      lines.push(
        <line
          key={`v-${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={height}
          stroke="rgba(139, 92, 246, 0.1)"
          strokeWidth="1"
        />
      );
    }

    for (let y = 0; y <= height; y += gridSize) {
      lines.push(
        <line
          key={`h-${y}`}
          x1={0}
          y1={y}
          x2={width}
          y2={y}
          stroke="rgba(139, 92, 246, 0.1)"
          strokeWidth="1"
        />
      );
    }

    return <g>{lines}</g>;
  };

  return (
    <div className="relative w-full h-full overflow-hidden rounded-xl border border-neon-purple/30 bg-neon-bg">
      <AnimatePresence>
        {wiringState.isWiring && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10"
          >
            <div className="glass-card px-4 py-2 text-sm text-neon-cyan">
              点击另一个节点完成连线，按 ESC 取消
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="circuit-grid-bg"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCanvasClick}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {renderGrid()}

        <g className="wires-layer">
          {circuit.wires.map(renderWire)}
        </g>

        {renderWiringPreview()}

        <g className="components-layer">
          {circuit.components.map(component => (
            <CircuitComponent
              key={component.id}
              component={component}
              isSelected={selectedComponentId === component.id}
              isHighlighted={isHighlightedComponent(component.id)}
              onSelect={selectComponent}
              onNodeClick={handleNodeClick}
              onDragStart={handleDragStart}
              onToggle={toggleSwitch}
            />
          ))}
        </g>
      </svg>

      <div className="absolute bottom-4 right-4 text-xs text-neon-silver/60">
        <div>拖拽移动元件 | 点击节点连线 | 双击删除导线 | Delete删除选中</div>
      </div>
    </div>
  );
}
