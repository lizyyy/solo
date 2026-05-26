import { useGameStore } from './state';
import { getLevelById } from './levels';
import {
  canAssignRoom,
  canDispatchCleaner,
  checkExtendRequest,
  checkGameOver,
  calculateCleaningTime,
  calculateMaintenanceTime,
} from './rules';
import type {
  Room,
  Guest,
  Cleaner,
  GameEvent,
  PlayerAction,
  LevelConfig,
} from './types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function initializeGame(levelId: number): void {
  const level = getLevelById(levelId);
  if (!level) return;

  useGameStore.getState().resetGame();

  const rooms = generateRooms(level.roomCount);
  const cleaners = generateCleaners(level.cleanerCount);
  const guests = generateInitialGuests(level);

  useGameStore.setState({
    status: 'playing',
    currentLevel: levelId,
    currentTime: 0,
    rooms,
    cleaners,
    guests,
    score: 0,
    complaints: 0,
    satisfaction: 100,
    events: [],
    history: [],
    replayIndex: 0,
    selectedGuestId: null,
    selectedRoomId: null,
    failReason: undefined,
  });

  recordHistory();
}

function generateRooms(count: number): Room[] {
  const rooms: Room[] = [];

  for (let i = 0; i < count; i++) {
    const floor = Math.floor(i / 5) + 1;
    const roomInFloor = (i % 5) + 1;
    rooms.push({
      id: i,
      number: `${floor}${roomInFloor.toString().padStart(2, '0')}`,
      floor,
      status: 'empty',
    });
  }
  return rooms;
}

function generateCleaners(count: number): Cleaner[] {
  const names = ['王阿姨', '李阿姨', '张阿姨', '刘阿姨', '陈阿姨'];
  return Array.from({ length: count }, (_, i) => ({
    id: `cleaner-${i}`,
    name: names[i % names.length],
    status: 'idle' as const,
    progress: 0,
  }));
}

function generateInitialGuests(level: LevelConfig): Guest[] {
  return level.presetGuests.map((preset, index) => ({
    id: `guest-${index}`,
    name: preset.name,
    avatar: preset.avatar,
    arrivalTime: preset.arrivalTime - (preset.earlyArrival || 0),
    departureTime: preset.arrivalTime + preset.stayDuration,
    status: 'waiting' as const,
    satisfaction: 100,
    willExtend: preset.willExtend || false,
    hasExtendRequest: false,
    extendNights: preset.extendNights,
    specialRequest: preset.specialRequest,
  }));
}

export function gameTick(): void {
  const state = useGameStore.getState();
  if (state.status !== 'playing') return;

  const level = getLevelById(state.currentLevel);
  if (!level) return;

  const newTime = state.currentTime + 1;
  useGameStore.getState().setCurrentTime(newTime);

  processGuestArrivals(newTime);
  processGuestDepartures(newTime);
  processGuestWaiting(newTime);
  processCleaningProgress(newTime);
  processMaintenanceProgress(newTime);
  processExtendRequests(newTime);
  processPresetEvents(level, newTime);

  checkGameEndConditions(level, newTime);

  recordHistory();
}

function processGuestWaiting(currentTime: number): void {
  const state = useGameStore.getState();

  const waitingGuests = state.guests.filter(
    (g: Guest) => g.status === 'waiting' && g.arrivalTime <= currentTime
  );

  waitingGuests.forEach((guest: Guest) => {
    const waitTime = currentTime - guest.arrivalTime;

    if (waitTime > 0 && waitTime % 5 === 0) {
      useGameStore.getState().updateGuest(guest.id, {
        satisfaction: Math.max(0, guest.satisfaction - 5),
      });
    }

    if (waitTime >= 20 && !guest.hasComplained) {
      useGameStore.getState().updateGuest(guest.id, {
        hasComplained: true,
      });
      useGameStore.getState().addComplaint();
      useGameStore.getState().addScore(-20);

      const event: GameEvent = {
        id: generateId(),
        type: 'complaint',
        time: currentTime,
        data: { guestId: guest.id, guestName: guest.name, waitTime },
        message: `${guest.name} 等待超时(${waitTime}分钟)，产生客诉！`,
      };
      useGameStore.getState().addEvent(event);
    }

    if (waitTime >= 30) {
      useGameStore.getState().updateGuest(guest.id, {
        status: 'left',
      });

      const event: GameEvent = {
        id: generateId(),
        type: 'guest_left',
        time: currentTime,
        data: { guestId: guest.id, guestName: guest.name, waitTime },
        message: `${guest.name} 因等待时间过长离开了酒店`,
      };
      useGameStore.getState().addEvent(event);

      useGameStore.getState().addScore(-30);
      useGameStore.getState().addSatisfaction(-20);
    }
  });
}

function processGuestArrivals(currentTime: number): void {
  const state = useGameStore.getState();
  const arrivingGuests = state.guests.filter(
    (g: Guest) => g.arrivalTime === currentTime && g.status === 'waiting'
  );

  arrivingGuests.forEach((guest: Guest) => {
    useGameStore.getState().updateGuest(guest.id, {
      actualArrivalTime: currentTime,
    });

    const event: GameEvent = {
      id: generateId(),
      type: 'guest_arrive',
      time: currentTime,
      data: { guestId: guest.id, guestName: guest.name },
      message: `${guest.name} 已到达酒店`,
    };
    useGameStore.getState().addEvent(event);
  });
}

function processGuestDepartures(currentTime: number): void {
  const state = useGameStore.getState();
  const departingGuests = state.guests.filter(
    (g: Guest) => g.departureTime === currentTime && g.status === 'checked-in'
  );

  departingGuests.forEach((guest: Guest) => {
    if (guest.roomId !== undefined) {
      useGameStore.getState().updateRoom(guest.roomId, {
        status: 'dirty',
        guestId: undefined,
      });
    }

    useGameStore.getState().updateGuest(guest.id, {
      status: 'checked-out',
      roomId: undefined,
    });

    const event: GameEvent = {
      id: generateId(),
      type: 'guest_depart',
      time: currentTime,
      data: { guestId: guest.id, guestName: guest.name },
      message: `${guest.name} 已退房`,
    };
    useGameStore.getState().addEvent(event);
  });
}

function processCleaningProgress(currentTime: number): void {
  const state = useGameStore.getState();

  state.cleaners.forEach((cleaner: Cleaner) => {
    if (cleaner.status === 'cleaning' && cleaner.currentRoomId !== undefined) {
      const room = state.rooms.find((r: Room) => r.id === cleaner.currentRoomId);
      if (!room) return;

      const cleaningTime = calculateCleaningTime(room);
      const newProgress = cleaner.progress + (100 / cleaningTime);

      if (newProgress >= 100) {
        useGameStore.getState().updateCleaner(cleaner.id, {
          status: 'idle',
          currentRoomId: undefined,
          progress: 0,
        });

        useGameStore.getState().updateRoom(room.id, {
          status: 'empty',
          cleanProgress: undefined,
        });

        const event: GameEvent = {
          id: generateId(),
          type: 'clean_complete',
          time: currentTime,
          data: { roomNumber: room.number, cleanerName: cleaner.name },
          message: `${cleaner.name} 完成了 ${room.number} 房间的清洁`,
        };
        useGameStore.getState().addEvent(event);

        useGameStore.getState().addScore(5);
      } else {
        useGameStore.getState().updateCleaner(cleaner.id, {
          progress: newProgress,
        });

        useGameStore.getState().updateRoom(room.id, {
          cleanProgress: newProgress,
        });
      }
    }
  });
}

function processMaintenanceProgress(currentTime: number): void {
  const state = useGameStore.getState();

  state.rooms
    .filter((r: Room) => r.status === 'maintenance' && r.maintenanceProgress !== undefined)
    .forEach((room: Room) => {
      const maintenanceTime = calculateMaintenanceTime();
      const newProgress = (room.maintenanceProgress || 0) + (100 / maintenanceTime);

      if (newProgress >= 100) {
        useGameStore.getState().updateRoom(room.id, {
          status: 'empty',
          maintenanceProgress: undefined,
        });

        const event: GameEvent = {
          id: generateId(),
          type: 'maintenance_complete',
          time: currentTime,
          data: { roomNumber: room.number },
          message: `${room.number} 房间维修完成`,
        };
        useGameStore.getState().addEvent(event);
      } else {
        useGameStore.getState().updateRoom(room.id, {
          maintenanceProgress: newProgress,
        });
      }
    });
}

function processExtendRequests(currentTime: number): void {
  const state = useGameStore.getState();

  state.guests
    .filter(
      (g: Guest) =>
        g.status === 'checked-in' &&
        g.willExtend &&
        !g.hasExtendRequest &&
        g.departureTime - currentTime === 10
    )
    .forEach((guest: Guest) => {
      useGameStore.getState().updateGuest(guest.id, {
        hasExtendRequest: true,
      });

      const event: GameEvent = {
        id: generateId(),
        type: 'extend_request',
        time: currentTime,
        data: { guestId: guest.id, guestName: guest.name },
        message: `${guest.name} 申请续住`,
      };
      useGameStore.getState().addEvent(event);
    });
}

function processPresetEvents(level: LevelConfig, currentTime: number): void {
  const presetEvents = level.presetEvents.filter((e) => e.time === currentTime);

  presetEvents.forEach((presetEvent) => {
    const event: GameEvent = {
      id: generateId(),
      type: presetEvent.type,
      time: currentTime,
      data: presetEvent.data,
      message: presetEvent.message,
    };
    useGameStore.getState().addEvent(event);

    if (presetEvent.type === 'complaint') {
      useGameStore.getState().addComplaint();
      useGameStore.getState().addSatisfaction(-10);
      useGameStore.getState().addScore(-15);
    }
  });
}

function checkGameEndConditions(level: LevelConfig, currentTime: number): void {
  const state = useGameStore.getState();

  const gameOverCheck = checkGameOver(
    state.score,
    state.complaints,
    state.satisfaction,
    level.winConditions.maxComplaints,
    level.winConditions.minSatisfaction
  );

  if (gameOverCheck.gameOver) {
    useGameStore.getState().setStatus('settlement');
    useGameStore.getState().setFailReason(gameOverCheck.reason);
    return;
  }

  if (currentTime >= level.duration) {
    useGameStore.getState().setStatus('settlement');
  }
}

export function assignRoom(guestId: string, roomId: number): void {
  const state = useGameStore.getState();
  const guest = state.guests.find((g: Guest) => g.id === guestId);
  const room = state.rooms.find((r: Room) => r.id === roomId);

  if (!guest || !room) return;

  if (guest.arrivalTime > state.currentTime) {
    const event: GameEvent = {
      id: generateId(),
      type: 'complaint',
      time: state.currentTime,
      data: { guestId, roomId, violation: '客人尚未到达' },
      message: `${guest.name} 尚未到达，无法分配房间`,
    };
    useGameStore.getState().addEvent(event);
    return;
  }

  const check = canAssignRoom(room);

  if (!check.valid) {
    const event: GameEvent = {
      id: generateId(),
      type: 'complaint',
      time: state.currentTime,
      data: { guestId, roomId, violation: check.violation },
      message: check.violation || '违规操作',
    };
    useGameStore.getState().addEvent(event);

    if (check.complaint) {
      useGameStore.getState().addComplaint();
    }
    useGameStore.getState().addScore(check.scoreChange);
    useGameStore.getState().addSatisfaction(check.satisfactionChange);
    return;
  }

  useGameStore.getState().updateRoom(roomId, {
    status: 'occupied',
    guestId,
  });

  useGameStore.getState().updateGuest(guestId, {
    status: 'checked-in',
    roomId,
  });

  useGameStore.getState().addScore(check.scoreChange);
  useGameStore.getState().addSatisfaction(check.satisfactionChange);

  const action: PlayerAction = {
    type: 'assign_room',
    time: state.currentTime,
    data: { guestId, roomId },
  };

  recordHistory(action);
}

export function dispatchCleaner(cleanerId: string, roomId: number): void {
  const state = useGameStore.getState();
  const cleaner = state.cleaners.find((c: Cleaner) => c.id === cleanerId);
  const room = state.rooms.find((r: Room) => r.id === roomId);

  if (!cleaner || !room) return;

  const check = canDispatchCleaner(cleaner, room);

  if (!check.valid) {
    return;
  }

  useGameStore.getState().updateCleaner(cleanerId, {
    status: 'cleaning',
    currentRoomId: roomId,
    progress: 0,
  });

  const action: PlayerAction = {
    type: 'dispatch_cleaner',
    time: state.currentTime,
    data: { cleanerId, roomId },
  };

  recordHistory(action);
}

export function approveExtend(guestId: string): void {
  const state = useGameStore.getState();
  const guest = state.guests.find((g: Guest) => g.id === guestId);
  if (!guest || guest.roomId === undefined) return;

  const room = state.rooms.find((r: Room) => r.id === guest.roomId);
  const nextGuest = state.guests.find(
    (g: Guest) => g.status === 'waiting' && g.arrivalTime <= guest.departureTime + (guest.extendNights || 0)
  );

  const check = checkExtendRequest(guest, room, nextGuest);

  if (!check.valid) {
    useGameStore.getState().addScore(check.scoreChange);
    useGameStore.getState().addSatisfaction(check.satisfactionChange);
    return;
  }

  const extendNights = guest.extendNights || 5;
  useGameStore.getState().updateGuest(guestId, {
    departureTime: guest.departureTime + extendNights,
    hasExtendRequest: false,
  });

  useGameStore.getState().addScore(check.scoreChange);
  useGameStore.getState().addSatisfaction(check.satisfactionChange);

  const action: PlayerAction = {
    type: 'approve_extend',
    time: state.currentTime,
    data: { guestId, extendNights },
  };

  recordHistory(action);
}

export function rejectExtend(guestId: string): void {
  const state = useGameStore.getState();
  const guest = state.guests.find((g: Guest) => g.id === guestId);
  if (!guest) return;

  useGameStore.getState().updateGuest(guestId, {
    hasExtendRequest: false,
  });

  useGameStore.getState().addSatisfaction(-15);
  useGameStore.getState().addScore(-5);

  const action: PlayerAction = {
    type: 'reject_extend',
    time: state.currentTime,
    data: { guestId },
  };

  recordHistory(action);
}

export function markMaintenance(roomId: number): void {
  const state = useGameStore.getState();
  const room = state.rooms.find((r: Room) => r.id === roomId);

  if (!room || room.status === 'occupied') return;

  useGameStore.getState().updateRoom(roomId, {
    status: 'maintenance',
    maintenanceProgress: 0,
  });

  const action: PlayerAction = {
    type: 'mark_maintenance',
    time: state.currentTime,
    data: { roomId },
  };

  recordHistory(action);
}

export function resolveMaintenance(roomId: number): void {
  const state = useGameStore.getState();
  const room = state.rooms.find((r: Room) => r.id === roomId);

  if (!room || room.status !== 'maintenance') return;

  useGameStore.getState().updateRoom(roomId, {
    status: 'empty',
    maintenanceProgress: undefined,
  });

  const action: PlayerAction = {
    type: 'resolve_maintenance',
    time: state.currentTime,
    data: { roomId },
  };

  recordHistory(action);
}

function recordHistory(action?: PlayerAction): void {
  useGameStore.getState().recordHistory(action);
}

export function pauseGame(): void {
  useGameStore.getState().setStatus('paused');
}

export function resumeGame(): void {
  useGameStore.getState().setStatus('playing');
}

export function restartGame(): void {
  const state = useGameStore.getState();
  initializeGame(state.currentLevel);
}

export function returnToMenu(): void {
  useGameStore.getState().setStatus('menu');
}

export function startReplay(): void {
  const state = useGameStore.getState();
  if (state.history.length === 0) return;

  useGameStore.getState().setStatus('replay');
  useGameStore.getState().setReplayIndex(0);
  useGameStore.getState().loadSnapshot(state.history[0].snapshot);
}

export function replayStep(step: number): void {
  const state = useGameStore.getState();
  const newIndex = Math.max(0, Math.min(state.history.length - 1, state.replayIndex + step));

  if (newIndex !== state.replayIndex) {
    useGameStore.getState().setReplayIndex(newIndex);
    useGameStore.getState().loadSnapshot(state.history[newIndex].snapshot);
  }
}

export function stopReplay(): void {
  const state = useGameStore.getState();
  if (state.history.length > 0) {
    useGameStore.getState().loadSnapshot(state.history[state.history.length - 1].snapshot);
  }
  useGameStore.getState().setStatus('settlement');
}
