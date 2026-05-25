import { GameEvent, Road, WeatherType, GameState, MapNode, SupplyInventory, Vehicle } from '../types';

const eventTemplates = [
  {
    type: 'road_block' as const,
    titles: ['山体滑坡', '道路塌陷', '桥梁断裂', '树木倒伏'],
    descriptions: [
      '前方道路发生山体滑坡，通行受阻',
      '路段出现塌陷，无法正常通行',
      '桥梁结构受损，暂时封闭',
      '树木倒伏阻断道路，正在清理',
    ],
  },
  {
    type: 'weather' as const,
    titles: ['暴雨来袭', '大风预警', '浓雾天气'],
    descriptions: [
      '突降暴雨，道路湿滑，车辆减速',
      '强风天气，注意行车安全',
      '能见度降低，行驶速度受限',
    ],
  },
  {
    type: 'demand_surge' as const,
    titles: ['需求增加', '新灾民到达', '物资消耗加快'],
    descriptions: [
      '安置点接收了新的灾民，需求增加',
      '物资消耗速度超出预期，需要补充',
      '发现新的受灾群众，急需物资支援',
    ],
  },
  {
    type: 'supply_loss' as const,
    titles: ['物资损耗', '包装破损', '货物受潮'],
    descriptions: [
      '部分物资在运输途中损耗',
      '包装破损导致部分物资无法使用',
      '暴雨导致部分货物受潮',
    ],
  },
];

export const generateRandomEvent = (
  state: GameState,
  roads: Road[],
  nodes: MapNode[]
): GameEvent | null => {
  const level = state.levelId;
  const eventProbability = level === 'level-1' ? 0.1 : level === 'level-2' ? 0.25 : 0.4;

  if (Math.random() > eventProbability) {
    return null;
  }

  const templateIndex = Math.floor(Math.random() * eventTemplates.length);
  const template = eventTemplates[templateIndex];
  const titleIndex = Math.floor(Math.random() * template.titles.length);
  const descIndex = Math.floor(Math.random() * template.descriptions.length);

  let affectedRoad: string | undefined;
  let affectedNode: string | undefined;

  if (template.type === 'road_block' || template.type === 'weather') {
    const clearRoads = roads.filter((r) => r.status === 'clear');
    if (clearRoads.length > 0) {
      affectedRoad = clearRoads[Math.floor(Math.random() * clearRoads.length)].id;
    }
  } else if (template.type === 'demand_surge') {
    const shelters = nodes.filter((n) => n.type === 'shelter');
    if (shelters.length > 0) {
      affectedNode = shelters[Math.floor(Math.random() * shelters.length)].id;
    }
  }

  return {
    id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: template.type,
    title: template.titles[titleIndex],
    description: template.descriptions[descIndex],
    timestamp: Date.now(),
    affectedRoad,
    affectedNode,
    resolved: false,
  };
};

export const applyEventEffect = (
  event: GameEvent,
  state: GameState
): { roads: Road[]; nodes: MapNode[]; vehicles: typeof state.vehicles; weather: WeatherType; message: string } => {
  let roads = [...state.roads];
  let nodes = [...state.nodes];
  let vehicles = [...state.vehicles];
  let weather = state.weather;
  let message = '';

  switch (event.type) {
    case 'road_block':
      if (event.affectedRoad) {
        roads = roads.map((r) =>
          r.id === event.affectedRoad ? { ...r, status: 'blocked' as const } : r
        );
        message = `道路 ${event.affectedRoad} 已中断，需要绕行或等待修复`;
      }
      break;

    case 'weather': {
      const weatherTypes: WeatherType[] = ['rainy', 'stormy'];
      weather = weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
      vehicles = vehicles.map((v) => ({ ...v, speed: v.speed * 0.7 }));
      message = weather === 'stormy' ? '暴风雨来袭，所有车辆减速30%' : '降雨天气，所有车辆减速30%';
      break;
    }

    case 'demand_surge':
      if (event.affectedNode) {
        nodes = nodes.map((n) => {
          if (n.id === event.affectedNode && n.demand) {
            const increase: SupplyInventory = {
              water: Math.floor(n.demand.water * 0.3),
              medicine: Math.floor(n.demand.medicine * 0.3),
              tent: Math.floor(n.demand.tent * 0.2),
            };
            return {
              ...n,
              demand: {
                water: n.demand.water + increase.water,
                medicine: n.demand.medicine + increase.medicine,
                tent: n.demand.tent + increase.tent,
              },
            };
          }
          return n;
        });
        message = `安置点需求增加！请调整配送计划`;
      }
      break;

    case 'supply_loss':
      vehicles = vehicles.map((v) => {
        if (v.status === 'moving') {
          const lossRate = 0.1 + Math.random() * 0.1;
          return {
            ...v,
            currentLoad: {
              water: Math.floor(v.currentLoad.water * (1 - lossRate)),
              medicine: Math.floor(v.currentLoad.medicine * (1 - lossRate)),
              tent: Math.floor(v.currentLoad.tent * (1 - lossRate)),
            },
            currentWeight: v.currentWeight * (1 - lossRate),
          };
        }
        return v;
      });
      message = '运输中的物资发生损耗！';
      break;
  }

  return { roads, nodes, vehicles, weather, message };
};

export const resolveRoadBlock = (roadId: string, roads: Road[]): Road[] => {
  return roads.map((r) => (r.id === roadId ? { ...r, status: 'clear' as const } : r));
};

export const restoreWeather = (vehicles: Vehicle[], originalSpeeds: number[]): Vehicle[] => {
  return vehicles.map((v, i) => ({
    ...v,
    speed: originalSpeeds[i] || v.speed,
  }));
};
