import React from 'react';
import { HoldShape, HoldSize } from '../types';
import { HOLD_SHAPES, HOLD_SIZES, SHAPE_NAMES, SIZE_NAMES, ROUTE_COLORS } from '../data/sampleData';

interface HoldLibraryProps {
  onDragStart: (shape: HoldShape, size: HoldSize) => void;
}

export function HoldLibrary({ onDragStart }: HoldLibraryProps) {
  return (
    <div className="panel-section">
      <h3 className="panel-title">岩点库</h3>
      
      <div className="tab-header">
        <button className="tab-btn active">形状</button>
      </div>

      <div className="hold-library">
        {HOLD_SHAPES.map((shape) => (
          <HoldLibraryItem
            key={shape}
            shape={shape}
            size="medium"
            color={ROUTE_COLORS[3]}
            onDragStart={onDragStart}
          />
        ))}
      </div>

      <div className="divider" />

      <div className="form-group">
        <label className="form-label">默认尺寸</label>
        <div className="flex gap-2">
          {HOLD_SIZES.map((size) => (
            <button
              key={size}
              className="btn btn-secondary btn-sm"
              onClick={() => {}}
            >
              {SIZE_NAMES[size]}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <h4 className="form-label" style={{ marginBottom: '8px' }}>岩点说明</h4>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          <p><strong>大岩点 (Jug):</strong> 最容易抓握，适合新手</p>
          <p><strong>条型点 (Edge):</strong> 需要指力，中等难度</p>
          <p><strong>孔洞点 (Pocket):</strong> 只能放1-2根手指</p>
          <p><strong>小抠点 (Crimp):</strong> 最难抓握，指力要求高</p>
          <p><strong>大斜面 (Sloper):</strong> 需要腕力和核心力量</p>
        </div>
      </div>
    </div>
  );
}

interface HoldLibraryItemProps {
  shape: HoldShape;
  size: HoldSize;
  color: string;
  onDragStart: (shape: HoldShape, size: HoldSize) => void;
}

function HoldLibraryItem({ shape, size, color, onDragStart }: HoldLibraryItemProps) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('holdShape', shape);
    e.dataTransfer.setData('holdSize', size);
    onDragStart(shape, size);
  };

  return (
    <div
      className="hold-item"
      draggable
      onDragStart={handleDragStart}
      title={`${SHAPE_NAMES[shape]} - 拖拽到墙面`}
    >
      <div
        className={`hold-shape ${shape}`}
        style={{ backgroundColor: color }}
      />
    </div>
  );
}
