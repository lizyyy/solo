import { useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { STATUS_COLORS, Device, CadPoint } from '@/types';

export function SceneCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const { devices, cadPoints, setView, setSelectedDevice, currentFloor, selectedDeviceId, zoom, rotation, panX, panY } = useAppStore((state) => ({
    devices: state.devices,
    cadPoints: state.cadPoints,
    setView: state.setView,
    setSelectedDevice: state.setSelectedDevice,
    currentFloor: state.view.currentFloor,
    selectedDeviceId: state.view.selectedDeviceId,
    zoom: state.view.zoom,
    rotation: state.view.rotation,
    panX: state.view.panX,
    panY: state.view.panY,
  }));

  const filteredDevices = devices.filter(d => d.floor === currentFloor);
  const filteredCadPoints = cadPoints.filter(c => c.floor === currentFloor);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(centerX + panX, centerY + panY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    drawGrid(ctx);
    filteredCadPoints.forEach(cad => drawCadPoint(ctx, cad));
    filteredDevices.forEach(device => drawDevice(ctx, device, device.id === selectedDeviceId));

    ctx.restore();
  }, [filteredDevices, filteredCadPoints, zoom, rotation, panX, panY, selectedDeviceId]);

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    const gridSize = 50;
    const range = 1000;

    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1 / zoom;

    for (let x = -range; x <= range; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, -range);
      ctx.lineTo(x, range);
      ctx.stroke();
    }

    for (let y = -range; y <= range; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(-range, y);
      ctx.lineTo(range, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.moveTo(-range, 0);
    ctx.lineTo(range, 0);
    ctx.moveTo(0, -range);
    ctx.lineTo(0, range);
    ctx.stroke();
  };

  const drawCadPoint = (ctx: CanvasRenderingContext2D, cad: CadPoint) => {
    const isSystemB = cad.coordSystem === 'B';
    
    ctx.save();
    ctx.translate(cad.x, cad.y);

    if (isSystemB) {
      ctx.setLineDash([4 / zoom, 4 / zoom]);
    }

    ctx.fillStyle = '#475569';
    ctx.strokeStyle = isSystemB ? '#9333EA' : '#64748B';
    ctx.lineWidth = 2 / zoom;

    ctx.beginPath();
    ctx.arc(0, 0, 12 / zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.setLineDash([]);

    ctx.fillStyle = '#94A3B8';
    ctx.font = `${10 / zoom}px JetBrains Mono, monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(cad.newName || cad.oldName || cad.id, 0, 25 / zoom);

    ctx.restore();
  };

  const drawDevice = (ctx: CanvasRenderingContext2D, device: Device, isSelected: boolean) => {
    const color = STATUS_COLORS[device.status];
    const isSystemB = device.coordSystem === 'B';

    ctx.save();
    ctx.translate(device.x, device.y);

    if (isSystemB) {
      ctx.setLineDash([6 / zoom, 4 / zoom]);
    }

    ctx.fillStyle = color;
    ctx.strokeStyle = isSystemB ? '#9333EA' : color;
    ctx.lineWidth = isSelected ? 3 / zoom : 2 / zoom;

    const size = (isSelected ? 18 : 14) / zoom;

    if (device.type === 'camera') {
      ctx.beginPath();
      ctx.moveTo(-size, -size * 0.8);
      ctx.lineTo(size * 1.2, 0);
      ctx.lineTo(-size, size * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (device.type === 'sensor') {
      ctx.beginPath();
      ctx.rect(-size, -size, size * 2, size * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size, size);
      ctx.lineTo(-size, size);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.setLineDash([]);

    if (isSelected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      ctx.arc(0, 0, (size + 8) / zoom, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = '#F1F5F9';
    ctx.font = `${11 / zoom}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(device.name, 0, -25 / zoom);

    if (device.score !== undefined) {
      ctx.fillStyle = '#94A3B8';
      ctx.font = `${9 / zoom}px JetBrains Mono, monospace`;
      ctx.fillText(`${device.score}分`, 0, 35 / zoom);
    }

    ctx.restore();
  };

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setView({ zoom: Math.max(0.2, Math.min(5, zoom * delta)) });
  }, [zoom, setView]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;

    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };

    setView({
      panX: panX + dx,
      panY: panY + dy,
    });
  }, [panX, panY, setView]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleClick = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const centerX = canvas.width / 2 + panX;
    const centerY = canvas.height / 2 + panY;
    const angle = -(rotation * Math.PI) / 180;

    const relX = (clickX - centerX) / zoom;
    const relY = (clickY - centerY) / zoom;

    const worldX = relX * Math.cos(angle) - relY * Math.sin(angle);
    const worldY = relX * Math.sin(angle) + relY * Math.cos(angle);

    const clickedDevice = filteredDevices.find(d => {
      const dx = d.x - worldX;
      const dy = d.y - worldY;
      return Math.sqrt(dx * dx + dy * dy) < 20 / zoom;
    });

    setSelectedDevice(clickedDevice?.id || null);
  }, [filteredDevices, zoom, rotation, panX, panY, setSelectedDevice]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      draw();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => window.removeEventListener('resize', resizeCanvas);
  }, [draw]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('click', handleClick);

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('click', handleClick);
    };
  }, [handleWheel, handleMouseDown, handleMouseMove, handleMouseUp, handleClick]);

  return (
    <div ref={containerRef} className="w-full h-full canvas-container">
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
