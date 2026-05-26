import { Node, Edge, StreetLamp, Vehicle, Priority } from '@/types/game';

export interface GeneratedMap {
  nodes: Node[];
  edges: Edge[];
  lamps: StreetLamp[];
  vehicles: Vehicle[];
  depotNodeId: string;
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

function pickPriority(level: number): Priority {
  const r = Math.random();
  const criticalChance = 0.1 + level * 0.03;
  const highChance = 0.25 + level * 0.03;
  const normalChance = 0.4;

  if (r < criticalChance) return 'critical';
  if (r < criticalChance + highChance) return 'high';
  if (r < criticalChance + highChance + normalChance) return 'normal';
  return 'low';
}

function getPriorityConfig(priority: Priority) {
  switch (priority) {
    case 'critical':
      return { maxTime: 60, baseScore: 150, repairCost: 3 };
    case 'high':
      return { maxTime: 90, baseScore: 120, repairCost: 2 };
    case 'normal':
      return { maxTime: 120, baseScore: 100, repairCost: 1 };
    case 'low':
    default:
      return { maxTime: 150, baseScore: 100, repairCost: 1 };
  }
}

export function generateMap(level: number): GeneratedMap {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const lamps: StreetLamp[] = [];

  const gridSize = 4 + Math.min(level, 4);
  const nodeSpacing = 100;
  const offsetX = 80;
  const offsetY = 80;

  let nodeIdCounter = 0;
  const gridNodeIds: string[][] = [];

  for (let row = 0; row < gridSize; row++) {
    gridNodeIds[row] = [];
    for (let col = 0; col < gridSize; col++) {
      const id = `node_${nodeIdCounter++}`;
      const jitterX = rand(-15, 15);
      const jitterY = rand(-15, 15);
      nodes.push({
        id,
        x: offsetX + col * nodeSpacing + jitterX,
        y: offsetY + row * nodeSpacing + jitterY,
        type: 'intersection',
      });
      gridNodeIds[row][col] = id;
    }
  }

  const depotRow = Math.floor(gridSize / 2);
  const depotCol = Math.floor(gridSize / 2);
  const depotNodeId = gridNodeIds[depotRow][depotCol];
  const depotNode = nodes.find((n) => n.id === depotNodeId)!;
  depotNode.type = 'depot';

  let edgeIdCounter = 0;
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const currentId = gridNodeIds[row][col];

      if (col < gridSize - 1) {
        const rightId = gridNodeIds[row][col + 1];
        const currentNode = nodes.find((n) => n.id === currentId)!;
        const rightNode = nodes.find((n) => n.id === rightId)!;
        const dist = Math.sqrt(
          (currentNode.x - rightNode.x) ** 2 + (currentNode.y - rightNode.y) ** 2
        );
        edges.push({
          id: `edge_${edgeIdCounter++}`,
          from: currentId,
          to: rightId,
          distance: Math.round(dist),
          cost: Math.round(dist * rand(0.8, 1.4)),
        });
      }

      if (row < gridSize - 1) {
        const downId = gridNodeIds[row + 1][col];
        const currentNode = nodes.find((n) => n.id === currentId)!;
        const downNode = nodes.find((n) => n.id === downId)!;
        const dist = Math.sqrt(
          (currentNode.x - downNode.x) ** 2 + (currentNode.y - downNode.y) ** 2
        );
        edges.push({
          id: `edge_${edgeIdCounter++}`,
          from: currentId,
          to: downId,
          distance: Math.round(dist),
          cost: Math.round(dist * rand(0.8, 1.4)),
        });
      }
    }
  }

  const extraEdges = Math.floor(level / 2) + 2;
  for (let i = 0; i < extraEdges; i++) {
    const r1 = randInt(0, gridSize - 1);
    const c1 = randInt(0, gridSize - 1);
    let r2 = r1;
    let c2 = c1;
    if (Math.random() > 0.5 && r1 < gridSize - 2) {
      r2 = r1 + 2;
    } else if (c1 < gridSize - 2) {
      c2 = c1 + 2;
    } else {
      continue;
    }
    const fromId = gridNodeIds[r1][c1];
    const toId = gridNodeIds[r2][c2];
    const exists = edges.some(
      (e) =>
        (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId)
    );
    if (!exists) {
      const fromNode = nodes.find((n) => n.id === fromId)!;
      const toNode = nodes.find((n) => n.id === toId)!;
      const dist = Math.sqrt(
        (fromNode.x - toNode.x) ** 2 + (fromNode.y - toNode.y) ** 2
      );
      edges.push({
        id: `edge_${edgeIdCounter++}`,
        from: fromId,
        to: toId,
        distance: Math.round(dist),
        cost: Math.round(dist * rand(0.9, 1.2)),
      });
    }
  }

  const lampCount = 6 + level * 2;
  const availableNodes = nodes.filter(
    (n) => n.id !== depotNodeId
  );

  const shuffled = [...availableNodes].sort(() => Math.random() - 0.5);
  const lampNodes = shuffled.slice(0, Math.min(lampCount, shuffled.length));

  let lampIdCounter = 0;
  for (const lampNode of lampNodes) {
    const priority = pickPriority(level);
    const config = getPriorityConfig(priority);
    const lampId = `lamp_${lampIdCounter++}`;

    lampNode.type = 'lamp';
    lampNode.lampId = lampId;

    lamps.push({
      id: lampId,
      nodeId: lampNode.id,
      x: lampNode.x,
      y: lampNode.y,
      status: 'broken',
      priority,
      timeRemaining: config.maxTime,
      maxTime: config.maxTime,
      repairCost: config.repairCost,
      repairTime: randInt(5, 15),
      baseScore: config.baseScore,
      assignedVehicleId: null,
    });
  }

  const vehicleCount = 1 + Math.min(Math.floor(level / 2), 2);
  const vehicles: Vehicle[] = [];
  const vehicleNames = ['维修车-A', '维修车-B', '维修车-C'];

  for (let i = 0; i < vehicleCount; i++) {
    vehicles.push({
      id: `vehicle_${i}`,
      name: vehicleNames[i],
      status: 'idle',
      currentNodeId: depotNodeId,
      targetNodeId: null,
      path: [],
      pathIndex: 0,
      progress: 0,
      speed: 80 + level * 5,
      spareParts: 5 + level,
      maxSpareParts: 8 + level,
      targetLampId: null,
      repairProgress: 0,
      emptyTime: 0,
    });
  }

  return { nodes, edges, lamps, vehicles, depotNodeId };
}

export function getTotalSpareParts(lamps: StreetLamp[]): number {
  return lamps
    .filter((l) => l.status === 'broken' || l.status === 'assigned')
    .reduce((sum, l) => sum + l.repairCost, 0);
}
