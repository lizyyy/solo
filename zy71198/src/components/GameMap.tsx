import { useRef, useEffect, useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import { Node, Edge, Vehicle, StreetLamp } from '@/types/game';
import { findPath } from '@/utils/pathfinding';

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 500;

const COLORS = {
  background: '#0a1628',
  road: '#1e3a5f',
  roadHover: '#2d5a8a',
  depot: '#ffb347',
  lampNormal: '#ffb347',
  lampBroken: '#ff4757',
  lampAssigned: '#ffa502',
  lampRepairing: '#70a1ff',
  lampRepaired: '#2ed573',
  lampTimeout: '#57606f',
  lampHover: '#ffffff',
  vehicleIdle: '#7bed9f',
  vehicleMoving: '#70a1ff',
  vehicleRepairing: '#ffa502',
  node: '#2f3640',
  pathPreview: '#70a1ff',
};

export default function GameMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    nodes,
    edges,
    vehicles,
    lamps,
    depotNodeId,
    selectedVehicleId,
    selectedLampId,
    hoveredLampId,
    selectVehicle,
    selectLamp,
    setHoveredLamp,
    dispatchVehicle,
  } = useGameStore();

  const getVehicleColor = (status: Vehicle['status']) => {
    switch (status) {
      case 'idle':
        return COLORS.vehicleIdle;
      case 'moving':
        return COLORS.vehicleMoving;
      case 'repairing':
        return COLORS.vehicleRepairing;
      default:
        return COLORS.vehicleIdle;
    }
  };

  const getLampColor = (status: StreetLamp['status']) => {
    switch (status) {
      case 'normal':
        return COLORS.lampNormal;
      case 'broken':
        return COLORS.lampBroken;
      case 'assigned':
        return COLORS.lampAssigned;
      case 'repairing':
        return COLORS.lampRepairing;
      case 'repaired':
        return COLORS.lampRepaired;
      case 'timeout':
        return COLORS.lampTimeout;
      default:
        return COLORS.lampNormal;
    }
  };

  const getPriorityGlow = (priority: StreetLamp['priority']) => {
    switch (priority) {
      case 'critical':
        return 15;
      case 'high':
        return 10;
      case 'normal':
        return 6;
      default:
        return 3;
    }
  };

  const drawMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.strokeStyle = COLORS.road;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    edges.forEach((edge) => {
      const fromNode = nodes.find((n) => n.id === edge.from);
      const toNode = nodes.find((n) => n.id === edge.to);
      if (fromNode && toNode) {
        ctx.beginPath();
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toNode.x, toNode.y);
        ctx.stroke();
      }
    });

    if (selectedVehicleId && selectedLampId) {
      const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
      const lamp = lamps.find((l) => l.id === selectedLampId);
      if (vehicle && lamp && vehicle.status === 'idle') {
        const pathResult = findPath(nodes, edges, vehicle.currentNodeId, lamp.nodeId);
        if (pathResult) {
          ctx.strokeStyle = COLORS.pathPreview;
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 8]);
          ctx.beginPath();
          const startNode = nodes.find((n) => n.id === pathResult.path[0]);
          if (startNode) {
            ctx.moveTo(startNode.x, startNode.y);
            for (let i = 1; i < pathResult.path.length; i++) {
              const node = nodes.find((n) => n.id === pathResult.path[i]);
              if (node) ctx.lineTo(node.x, node.y);
            }
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    nodes.forEach((node) => {
      if (node.type === 'intersection') {
        ctx.fillStyle = COLORS.node;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    const depotNode = nodes.find((n) => n.id === depotNodeId);
    if (depotNode) {
      ctx.shadowColor = COLORS.depot;
      ctx.shadowBlur = 20;
      ctx.fillStyle = COLORS.depot;
      ctx.beginPath();
      ctx.arc(depotNode.x, depotNode.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#0a1628';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('D', depotNode.x, depotNode.y);
    }

    lamps.forEach((lamp) => {
      const color = getLampColor(lamp.status);
      const isSelected = selectedLampId === lamp.id;
      const isHovered = hoveredLampId === lamp.id;
      const glowSize = isSelected || isHovered ? 20 : getPriorityGlow(lamp.priority);

      if (lamp.status === 'broken' || lamp.status === 'assigned') {
        ctx.shadowColor = color;
        ctx.shadowBlur = glowSize;
      }

      ctx.fillStyle = isHovered ? COLORS.lampHover : color;
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, isSelected ? 10 : 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (isSelected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(lamp.x, lamp.y, 14, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (lamp.status === 'broken' || lamp.status === 'assigned') {
        const timeRatio = lamp.timeRemaining / lamp.maxTime;
        const barWidth = 24;
        const barHeight = 3;
        const barX = lamp.x - barWidth / 2;
        const barY = lamp.y - 16;

        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        ctx.fillStyle = timeRatio > 0.5 ? '#2ed573' : timeRatio > 0.25 ? '#ffa502' : '#ff4757';
        ctx.fillRect(barX, barY, barWidth * timeRatio, barHeight);
      }
    });

    vehicles.forEach((vehicle) => {
      const currentNode = nodes.find((n) => n.id === vehicle.currentNodeId);
      if (!currentNode) return;

      let drawX = currentNode.x;
      let drawY = currentNode.y;

      if (vehicle.status === 'moving' && vehicle.path.length > 1) {
        const nextNodeId = vehicle.path[Math.min(vehicle.pathIndex + 1, vehicle.path.length - 1)];
        const nextNode = nodes.find((n) => n.id === nextNodeId);
        if (nextNode) {
          const totalDist = Math.sqrt(
            (nextNode.x - currentNode.x) ** 2 + (nextNode.y - currentNode.y) ** 2
          );
          const progressRatio = totalDist > 0 ? vehicle.progress / totalDist : 0;
          drawX = currentNode.x + (nextNode.x - currentNode.x) * Math.min(progressRatio, 1);
          drawY = currentNode.y + (nextNode.y - currentNode.y) * Math.min(progressRatio, 1);
        }
      }

      const isSelected = selectedVehicleId === vehicle.id;
      const vColor = getVehicleColor(vehicle.status);

      ctx.shadowColor = vColor;
      ctx.shadowBlur = isSelected ? 15 : 8;
      ctx.fillStyle = vColor;

      ctx.beginPath();
      ctx.moveTo(drawX, drawY - 8);
      ctx.lineTo(drawX + 6, drawY + 6);
      ctx.lineTo(drawX - 6, drawY + 6);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      if (isSelected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(drawX, drawY - 10);
        ctx.lineTo(drawX + 8, drawY + 8);
        ctx.lineTo(drawX - 8, drawY + 8);
        ctx.closePath();
        ctx.stroke();
      }

      if (vehicle.status === 'repairing') {
        ctx.strokeStyle = '#ffa502';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(drawX, drawY, 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(vehicle.name.slice(-1), drawX, drawY + 20);
    });
  }, [nodes, edges, vehicles, lamps, depotNodeId, selectedVehicleId, selectedLampId, hoveredLampId]);

  useEffect(() => {
    drawMap();
  }, [drawMap]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    for (const lamp of lamps) {
      const dist = Math.sqrt((x - lamp.x) ** 2 + (y - lamp.y) ** 2);
      if (dist < 15) {
        if (selectedVehicleId && lamp.status === 'broken') {
          dispatchVehicle(selectedVehicleId, lamp.id);
          selectVehicle(null);
          selectLamp(null);
        } else {
          selectLamp(lamp.id === selectedLampId ? null : lamp.id);
        }
        return;
      }
    }

    for (const vehicle of vehicles) {
      const node = nodes.find((n) => n.id === vehicle.currentNodeId);
      if (node) {
        const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
        if (dist < 15) {
          selectVehicle(vehicle.id === selectedVehicleId ? null : vehicle.id);
          selectLamp(null);
          return;
        }
      }
    }

    selectVehicle(null);
    selectLamp(null);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    let foundLamp: string | null = null;
    for (const lamp of lamps) {
      const dist = Math.sqrt((x - lamp.x) ** 2 + (y - lamp.y) ** 2);
      if (dist < 15) {
        foundLamp = lamp.id;
        break;
      }
    }
    setHoveredLamp(foundLamp);
  };

  return (
    <div className="relative rounded-lg overflow-hidden border border-slate-700/50">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={() => setHoveredLamp(null)}
        className="w-full h-auto cursor-pointer"
        style={{ imageRendering: 'auto' }}
      />
    </div>
  );
}
