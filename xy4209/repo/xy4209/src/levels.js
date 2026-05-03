export const TileType = {
  FLOOR: 'floor',
  WALL: 'wall',
  ENTRANCE: 'entrance',
  EXIT: 'exit',
  OBSTACLE: 'obstacle',
  VOLUNTEER_SPAWN: 'volunteer_spawn'
};

export const PersonType = {
  NORMAL: 'normal',
  ELDERLY: 'elderly',
  CHILD: 'child',
  DISABLED: 'disabled'
};

export const PersonConfig = {
  [PersonType.NORMAL]: {
    baseSpeed: 1.0,
    basePatience: 100,
    patienceDecayRate: 0.5,
    crowdMultiplier: 0.8,
    color: '#4A90D9',
    name: '普通人群'
  },
  [PersonType.ELDERLY]: {
    baseSpeed: 0.5,
    basePatience: 80,
    patienceDecayRate: 1.0,
    crowdMultiplier: 0.6,
    color: '#D9A04A',
    name: '老人'
  },
  [PersonType.CHILD]: {
    baseSpeed: 0.7,
    basePatience: 60,
    patienceDecayRate: 1.5,
    crowdMultiplier: 0.7,
    color: '#D94A7E',
    name: '儿童'
  },
  [PersonType.DISABLED]: {
    baseSpeed: 0.3,
    basePatience: 120,
    patienceDecayRate: 0.3,
    crowdMultiplier: 0.5,
    color: '#4AD9B8',
    name: '残障人士'
  }
};

export const LevelState = {
  NOT_STARTED: 'not_started',
  PLAYING: 'playing',
  PAUSED: 'paused',
  WON: 'won',
  LOST: 'lost'
};

export function validateLevel(levelData) {
  const errors = [];
  
  if (!levelData.id) errors.push('缺少关卡ID');
  if (!levelData.name) errors.push('缺少关卡名称');
  if (!levelData.duration || levelData.duration <= 0) errors.push('无效的关卡时长');
  
  if (!levelData.grid || !levelData.grid.width || !levelData.grid.height || !levelData.grid.tiles) {
    errors.push('无效的网格配置');
  } else {
    const expectedTiles = levelData.grid.width * levelData.grid.height;
    if (levelData.grid.tiles.length !== expectedTiles) {
      errors.push(`网格瓦片数量不匹配: 期望 ${expectedTiles}, 实际 ${levelData.grid.tiles.length}`);
    }
    
    const entranceCount = levelData.grid.tiles.filter(t => t === TileType.ENTRANCE).length;
    const exitCount = levelData.grid.tiles.filter(t => t === TileType.EXIT).length;
    
    if (entranceCount === 0) errors.push('至少需要一个入口');
    if (exitCount === 0) errors.push('至少需要一个出口');
  }
  
  if (!levelData.population) {
    errors.push('缺少人口配置');
  } else {
    const totalRatio = Object.values(levelData.population).reduce((sum, val) => sum + val, 0);
    if (Math.abs(totalRatio - 1.0) > 0.01) {
      errors.push(`人口比例之和应为1.0，实际为 ${totalRatio.toFixed(2)}`);
    }
  }
  
  if (!levelData.totalPeople || levelData.totalPeople <= 0) {
    errors.push('无效的总人数');
  }
  
  if (!levelData.volunteerPositions || levelData.volunteerPositions.length === 0) {
    errors.push('至少需要一个志愿者位置');
  }
  
  if (!levelData.events) {
    errors.push('缺少事件配置');
  }
  
  if (!levelData.scoring) {
    errors.push('缺少计分配置');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function createPerson(levelState, personId, type, x, y) {
  const config = PersonConfig[type];
  const grid = levelState.grid;
  
  let targetX, targetY;
  let minDist = Infinity;
  
  for (let row = 0; row < grid.height; row++) {
    for (let col = 0; col < grid.width; col++) {
      const tile = grid.tiles[row * grid.width + col];
      if (tile === TileType.EXIT) {
        const dist = Math.abs(x - col) + Math.abs(y - row);
        if (dist < minDist) {
          minDist = dist;
          targetX = col;
          targetY = row;
        }
      }
    }
  }
  
  return {
    id: personId,
    type,
    x,
    y,
    targetX,
    targetY,
    path: [],
    pathIndex: 0,
    speed: config.baseSpeed,
    actualSpeed: config.baseSpeed,
    patience: config.basePatience,
    maxPatience: config.basePatience,
    state: 'moving',
    color: config.color,
    blockedTime: 0,
    directedBy: null,
    customTarget: null
  };
}

export function createVolunteer(id, x, y) {
  return {
    id,
    x,
    y,
    isDragging: false,
    direction: null,
    effectRadius: 2
  };
}

export function initLevelState(levelData) {
  const populationByType = {};
  const totalPeople = levelData.totalPeople;
  
  for (const [type, ratio] of Object.entries(levelData.population)) {
    populationByType[type] = Math.floor(totalPeople * ratio);
  }
  
  const sum = Object.values(populationByType).reduce((a, b) => a + b, 0);
  if (sum < totalPeople) {
    populationByType[PersonType.NORMAL] += totalPeople - sum;
  }
  
  const persons = [];
  let personId = 1;
  
  const entrancePositions = [];
  for (let row = 0; row < levelData.grid.height; row++) {
    for (let col = 0; col < levelData.grid.width; col++) {
      const tile = levelData.grid.tiles[row * levelData.grid.width + col];
      if (tile === TileType.ENTRANCE) {
        entrancePositions.push({ x: col, y: row });
      }
    }
  }
  
  const tempState = { grid: levelData.grid };
  
  for (const [type, count] of Object.entries(populationByType)) {
    for (let i = 0; i < count; i++) {
      const entrancePos = entrancePositions[Math.floor(Math.random() * entrancePositions.length)];
      let x = entrancePos.x;
      let y = entrancePos.y;
      
      if (i > 0) {
        x += (Math.random() - 0.5) * 0.5;
        y += (Math.random() - 0.5) * 0.5;
      }
      
      const person = createPerson(tempState, personId++, type, x, y);
      persons.push(person);
    }
  }
  
  const volunteers = levelData.volunteerPositions.map((pos, idx) => 
    createVolunteer(`vol_${idx + 1}`, pos.x, pos.y)
  );
  
  return {
    levelId: levelData.id,
    levelName: levelData.name,
    state: LevelState.NOT_STARTED,
    startTime: null,
    elapsedTime: 0,
    maxTime: levelData.duration,
    grid: { ...levelData.grid, tiles: [...levelData.grid.tiles] },
    persons,
    volunteers,
    events: levelData.events.map(e => ({ ...e, triggered: false })),
    currentEvent: null,
    scoring: { ...levelData.scoring },
    score: 0,
    peopleEvacuated: 0,
    peoplePanicked: 0,
    blockedPaths: [],
    activeBroadcasts: [],
    replayActions: [],
    totalPeople: persons.length
  };
}
