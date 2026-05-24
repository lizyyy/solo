import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { Train, Signal, Section, SIGNAL_ASPECTS, TRAIN_STATUSES, Point } from '../types/game';

interface GameCanvasProps {
  width: number;
  height: number;
}

const getTrainPosition = (train: Train, sections: Section[]): Point | null => {
  if (train.currentSectionIndex < 0 || train.currentSectionIndex >= train.route.length) {
    return null;
  }

  const sectionId = train.route[train.currentSectionIndex];
  const section = sections.find(s => s.id === sectionId);
  if (!section) return null;

  const x = section.fromPos.x + (section.toPos.x - section.fromPos.x) * train.progress;
  const y = section.fromPos.y + (section.toPos.y - section.fromPos.y) * train.progress;

  return { x, y };
};

const getSignalColor = (aspect: string): string => {
  switch (aspect) {
    case SIGNAL_ASPECTS.RED:
      return '#dc2626';
    case SIGNAL_ASPECTS.YELLOW:
      return '#eab308';
    case SIGNAL_ASPECTS.GREEN:
      return '#16a34a';
    default:
      return '#6b7280';
  }
};

export default function GameCanvas({ width, height }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { level, trains, signals, sections, time, toggleSignal, status } = useGameStore();
  const hoveredSignalRef = useRef<string | null>(null);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (status === 'lost' || status === 'won') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    for (const signal of signals) {
      const dx = x - signal.position.x;
      const dy = y - signal.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 20) {
        toggleSignal(signal.id);
        return;
      }
    }
  }, [signals, toggleSignal, status]);

  const handleCanvasMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    let found = false;
    for (const signal of signals) {
      const dx = x - signal.position.x;
      const dy = y - signal.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 20) {
        hoveredSignalRef.current = signal.id;
        found = true;
        canvas.style.cursor = 'pointer';
        break;
      }
    }
    
    if (!found) {
      hoveredSignalRef.current = null;
      canvas.style.cursor = 'default';
    }
  }, [signals]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !level) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    for (const section of sections) {
      const inMaintenance = section.maintenance.some(
        w => time >= w.start && time <= w.end
      );

      ctx.strokeStyle = inMaintenance ? '#ef4444' : '#475569';
      ctx.lineWidth = inMaintenance ? 12 : 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(section.fromPos.x, section.fromPos.y);
      ctx.lineTo(section.toPos.x, section.toPos.y);
      ctx.stroke();

      ctx.strokeStyle = inMaintenance ? '#fca5a5' : '#64748b';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(section.fromPos.x, section.fromPos.y);
      ctx.lineTo(section.toPos.x, section.toPos.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const midX = (section.fromPos.x + section.toPos.x) / 2;
      const midY = (section.fromPos.y + section.toPos.y) / 2;
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.fillText(section.name, midX, midY - 15);
    }

    for (const station of level.stations) {
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(station.position.x, station.position.y, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f1f5f9';
      ctx.font = 'bold 14px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(station.id, station.position.x, station.position.y);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px system-ui';
      ctx.fillText(station.name, station.position.x, station.position.y + 30);
    }

    for (const signal of signals) {
      const isHovered = hoveredSignalRef.current === signal.id;
      
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = isHovered ? '#f1f5f9' : '#475569';
      ctx.lineWidth = isHovered ? 3 : 2;
      ctx.beginPath();
      ctx.arc(signal.position.x, signal.position.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const gradient = ctx.createRadialGradient(
        signal.position.x, signal.position.y, 0,
        signal.position.x, signal.position.y, 10
      );
      gradient.addColorStop(0, getSignalColor(signal.aspect));
      gradient.addColorStop(1, getSignalColor(signal.aspect) + '80');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(signal.position.x, signal.position.y, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowColor = getSignalColor(signal.aspect);
      ctx.shadowBlur = isHovered ? 15 : 8;
      ctx.fillStyle = getSignalColor(signal.aspect);
      ctx.beginPath();
      ctx.arc(signal.position.x, signal.position.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    for (const train of trains) {
      if (train.status === TRAIN_STATUSES.WAITING) {
        const firstSectionId = train.route[0];
        const firstSection = sections.find(s => s.id === firstSectionId);
        if (firstSection) {
          const isDirectionForward = train.progress < 0.5;
          const startPos = isDirectionForward ? firstSection.fromPos : firstSection.toPos;
          
          ctx.fillStyle = train.color + '60';
          ctx.strokeStyle = train.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(startPos.x, startPos.y, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#f1f5f9';
          ctx.font = 'bold 10px JetBrains Mono';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(train.name, startPos.x, startPos.y);
        }
        continue;
      }

      if (train.status === TRAIN_STATUSES.COMPLETED) {
        continue;
      }

      const pos = getTrainPosition(train, sections);
      if (!pos) continue;

      const angle = Math.atan2(
        (sections.find(s => s.id === train.route[train.currentSectionIndex])?.toPos.y || 0) -
        (sections.find(s => s.id === train.route[train.currentSectionIndex])?.fromPos.y || 0),
        (sections.find(s => s.id === train.route[train.currentSectionIndex])?.toPos.x || 0) -
        (sections.find(s => s.id === train.route[train.currentSectionIndex])?.fromPos.x || 0)
      );

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(train.progress > 0.5 ? angle + Math.PI : angle);

      ctx.fillStyle = train.color;
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-20, -8, 40, 16, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(15, -6, 6, 12);

      ctx.fillStyle = '#f1f5f9';
      ctx.font = 'bold 9px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(train.name, 0, 0);

      ctx.restore();

      if (train.delay > 0) {
        ctx.fillStyle = train.delay > 100 ? '#ef4444' : '#f59e0b';
        ctx.font = '10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`+${Math.floor(train.delay)}`, pos.x, pos.y - 20);
      }
    }

  }, [level, trains, signals, sections, time, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onClick={handleCanvasClick}
      onMouseMove={handleCanvasMove}
      className="rounded-lg shadow-2xl"
      style={{ maxWidth: '100%', height: 'auto' }}
    />
  );
}
