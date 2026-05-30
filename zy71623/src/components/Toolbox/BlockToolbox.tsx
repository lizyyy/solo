import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { PolygonBlock } from '../../types';

interface BlockCardProps {
  block: PolygonBlock;
  onDragStart: (e: React.DragEvent, blockId: string) => void;
}

const BlockCard: React.FC<BlockCardProps> = ({ block, onDragStart }) => {
  const bbox = getPolygonBoundingBox(block.vertices);
  const scale = Math.min(60 / bbox.width, 50 / bbox.height);
  const offsetX = -bbox.minX * scale + (60 - bbox.width * scale) / 2;
  const offsetY = -bbox.minY * scale + (50 - bbox.height * scale) / 2;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, block.id)}
      className="bg-slate-800/80 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:bg-slate-700/80 transition-all duration-200 border border-slate-700 hover:border-accent-500/50 group"
    >
      <svg width="60" height="50" className="mx-auto mb-2">
        <polygon
          points={block.vertices.map(v => `${v.x * scale + offsetX},${v.y * scale + offsetY}`).join(' ')}
          fill={block.color}
          stroke="#1e293b"
          strokeWidth="2"
          className="group-hover:scale-105 transition-transform duration-200"
          style={{ transformOrigin: 'center' }}
        />
      </svg>
      <p className="text-xs text-center text-slate-300 font-medium">{block.name}</p>
      <div className="flex justify-between mt-1 text-xs text-slate-500">
        <span>📐 {block.area.toFixed(0)}</span>
        <span>💪 {block.strength}</span>
      </div>
    </div>
  );
};

function getPolygonBoundingBox(vertices: { x: number; y: number }[]) {
  const xs = vertices.map(v => v.x);
  const ys = vertices.map(v => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

const BlockToolbox: React.FC = () => {
  const { currentLevel, isSimulating } = useGameStore();

  const handleDragStart = (e: React.DragEvent, blockId: string) => {
    e.dataTransfer.setData('blockId', blockId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  if (!currentLevel) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-4 h-full">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <span>🧱</span> 多边形工具箱
        </h3>
        <p className="text-slate-500 text-sm">请先选择关卡</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 h-full flex flex-col">
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
        <span>🧱</span> 多边形工具箱
      </h3>
      <div className="text-xs text-slate-400 mb-3">
        拖拽多边形到画布上
      </div>
      <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1 pr-1">
        {currentLevel.availableBlocks.map(block => (
          <BlockCard
            key={block.id}
            block={block}
            onDragStart={handleDragStart}
          />
        ))}
      </div>
      {isSimulating && (
        <div className="mt-3 p-2 bg-accent-500/20 rounded-lg text-xs text-accent-400 text-center">
          ⏳ 模拟进行中...
        </div>
      )}
    </div>
  );
};

export default BlockToolbox;
