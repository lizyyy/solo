import {
  GameState,
  Vehicle,
  MapNode,
  Road,
  SupplyInventory,
  SupplyType,
  ActionRecord,
} from '../types';
import { SUPPLY_CONFIGS } from '../types';

export const calculateWeight = (inventory: SupplyInventory): number => {
  return (
    inventory.water * SUPPLY_CONFIGS[0].weight +
    inventory.medicine * SUPPLY_CONFIGS[1].weight +
    inventory.tent * SUPPLY_CONFIGS[2].weight
  );
};

export const findPath = (
  from: string,
  to: string,
  roads: Road[],
  nodes: MapNode[]
): string[] | null => {
  const visited = new Set<string>();
  const queue: { node: string; path: string[] }[] = [{ node: from, path: [from] }];

  while (queue.length > 0) {
    const { node, path } = queue.shift()!;
    if (node === to) return path;
    if (visited.has(node)) continue;
    visited.add(node);

    const connectedRoads = roads.filter(
      (r) => (r.from === node || r.to === node) && r.status !== 'blocked'
    );

    for (const road of connectedRoads) {
      const nextNode = road.from === node ? road.to : road.from;
      if (!visited.has(nextNode)) {
        queue.push({ node: nextNode, path: [...path, nextNode] });
      }
    }
  }

  return null;
};

export const getConnectedNodes = (nodeId: string, roads: Road[]): string[] => {
  return roads
    .filter((r) => (r.from === nodeId || r.to === nodeId) && r.status !== 'blocked')
    .map((r) => (r.from === nodeId ? r.to : r.from));
};

export const getRoad = (from: string, to: string, roads: Road[]): Road | undefined => {
  return roads.find(
    (r) => (r.from === from && r.to === to) || (r.from === to && r.to === from)
  );
};

export const updateVehicles = (
  vehicles: Vehicle[],
  roads: Road[],
  nodes: MapNode[],
  deltaTime: number
): { vehicles: Vehicle[]; nodes: MapNode[]; deliveries: string[] } => {
  const newVehicles = [...vehicles];
  const newNodes = [...nodes];
  const deliveries: string[] = [];

  for (let i = 0; i < newVehicles.length; i++) {
    const vehicle = { ...newVehicles[i] };

    if (vehicle.status === 'moving' && vehicle.targetNodes.length > 0) {
      const targetNode = vehicle.targetNodes[0];
      const road = getRoad(vehicle.currentNode, targetNode, roads);
      
      if (road) {
        const baseSpeed = 0.02 * vehicle.speed;
        const roadMultiplier = road.status === 'congested' ? 0.5 : 1;
        const moveAmount = baseSpeed * roadMultiplier * deltaTime * 60;
        
        vehicle.progress += moveAmount;

        if (vehicle.progress >= 1) {
          vehicle.currentNode = targetNode;
          vehicle.progress = 0;
          vehicle.targetNodes = vehicle.targetNodes.slice(1);

          const nodeIndex = newNodes.findIndex((n) => n.id === targetNode);
          if (nodeIndex >= 0) {
            const node = { ...newNodes[nodeIndex] };
            if (node.type === 'shelter' && node.demand && node.received) {
              const delivered: SupplyInventory = { water: 0, medicine: 0, tent: 0 };
              
              (['water', 'medicine', 'tent'] as SupplyType[]).forEach((type) => {
                const needed = node.demand![type] - node.received![type];
                const available = vehicle.currentLoad[type];
                const toDeliver = Math.min(needed, available);
                delivered[type] = toDeliver;
                vehicle.currentLoad[type] -= toDeliver;
                node.received![type] += toDeliver;
              });

              vehicle.currentWeight = calculateWeight(vehicle.currentLoad);
              
              if (delivered.water > 0 || delivered.medicine > 0 || delivered.tent > 0) {
                deliveries.push(`${node.name}: 水${delivered.water} 药${delivered.medicine} 帐篷${delivered.tent}`);
              }
              
              newNodes[nodeIndex] = node;
            }
          }

          if (vehicle.targetNodes.length === 0) {
            vehicle.status = 'idle';
          }
        }
      } else {
        vehicle.targetNodes = [];
        vehicle.status = 'idle';
      }
    }

    newVehicles[i] = vehicle;
  }

  return { vehicles: newVehicles, nodes: newNodes, deliveries };
};

export const loadSupplies = (
  vehicle: Vehicle,
  warehouseSupplies: SupplyInventory,
  type: SupplyType,
  amount: number
): { vehicle: Vehicle; warehouseSupplies: SupplyInventory; isOverload: boolean } => {
  const config = SUPPLY_CONFIGS.find((c) => c.type === type)!;
  const additionalWeight = amount * config.weight;
  const newWeight = vehicle.currentWeight + additionalWeight;
  const isOverload = newWeight > vehicle.maxCapacity;

  const actualAmount = isOverload
    ? Math.floor((vehicle.maxCapacity - vehicle.currentWeight) / config.weight)
    : amount;

  const newVehicle = {
    ...vehicle,
    currentLoad: {
      ...vehicle.currentLoad,
      [type]: vehicle.currentLoad[type] + actualAmount,
    },
    currentWeight: vehicle.currentWeight + actualAmount * config.weight,
  };

  const newWarehouseSupplies = {
    ...warehouseSupplies,
    [type]: warehouseSupplies[type] - actualAmount,
  };

  return { vehicle: newVehicle, warehouseSupplies: newWarehouseSupplies, isOverload };
};

export const unloadSupplies = (
  vehicle: Vehicle,
  warehouseSupplies: SupplyInventory
): { vehicle: Vehicle; warehouseSupplies: SupplyInventory } => {
  return {
    vehicle: {
      ...vehicle,
      currentLoad: { water: 0, medicine: 0, tent: 0 },
      currentWeight: 0,
    },
    warehouseSupplies: {
      water: warehouseSupplies.water + vehicle.currentLoad.water,
      medicine: warehouseSupplies.medicine + vehicle.currentLoad.medicine,
      tent: warehouseSupplies.tent + vehicle.currentLoad.tent,
    },
  };
};

export const recordAction = (
  turn: number,
  type: ActionRecord['type'],
  payload: any
): ActionRecord => {
  return {
    turn,
    timestamp: Date.now(),
    type,
    payload,
  };
};

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};
