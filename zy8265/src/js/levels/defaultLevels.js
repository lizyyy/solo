export const defaultLevels = [
  {
    name: "第一关：入门展厅",
    description: "简单关卡，熟悉操作。将文物箱推到库房区域。",
    width: 8,
    height: 8,
    player: { x: 1, y: 1 },
    boxes: [
      { x: 3, y: 3, weight: 1 }
    ],
    walls: [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, 
      { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 },
      { x: 0, y: 7 }, { x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, 
      { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 }, { x: 7, y: 7 },
      { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 0, y: 4 },
      { x: 0, y: 5 }, { x: 0, y: 6 },
      { x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 },
      { x: 7, y: 5 }, { x: 7, y: 6 },
      { x: 5, y: 2 }, { x: 5, y: 3 }
    ],
    storagePositions: [
      { x: 6, y: 5 }, { x: 6, y: 6 }
    ],
    humidityAreas: [],
    patrolPaths: [],
    elevators: []
  },
  {
    name: "第二关：湿度禁区",
    description: "小心！避开湿度超标区域。文物不能接触高湿度环境！",
    width: 10,
    height: 8,
    player: { x: 1, y: 1 },
    boxes: [
      { x: 3, y: 2, weight: 1 },
      { x: 5, y: 4, weight: 1 }
    ],
    walls: [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 },
      { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 },
      { x: 8, y: 0 }, { x: 9, y: 0 },
      { x: 0, y: 7 }, { x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 },
      { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 }, { x: 7, y: 7 },
      { x: 8, y: 7 }, { x: 9, y: 7 },
      { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 0, y: 4 },
      { x: 0, y: 5 }, { x: 0, y: 6 },
      { x: 9, y: 1 }, { x: 9, y: 2 }, { x: 9, y: 3 }, { x: 9, y: 4 },
      { x: 9, y: 5 }, { x: 9, y: 6 },
      { x: 4, y: 2 }, { x: 4, y: 3 },
      { x: 6, y: 5 }, { x: 6, y: 6 }
    ],
    storagePositions: [
      { x: 8, y: 5 }, { x: 8, y: 6 }
    ],
    humidityAreas: [
      { x: 3, y: 4 }, { x: 3, y: 5 }, { x: 4, y: 4 }, { x: 4, y: 5 },
      { x: 5, y: 4 }, { x: 5, y: 5 }, { x: 6, y: 4 }, { x: 6, y: 5 }
    ],
    patrolPaths: [],
    elevators: []
  },
  {
    name: "第三关：电梯危机",
    description: "电梯限重！小心规划路线，避免箱子被推到死角。",
    width: 12,
    height: 10,
    player: { x: 1, y: 1 },
    boxes: [
      { x: 3, y: 3, weight: 1 },
      { x: 5, y: 5, weight: 2 },
      { x: 7, y: 3, weight: 1 }
    ],
    walls: [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 },
      { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 },
      { x: 8, y: 0 }, { x: 9, y: 0 }, { x: 10, y: 0 }, { x: 11, y: 0 },
      { x: 0, y: 9 }, { x: 1, y: 9 }, { x: 2, y: 9 }, { x: 3, y: 9 },
      { x: 4, y: 9 }, { x: 5, y: 9 }, { x: 6, y: 9 }, { x: 7, y: 9 },
      { x: 8, y: 9 }, { x: 9, y: 9 }, { x: 10, y: 9 }, { x: 11, y: 9 },
      { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 0, y: 4 },
      { x: 0, y: 5 }, { x: 0, y: 6 }, { x: 0, y: 7 }, { x: 0, y: 8 },
      { x: 11, y: 1 }, { x: 11, y: 2 }, { x: 11, y: 3 }, { x: 11, y: 4 },
      { x: 11, y: 5 }, { x: 11, y: 6 }, { x: 11, y: 7 }, { x: 11, y: 8 },
      { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 4, y: 4 },
      { x: 8, y: 4 }, { x: 8, y: 5 }, { x: 8, y: 6 },
      { x: 2, y: 6 }, { x: 3, y: 6 }
    ],
    storagePositions: [
      { x: 10, y: 7 }, { x: 10, y: 8 }, { x: 9, y: 8 }
    ],
    humidityAreas: [
      { x: 5, y: 2 }, { x: 5, y: 3 }, { x: 6, y: 2 }, { x: 6, y: 3 }
    ],
    patrolPaths: [
      { x: 2, y: 4 }, { x: 2, y: 5 }, { x: 3, y: 4 }, { x: 3, y: 5 }
    ],
    elevators: [
      { x: 9, y: 3, maxCapacity: 2, floors: [1, 2] }
    ]
  }
];

export const createCustomLevel = (config) => {
  return {
    name: config.name || "自定义关卡",
    description: config.description || "",
    width: config.width || 8,
    height: config.height || 8,
    player: config.player || { x: 1, y: 1 },
    boxes: config.boxes || [],
    walls: config.walls || [],
    storagePositions: config.storagePositions || [],
    humidityAreas: config.humidityAreas || [],
    patrolPaths: config.patrolPaths || [],
    elevators: config.elevators || []
  };
};
