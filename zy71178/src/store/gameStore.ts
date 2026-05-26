import { create } from 'zustand';
import {
  GameState,
  GameActions,
  Position,
  Robot,
  GameEvent,
  Score,
} from '../types/game';
import { getLevelById, cloneLevel } from '../game/levels';
import {
  checkCollision,
  isAtChargingStation,
  calculateScore,
  planPathToTarget,
  createEvent,
  MOVE_COST_PER_CELL,
  CHARGE_RATE_PER_SECOND,
  PICK_TIME,
} from '../game/engine';

const initialScore: Score = {
  baseScore: 0,
  efficiencyBonus: 0,
  collisionPenalty: 0,
  timeoutPenalty: 0,
  batteryPenalty: 0,
  invalidPathPenalty: 0,
  total: 0,
  rating: 'F',
};

const initialState: GameState = {
  level: null,
  gameSpeed: 1,
  isPaused: false,
  isGameOver: false,
  isPlaying: false,
  robots: [],
  orders: [],
  selectedRobotId: null,
  hoveredPosition: null,
  previewPath: [],
  gameTime: 0,
  realTime: 0,
  score: initialScore,
  collisionCount: 0,
  timeoutCount: 0,
  batteryDeadCount: 0,
  invalidPathCount: 0,
  events: [],
  currentRecordId: null,
};

interface GameStore extends GameState, GameActions {}

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  startGame: (levelId: string) => {
    const levelTemplate = getLevelById(levelId);
    if (!levelTemplate) return;

    const level = cloneLevel(levelTemplate);
    const recordId = `record-${Date.now()}`;

    set({
      ...initialState,
      level,
      robots: level.robots,
      orders: level.orders,
      isPlaying: true,
      currentRecordId: recordId,
      events: [
        createEvent('move', { message: '游戏开始' }, 0),
      ],
    });
  },

  pauseGame: () => {
    set({ isPaused: true });
  },

  resumeGame: () => {
    set({ isPaused: false });
  },

  restartGame: () => {
    const { level } = get();
    if (level) {
      get().startGame(level.id);
    }
  },

  endGame: () => {
    const { gameTime, robots, orders, level, collisionCount, timeoutCount, batteryDeadCount, invalidPathCount, events } = get();
    
    const completedOrders = orders.filter((o) => o.status === 'completed').length;
    const totalOrderDeadline = orders.reduce((sum, o) => sum + o.deadline, 0);
    
    const finalScore = calculateScore(
      completedOrders,
      gameTime,
      totalOrderDeadline,
      collisionCount,
      timeoutCount,
      batteryDeadCount,
      invalidPathCount
    );

    const record = {
      id: get().currentRecordId,
      levelId: level?.id || '',
      startTime: Date.now() - gameTime * 1000,
      endTime: Date.now(),
      score: finalScore,
      events,
      finalState: {
        robots: JSON.parse(JSON.stringify(robots)),
        orders: JSON.parse(JSON.stringify(orders)),
      },
    };

    const existingRecords = JSON.parse(localStorage.getItem('gameRecords') || '[]');
    existingRecords.push(record);
    localStorage.setItem('gameRecords', JSON.stringify(existingRecords));

    set({
      isGameOver: true,
      isPlaying: false,
      score: finalScore,
    });
  },

  setGameSpeed: (speed) => {
    set({ gameSpeed: speed });
  },

  selectRobot: (robotId) => {
    set({ selectedRobotId: robotId, previewPath: [] });
  },

  setHoveredPosition: (pos) => {
    const { selectedRobotId, level, robots } = get();
    
    if (!pos || !selectedRobotId || !level) {
      set({ hoveredPosition: pos, previewPath: [] });
      return;
    }

    const robot = robots.find((r) => r.id === selectedRobotId);
    if (!robot || robot.status === 'dead') {
      set({ hoveredPosition: pos, previewPath: [] });
      return;
    }

    const path = planPathToTarget(robot, pos, level, robots);
    set({
      hoveredPosition: pos,
      previewPath: path || [],
    });
  },

  assignTarget: (robotId, target) => {
    const { level, robots, gameTime, events, invalidPathCount } = get();
    if (!level) return;

    const robotIndex = robots.findIndex((r) => r.id === robotId);
    if (robotIndex === -1) return;

    const robot = robots[robotIndex];
    if (robot.status === 'dead') return;

    const path = planPathToTarget(robot, target, level, robots);

    if (!path) {
      set({
        invalidPathCount: invalidPathCount + 1,
        events: [
          ...events,
          createEvent('invalid_path', { robotId, target }, gameTime),
        ],
      });
      return;
    }

    const newRobots = [...robots];
    newRobots[robotIndex] = {
      ...robot,
      path,
      pathIndex: 0,
      moveProgress: 0,
      status: 'moving',
      targetPosition: target,
    };

    set({
      robots: newRobots,
      previewPath: [],
      events: [
        ...events,
        createEvent('move', { robotId, target, pathLength: path.length }, gameTime),
      ],
    });
  },

  assignOrder: (robotId, orderId) => {
    const { robots, orders, gameTime, events } = get();

    const robotIndex = robots.findIndex((r) => r.id === robotId);
    const orderIndex = orders.findIndex((o) => o.id === orderId);

    if (robotIndex === -1 || orderIndex === -1) return;

    const newRobots = [...robots];
    const newOrders = [...orders];

    newRobots[robotIndex] = {
      ...newRobots[robotIndex],
      currentOrderId: orderId,
    };

    newOrders[orderIndex] = {
      ...newOrders[orderIndex],
      status: 'in_progress',
      assignedRobotId: robotId,
    };

    set({
      robots: newRobots,
      orders: newOrders,
      events: [
        ...events,
        createEvent('pick', { robotId, orderId }, gameTime),
      ],
    });
  },

  tick: (deltaTime) => {
    const state = get();
    if (state.isPaused || state.isGameOver || !state.level || !state.isPlaying) return;

    const { gameSpeed, level, gameTime } = state;
    const adjustedDelta = deltaTime * gameSpeed;

    let newGameTime = state.gameTime + adjustedDelta;
    let newRobots = [...state.robots];
    let newOrders = [...state.orders];
    let newEvents = [...state.events];
    let newCollisionCount = state.collisionCount;
    let newTimeoutCount = state.timeoutCount;
    let newBatteryDeadCount = state.batteryDeadCount;

    const prevPositions = new Map<string, Position>();
    newRobots.forEach((r) => prevPositions.set(r.id, { ...r.position }));

    for (let i = 0; i < newRobots.length; i++) {
      const robot = newRobots[i];
      if (robot.status === 'dead') continue;

      if (robot.status === 'moving' && robot.path.length > 0) {
        let newProgress = robot.moveProgress + adjustedDelta;
        
        while (newProgress >= 1 && robot.pathIndex < robot.path.length) {
          newProgress -= 1;
          
          const nextPos = robot.path[robot.pathIndex];
          newRobots[i] = {
            ...robot,
            position: nextPos,
            pathIndex: robot.pathIndex + 1,
            moveProgress: 0,
            battery: Math.max(0, robot.battery - MOVE_COST_PER_CELL),
          };

          if (newRobots[i].battery <= 0) {
            newRobots[i].status = 'dead';
            newRobots[i].path = [];
            newBatteryDeadCount++;
            newEvents.push(createEvent('battery_dead', { robotId: robot.id }, newGameTime));
            break;
          }

          const currentOrder = newOrders.find((o) => o.id === robot.currentOrderId);
          if (currentOrder) {
            for (const item of currentOrder.items) {
              if (!item.picked) {
                const shelf = level.shelves.find((s) => s.id === item.shelfId);
                if (shelf) {
                  const dx = Math.abs(nextPos.x - shelf.position.x);
                  const dy = Math.abs(nextPos.y - shelf.position.y);
                  if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
                    item.picked = true;
                    newEvents.push(createEvent('pick', { 
                      robotId: robot.id, 
                      shelfId: item.shelfId 
                    }, newGameTime));
                  }
                }
              }
            }

            const allPicked = currentOrder.items.every((item) => item.picked);
            if (allPicked && currentOrder.status !== 'completed') {
              const orderIdx = newOrders.findIndex((o) => o.id === currentOrder.id);
              newOrders[orderIdx] = { ...currentOrder, status: 'completed' };
              newRobots[i] = { ...newRobots[i], currentOrderId: undefined };
              newEvents.push(createEvent('order_complete', { 
                orderId: currentOrder.id,
                robotId: robot.id
              }, newGameTime));
            }
          }

          if (newRobots[i].pathIndex >= robot.path.length) {
            newRobots[i].status = 'idle';
            newRobots[i].path = [];
            newRobots[i].targetPosition = undefined;
            break;
          }
        }

        if (newRobots[i].status === 'moving') {
          newRobots[i].moveProgress = newProgress;
        }
      }

      const chargingPositions = level.chargingStations.map((s) => s.position);
      if (isAtChargingStation(newRobots[i], chargingPositions) && newRobots[i].status !== 'dead') {
        newRobots[i] = {
          ...newRobots[i],
          status: 'charging',
          battery: Math.min(100, newRobots[i].battery + CHARGE_RATE_PER_SECOND * adjustedDelta),
        };
      } else if (newRobots[i].status === 'charging') {
        newRobots[i].status = 'idle';
      }
    }

    const collision = checkCollision(newRobots, prevPositions);
    if (collision.collided) {
      newCollisionCount++;
      newEvents.push(createEvent('collision', { 
        robotIds: collision.robotIds 
      }, newGameTime));
      
      for (const robotId of collision.robotIds) {
        const idx = newRobots.findIndex((r) => r.id === robotId);
        if (idx !== -1) {
          newRobots[idx] = { ...newRobots[idx], status: 'dead', path: [] };
        }
      }
    }

    for (let i = 0; i < newOrders.length; i++) {
      const order = newOrders[i];
      if ((order.status === 'pending' || order.status === 'in_progress') && newGameTime > order.deadline) {
        newOrders[i] = { ...order, status: 'timeout' };
        newTimeoutCount++;
        newEvents.push(createEvent('order_timeout', { orderId: order.id }, newGameTime));
      }
    }

    if (newGameTime >= level.timeLimit) {
      set({
        robots: newRobots,
        orders: newOrders,
        gameTime: newGameTime,
        events: newEvents,
        collisionCount: newCollisionCount,
        timeoutCount: newTimeoutCount,
        batteryDeadCount: newBatteryDeadCount,
      });
      get().endGame();
      return;
    }

    const allOrdersDone = newOrders.every(
      (o) => o.status === 'completed' || o.status === 'timeout'
    );
    const allRobotsIdle = newRobots.every(
      (r) => r.status === 'idle' || r.status === 'dead' || r.status === 'charging'
    );

    if (allOrdersDone && allRobotsIdle && newOrders.length > 0) {
      set({
        robots: newRobots,
        orders: newOrders,
        gameTime: newGameTime,
        events: newEvents,
        collisionCount: newCollisionCount,
        timeoutCount: newTimeoutCount,
        batteryDeadCount: newBatteryDeadCount,
      });
      get().endGame();
      return;
    }

    set({
      robots: newRobots,
      orders: newOrders,
      gameTime: newGameTime,
      events: newEvents,
      collisionCount: newCollisionCount,
      timeoutCount: newTimeoutCount,
      batteryDeadCount: newBatteryDeadCount,
    });
  },
}));

export function useRobot(robotId: string | null) {
  return useGameStore((state) => 
    state.robots.find((r) => r.id === robotId) || null
  );
}

export function useSelectedRobot() {
  const selectedId = useGameStore((state) => state.selectedRobotId);
  return useRobot(selectedId);
}
