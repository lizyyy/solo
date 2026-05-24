import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { MapNode, Road, Vehicle } from '../../types';

interface GameMapProps {
  width?: number;
  height?: number;
}

export const GameMap = ({ width = 800, height = 500 }: GameMapProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    nodes,
    roads,
    vehicles,
    selectedVehicle,
    selectedRoute,
    addToRoute,
    selectedVehicle: selectedVehicleId,
  } = useGameStore();

  const getVehiclePosition = useCallback(
    (vehicle: Vehicle): { x: number; y: number } => {
      const currentNode = nodes.find((n) => n.id === vehicle.currentNode);
      const nextNodeId = vehicle.targetNodes[0];
      const nextNode = nodes.find((n) => n.id === nextNodeId);

      if (!currentNode) return { x: 0, y: 0 };
      if (!nextNode || vehicle.progress >= 1) {
        return { x: currentNode.x, y: currentNode.y };
      }

      const x = currentNode.x + (nextNode.x - currentNode.x) * vehicle.progress;
      const y = currentNode.y + (nextNode.y - currentNode.y) * vehicle.progress;
      return { x, y };
    },
    [nodes]
  );

  const getNodeColor = (node: MapNode, isInRoute: boolean): string => {
    if (node.type === 'warehouse') return '#3498db';
    if (node.type === 'shelter') {
      if (isInRoute) return '#9b59b6';
      const demand = node.demand;
      const received = node.received;
      if (demand && received) {
        const allMet =
          received.water >= demand.water &&
          received.medicine >= demand.medicine &&
          received.tent >= demand.tent;
        if (allMet) return '#27ae60';
      }
      return '#e67e22';
    }
    return '#7f8c8d';
  };

  const getRoadColor = (road: Road, isInRoute: boolean): string => {
    if (isInRoute) return '#9b59b6';
    if (road.status === 'blocked') return '#c0392b';
    if (road.status === 'congested') return '#f39c12';
    return '#27ae60';
  };

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!selectedVehicleId) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const clickedNode = nodes.find((node) => {
        const distance = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2);
        return distance <= 25;
      });

      if (clickedNode) {
        addToRoute(clickedNode.id);
      }
    },
    [selectedVehicleId, nodes, addToRoute]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#2a2a4e';
    ctx.lineWidth = 1;
    for (let i = 0; i <= width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 0; i <= height; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    roads.forEach((road) => {
      const fromNode = nodes.find((n) => n.id === road.from);
      const toNode = nodes.find((n) => n.id === road.to);
      if (!fromNode || !toNode) return;

      const routeIndex1 = selectedRoute.indexOf(road.from);
      const routeIndex2 = selectedRoute.indexOf(road.to);
      const isInRoute =
        routeIndex1 >= 0 && routeIndex2 >= 0 && Math.abs(routeIndex1 - routeIndex2) === 1;

      ctx.beginPath();
      ctx.moveTo(fromNode.x, fromNode.y);
      ctx.lineTo(toNode.x, toNode.y);
      ctx.strokeStyle = getRoadColor(road, isInRoute);
      ctx.lineWidth = isInRoute ? 6 : 4;
      ctx.lineCap = 'round';
      ctx.stroke();

      const midX = (fromNode.x + toNode.x) / 2;
      const midY = (fromNode.y + toNode.y) / 2;
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${road.distance}`, midX, midY - 8);
    });

    if (selectedRoute.length > 0 && selectedVehicleId) {
      const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
      const startNode = nodes.find((n) => n.id === vehicle?.currentNode);
      if (startNode) {
        let prevX = startNode.x;
        let prevY = startNode.y;

        selectedRoute.forEach((nodeId) => {
          const node = nodes.find((n) => n.id === nodeId);
          if (node) {
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.moveTo(prevX, prevY);
            ctx.lineTo(node.x, node.y);
            ctx.strokeStyle = '#9b59b6';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.setLineDash([]);

            prevX = node.x;
            prevY = node.y;
          }
        });
      }
    }

    nodes.forEach((node) => {
      const isInRoute = selectedRoute.includes(node.id);
      const isSelected = selectedRoute[selectedRoute.length - 1] === node.id;

      ctx.beginPath();
      ctx.arc(node.x, node.y, isSelected ? 28 : isInRoute ? 26 : 22, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#8e44ad' : getNodeColor(node, isInRoute);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const icon = node.type === 'warehouse' ? '🏭' : node.type === 'shelter' ? '🏠' : '🔄';
      ctx.fillText(icon, node.x, node.y);

      ctx.fillStyle = '#ecf0f1';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(node.name, node.x, node.y + 32);
    });

    vehicles.forEach((vehicle) => {
      const pos = getVehiclePosition(vehicle);
      const isSelected = vehicle.id === selectedVehicle;

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, isSelected ? 18 : 14, 0, Math.PI * 2);
      ctx.fillStyle = vehicle.status === 'moving' ? '#3498db' : '#95a5a6';
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#f1c40f' : '#fff';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🚚', pos.x, pos.y);
    });
  }, [nodes, roads, vehicles, selectedVehicle, selectedRoute, width, height, getVehiclePosition]);

  return (
    <div className="relative bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onClick={handleCanvasClick}
        className="cursor-crosshair"
      />
      <div className="absolute top-2 left-2 bg-slate-800/90 rounded px-3 py-2 text-xs text-slate-300">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-500"></span> 畅通
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span> 拥堵
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500"></span> 中断
          </span>
        </div>
      </div>
    </div>
  );
};
