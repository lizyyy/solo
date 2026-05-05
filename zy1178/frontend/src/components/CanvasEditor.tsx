import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button, Space, InputNumber, Form, Modal, Input, message, Checkbox } from 'antd';
import {
  PlusOutlined,
  UndoOutlined,
  ClearOutlined,
  SaveOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { Point, Layout } from '../types';

interface CanvasEditorProps {
  mode: 'roof' | 'obstacle' | 'layout';
  existingPolygons?: Point[][];
  existingLayouts?: Layout[];
  panel?: { width: number; height: number; power: number } | null;
  onSave?: (coordinates: Point[], area: number) => void;
  onSaveLayout?: (positions: Array<{ x: number; y: number }>, values: { name: string; is_active: boolean }) => void;
}

const CanvasEditor: React.FC<CanvasEditorProps> = ({
  mode,
  existingPolygons = [],
  existingLayouts = [],
  panel,
  onSave,
  onSaveLayout,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPolygon, setCurrentPolygon] = useState<Point[]>([]);
  const [scale, setScale] = useState(30);
  const [offset, setOffset] = useState({ x: 50, y: 50 });
  const [obstacleHeight, setObstacleHeight] = useState(3);
  const [selectedLayout, setSelectedLayout] = useState<number | null>(null);
  const [panelPositions, setPanelPositions] = useState<Array<{ x: number; y: number }>>([]);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [form] = Form.useForm();

  const canvasWidth = 600;
  const canvasHeight = 400;

  const toCanvas = useCallback(
    (x: number, y: number) => ({
      x: offset.x + x * scale,
      y: offset.y + y * scale,
    }),
    [scale, offset]
  );

  const toWorld = useCallback(
    (x: number, y: number) => ({
      x: (x - offset.x) / scale,
      y: (y - offset.y) / scale,
    }),
    [scale, offset]
  );

  const getCanvasEventPoint = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return toWorld(e.clientX - rect.left, e.clientY - rect.top);
    },
    [toWorld]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < canvasWidth; x += scale) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    }
    for (let y = 0; y < canvasHeight; y += scale) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }

    if (mode === 'roof') {
      existingPolygons.forEach((polygon, index) => {
        if (polygon.length < 3) return;
        const first = toCanvas(polygon[0].x, polygon[0].y);
        ctx.beginPath();
        ctx.moveTo(first.x, first.y);
        polygon.forEach((p, i) => {
          if (i > 0) {
            const pt = toCanvas(p.x, p.y);
            ctx.lineTo(pt.x, pt.y);
          }
        });
        ctx.closePath();
        ctx.fillStyle = 'rgba(24, 144, 255, 0.2)';
        ctx.fill();
        ctx.strokeStyle = '#1890ff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#1890ff';
        polygon.forEach((p) => {
          const pt = toCanvas(p.x, p.y);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      });
    } else if (mode === 'obstacle') {
      existingPolygons.forEach((polygon, index) => {
        if (polygon.length < 3) return;
        const first = toCanvas(polygon[0].x, polygon[0].y);
        ctx.beginPath();
        ctx.moveTo(first.x, first.y);
        polygon.forEach((p, i) => {
          if (i > 0) {
            const pt = toCanvas(p.x, p.y);
            ctx.lineTo(pt.x, pt.y);
          }
        });
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 77, 79, 0.3)';
        ctx.fill();
        ctx.strokeStyle = '#ff4d4f';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#ff4d4f';
        polygon.forEach((p) => {
          const pt = toCanvas(p.x, p.y);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      });
    } else if (mode === 'layout') {
      if (existingPolygons.length > 0) {
        existingPolygons.forEach((polygon) => {
          if (polygon.length < 3) return;
          const first = toCanvas(polygon[0].x, polygon[0].y);
          ctx.beginPath();
          ctx.moveTo(first.x, first.y);
          polygon.forEach((p, i) => {
            if (i > 0) {
              const pt = toCanvas(p.x, p.y);
              ctx.lineTo(pt.x, pt.y);
            }
          });
          ctx.closePath();
          ctx.fillStyle = 'rgba(24, 144, 255, 0.1)';
          ctx.fill();
          ctx.strokeStyle = '#1890ff';
          ctx.lineWidth = 2;
          ctx.stroke();
        });
      }

      panelPositions.forEach((pos, index) => {
        if (panel) {
          const topLeft = toCanvas(pos.x, pos.y);
          const bottomRight = toCanvas(pos.x + panel.width, pos.y + panel.height);

          ctx.fillStyle = 'rgba(82, 196, 26, 0.5)';
          ctx.strokeStyle = '#52c41a';
          ctx.lineWidth = 1;
          ctx.fillRect(
            topLeft.x,
            topLeft.y,
            bottomRight.x - topLeft.x,
            bottomRight.y - topLeft.y
          );
          ctx.strokeRect(
            topLeft.x,
            topLeft.y,
            bottomRight.x - topLeft.x,
            bottomRight.y - topLeft.y
          );

          const centerX = (topLeft.x + bottomRight.x) / 2;
          const centerY = (topLeft.y + bottomRight.y) / 2;
          ctx.fillStyle = '#fff';
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${index + 1}`, centerX, centerY);
        }
      });
    }

    if (currentPolygon.length > 0) {
      const first = toCanvas(currentPolygon[0].x, currentPolygon[0].y);
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      currentPolygon.forEach((p, i) => {
        if (i > 0) {
          const pt = toCanvas(p.x, p.y);
          ctx.lineTo(pt.x, pt.y);
        }
      });
      ctx.strokeStyle = '#faad14';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      currentPolygon.forEach((p) => {
        const pt = toCanvas(p.x, p.y);
        ctx.fillStyle = '#faad14';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }, [currentPolygon, existingPolygons, panelPositions, panel, toCanvas, mode, scale, offset]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode === 'layout') {
      if (!panel) {
        message.warning('请先设置组件参数');
        return;
      }
      const pt = getCanvasEventPoint(e);
      if (!pt) return;
      setPanelPositions((prev) => [...prev, { x: Math.round(pt.x * 10) / 10, y: Math.round(pt.y * 10) / 10 }]);
      return;
    }

    const pt = getCanvasEventPoint(e);
    if (!pt) return;

    if (currentPolygon.length > 0) {
      const first = currentPolygon[0];
      const dist = Math.sqrt((pt.x - first.x) ** 2 + (pt.y - first.y) ** 2);
      if (dist < 0.3 && currentPolygon.length >= 3) {
        if (mode === 'roof') {
          const area = calculatePolygonArea(currentPolygon);
          if (onSave) {
            onSave(currentPolygon, area);
          }
          setCurrentPolygon([]);
          return;
        } else if (mode === 'obstacle') {
          const area = calculatePolygonArea(currentPolygon);
          if (onSave) {
            onSave(currentPolygon, area);
          }
          setCurrentPolygon([]);
          return;
        }
      }
    }

    setCurrentPolygon((prev) => [...prev, { x: Math.round(pt.x * 10) / 10, y: Math.round(pt.y * 10) / 10 }]);
  };

  const calculatePolygonArea = (points: Point[]): number => {
    if (points.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.abs(area / 2);
  };

  const handleClear = () => {
    setCurrentPolygon([]);
    setPanelPositions([]);
  };

  const handleUndo = () => {
    if (mode === 'layout') {
      setPanelPositions((prev) => prev.slice(0, -1));
    } else {
      setCurrentPolygon((prev) => prev.slice(0, -1));
    }
  };

  const handleSaveLayout = (values: { name: string; is_active: boolean }) => {
    if (panelPositions.length === 0) {
      message.warning('请先在画布上放置组件');
      return;
    }
    if (onSaveLayout) {
      onSaveLayout(panelPositions, values);
    }
    setIsSaveModalOpen(false);
    setPanelPositions([]);
  };

  const getModeLabel = () => {
    switch (mode) {
      case 'roof':
        return '屋顶轮廓';
      case 'obstacle':
        return '障碍物';
      case 'layout':
        return '组件排布';
      default:
        return '';
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          {mode === 'obstacle' && (
            <>
              <span>高度 (m):</span>
              <InputNumber
                min={0.1}
                step={0.5}
                value={obstacleHeight}
                onChange={(val) => setObstacleHeight(val || 3)}
              />
            </>
          )}
          {mode === 'layout' && (
            <Space>
              <Button icon={<PlusOutlined />} onClick={() => setIsSaveModalOpen(true)}>
                保存方案
              </Button>
              <Button icon={<UndoOutlined />} onClick={handleUndo} disabled={panelPositions.length === 0}>
                撤销
              </Button>
              <Button icon={<ClearOutlined />} onClick={handleClear} disabled={panelPositions.length === 0}>
                清除
              </Button>
              <span style={{ marginLeft: 16 }}>已放置: {panelPositions.length} 块组件</span>
            </Space>
          )}
          {(mode === 'roof' || mode === 'obstacle') && (
            <Space>
              <Button icon={<UndoOutlined />} onClick={handleUndo} disabled={currentPolygon.length === 0}>
                撤销
              </Button>
              <Button icon={<ClearOutlined />} onClick={handleClear} disabled={currentPolygon.length === 0}>
                清除
              </Button>
              <span style={{ marginLeft: 16 }}>
                点击画布添加顶点，点击第一个顶点闭合多边形
              </span>
            </Space>
          )}
        </Space>
      </div>

      <div className="canvas-container" style={{ width: canvasWidth, height: canvasHeight }}>
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          onClick={handleCanvasClick}
        />
        <div className="canvas-info">
          缩放: 1m = {scale}px | 点击画布绘制{getModeLabel()}
          {mode === 'layout' && panel && (
            <span style={{ marginLeft: 16 }}>
              组件尺寸: {panel.width}m x {panel.height}m
            </span>
          )}
        </div>
      </div>

      {mode === 'layout' && (
        <Modal
          title="保存排布方案"
          open={isSaveModalOpen}
          onCancel={() => setIsSaveModalOpen(false)}
          onOk={() => form.submit()}
        >
          <Form form={form} layout="vertical" onFinish={handleSaveLayout}>
            <Form.Item
              name="name"
              label="方案名称"
              rules={[{ required: true, message: '请输入方案名称' }]}
              initialValue={`方案 ${existingLayouts.length + 1}`}
            >
              <Input />
            </Form.Item>
            <Form.Item name="is_active" label="设为当前方案" valuePropName="checked" initialValue={false}>
              <Checkbox>设为当前方案</Checkbox>
            </Form.Item>
            <Form.Item>
              <div>已放置 {panelPositions.length} 块组件</div>
            </Form.Item>
          </Form>
        </Modal>
      )}
    </div>
  );
};

export default CanvasEditor;
