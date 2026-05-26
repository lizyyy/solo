import { create } from 'zustand';
import type {
  Order,
  PrepStation,
  PickupWindow,
  ActionRecord,
  ErrorRecord,
  GameSession,
  LevelConfig,
  FrameSnapshot,
  ScoreBreakdown,
} from '../game/types';
import { LEVELS } from '../game/levels';
import { generateOrders, checkAllergenMismatch } from '../game/orders';
import {
  SCORE_CONFIG,
  calculateComboBonus,
  calculateScoreBreakdown,
  determineResult,
  generateErrorRecord,
  generateActionRecord,
} from '../game/scoring';

interface GameState {
  phase: 'menu' | 'playing' | 'paused' | 'ended';
  currentLevel: LevelConfig | null;
  currentSessionId: string | null;

  gameTime: number;
  remainingTime: number;
  timeScale: number;
  isPaused: boolean;

  orders: Order[];
  ordersForPrep: Order[];
  ordersForPickup: Order[];
  completedOrders: Order[];

  prepStations: PrepStation[];
  pickupWindows: PickupWindow[];

  score: number;
  combo: number;
  correctCount: number;
  errorCount: number;
  maxCombo: number;

  actions: ActionRecord[];
  errors: ErrorRecord[];
  sessions: GameSession[];

  frameSnapshots: FrameSnapshot[];
  draggedMeal: string | null;

  setPhase: (phase: GameState['phase']) => void;
  setDraggedMeal: (mealId: string | null) => void;

  startGame: (levelId: string) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  tick: (deltaTime: number) => void;
  placeMeal: (orderId: string, stationId: string) => void;
  assignPickup: (orderId: string) => void;
  endGame: () => void;
  resetGame: () => void;

  loadSessions: () => void;
  saveSession: (session: GameSession) => void;
  getSession: (sessionId: string) => GameSession | null;
  getScoreBreakdown: () => ScoreBreakdown;

  playSuccessSound: () => void;
  playErrorSound: () => void;
}

function initializeWindows(count: number): PickupWindow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `window_${i + 1}`,
    name: `取餐窗口 ${i + 1}`,
    queue: [],
    maxQueue: 5,
  }));
}

function initializeStations(): PrepStation[] {
  return [
    { id: 'station_1', grade: 1, capacity: 5, meals: [] },
    { id: 'station_2', grade: 2, capacity: 5, meals: [] },
    { id: 'station_3', grade: 3, capacity: 5, meals: [] },
  ];
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'menu',
  currentLevel: null,
  currentSessionId: null,

  gameTime: 0,
  remainingTime: 0,
  timeScale: 1,
  isPaused: false,

  orders: [],
  ordersForPrep: [],
  ordersForPickup: [],
  completedOrders: [],

  prepStations: initializeStations(),
  pickupWindows: [],

  score: 0,
  combo: 0,
  correctCount: 0,
  errorCount: 0,
  maxCombo: 0,

  actions: [],
  errors: [],
  sessions: [],

  frameSnapshots: [],
  draggedMeal: null,

  setPhase: (phase) => set({ phase }),
  setDraggedMeal: (mealId) => set({ draggedMeal: mealId }),

  startGame: (levelId) => {
    const level = LEVELS.find(l => l.id === levelId);
    if (!level) return;

    const windows = initializeWindows(level.windowCount);
    const orders = generateOrders(level.orderCount, level.allergenRatio, level.durationSeconds, windows);
    const sessionId = `session_${Date.now()}`;

    set({
      phase: 'playing',
      currentLevel: level,
      currentSessionId: sessionId,
      gameTime: 0,
      remainingTime: level.durationSeconds,
      timeScale: 1,
      isPaused: false,
      orders,
      ordersForPrep: orders.filter(o => o.createdAt <= 0 && o.pickupTime <= 15),
      ordersForPickup: [],
      completedOrders: [],
      prepStations: initializeStations(),
      pickupWindows: windows,
      score: 0,
      combo: 0,
      correctCount: 0,
      errorCount: 0,
      maxCombo: 0,
      actions: [],
      errors: [],
      frameSnapshots: [],
      draggedMeal: null,
    });
  },

  pauseGame: () => set({ isPaused: true, phase: 'paused' }),
  resumeGame: () => set({ isPaused: false, phase: 'playing' }),

  tick: (deltaTime) => {
    const state = get();
    if (state.phase !== 'playing' || state.isPaused) return;

    const newGameTime = state.gameTime + deltaTime * state.timeScale;
    const newRemainingTime = Math.max(0, state.remainingTime - deltaTime * state.timeScale);

    const updatedOrders = state.orders.map(order => {
      if (order.status === 'pending') {
        if (order.expiresAt <= newGameTime) {
          return { ...order, status: 'expired' as const };
        }
      }
      return order;
    });

    const newOrdersForPrep = updatedOrders.filter(
      o => o.status === 'pending' && o.createdAt <= newGameTime && o.pickupTime <= newGameTime + 15
    );

    const newOrdersForPickup = updatedOrders.filter(
      o => (o.status === 'preparing' || o.status === 'ready' || o.status === 'picking')
    );

    let congestionPenalty = 0;
    const congestionErrors: ErrorRecord[] = [];
    const updatedWindows = state.pickupWindows.map(window => {
      if (window.queue.length > window.maxQueue && Math.random() < 0.02) {
        congestionPenalty += SCORE_CONFIG.penalties.windowCongestion;
        congestionErrors.push(
          generateErrorRecord(
            state.currentSessionId!,
            'window_congestion',
            `${window.name}拥堵严重（${window.queue.length}人等待）`,
            newGameTime
          )
        );
      }
      return window;
    });

    if (congestionPenalty > 0) {
      set(prev => ({
        score: prev.score - congestionPenalty,
        combo: 0,
        errors: [...prev.errors, ...congestionErrors],
      }));
    }

    const snapshot: FrameSnapshot = {
      gameTime: newGameTime,
      orders: updatedOrders.map(o => ({
        id: o.id,
        status: o.status,
        studentName: o.student.name,
        mealName: o.meal.name,
      })),
      prepStations: state.prepStations.map(s => ({ id: s.id, meals: [...s.meals] })),
      pickupWindows: updatedWindows.map(w => ({ id: w.id, queue: [...w.queue] })),
      score: get().score,
      combo: get().combo,
    };

    set(prev => ({
      gameTime: newGameTime,
      remainingTime: newRemainingTime,
      orders: updatedOrders,
      ordersForPrep: newOrdersForPrep,
      ordersForPickup: newOrdersForPickup,
      pickupWindows: updatedWindows,
      frameSnapshots: [...prev.frameSnapshots, snapshot],
    }));

    if (newRemainingTime <= 0) {
      get().endGame();
    }
  },

  placeMeal: (orderId, stationId) => {
    const state = get();
    const order = state.orders.find(o => o.id === orderId);
    const station = state.prepStations.find(s => s.id === stationId);

    if (!order || !station) return;
    if (order.status !== 'pending') return;
    if (order.meal.grade !== station.grade) {
      const error = generateErrorRecord(
        state.currentSessionId!,
        'wrong_grade',
        `${order.student.name}的${order.meal.name}应放到${order.meal.grade}年级备餐台`,
        state.gameTime
      );
      set(prev => ({
        score: prev.score - SCORE_CONFIG.penalties.wrongGrade,
        combo: 0,
        errorCount: prev.errorCount + 1,
        errors: [...prev.errors, error],
        actions: [...prev.actions, generateActionRecord(state.currentSessionId!, 'error', state.gameTime, { orderId, targetId: stationId, success: false })],
      }));
      get().playErrorSound();
      return;
    }

    if (checkAllergenMismatch(order.meal, order.student)) {
      const error = generateErrorRecord(
        state.currentSessionId!,
        'allergen_mismatch',
        `${order.student.name}对${order.meal.containsAllergens.join('、')}过敏，${order.meal.name}含有过敏原`,
        state.gameTime
      );
      set(prev => ({
        score: prev.score - SCORE_CONFIG.penalties.allergenMismatch,
        combo: 0,
        errorCount: prev.errorCount + 1,
        errors: [...prev.errors, error],
        orders: prev.orders.map(o => o.id === orderId ? { ...o, status: 'failed' } : o),
        actions: [...prev.actions, generateActionRecord(state.currentSessionId!, 'error', state.gameTime, { orderId, targetId: stationId, success: false })],
      }));
      get().playErrorSound();
      return;
    }

    if (station.meals.length >= station.capacity) {
      const wasteError = generateErrorRecord(
        state.currentSessionId!,
        'food_waste',
        `${station.grade}年级备餐台已满，产生浪费`,
        state.gameTime
      );
      set(prev => ({
        score: prev.score - SCORE_CONFIG.penalties.foodWaste,
        combo: 0,
        errorCount: prev.errorCount + 1,
        errors: [...prev.errors, wasteError],
      }));
      return;
    }

    const newCombo = state.combo + 1;
    const comboBonus = calculateComboBonus(newCombo);

    set(prev => ({
      score: prev.score + SCORE_CONFIG.correctPrep + comboBonus,
      combo: newCombo,
      maxCombo: Math.max(prev.maxCombo, newCombo),
      correctCount: prev.correctCount + 1,
      orders: prev.orders.map(o => o.id === orderId ? { ...o, status: 'preparing' } : o),
      prepStations: prev.prepStations.map(s =>
        s.id === stationId ? { ...s, meals: [...s.meals, order.meal.id] } : s
      ),
      actions: [...prev.actions, generateActionRecord(state.currentSessionId!, 'place_meal', state.gameTime, { orderId, mealId: order.meal.id, targetId: stationId })],
    }));

    get().playSuccessSound();
  },

  assignPickup: (orderId) => {
    const state = get();
    const order = state.orders.find(o => o.id === orderId);
    if (!order || (order.status !== 'preparing' && order.status !== 'ready' && order.status !== 'picking')) return;

    const windowId = order.pickupWindowId;
    const window = state.pickupWindows.find(w => w.id === windowId);
    if (!window) return;

    if (order.status === 'picking') {
      set(prev => ({
        score: prev.score + SCORE_CONFIG.correctPickup,
        correctCount: prev.correctCount + 1,
        orders: prev.orders.map(o => o.id === orderId ? { ...o, status: 'completed' } : o),
        completedOrders: [...prev.completedOrders, order],
        prepStations: prev.prepStations.map(s => ({
          ...s,
          meals: s.meals.filter(m => m !== order.meal.id),
        })),
        pickupWindows: prev.pickupWindows.map(w =>
          w.id === windowId ? { ...w, queue: w.queue.filter(q => q !== orderId) } : w
        ),
        actions: [...prev.actions, generateActionRecord(state.currentSessionId!, 'complete_order', state.gameTime, { orderId, targetId: windowId })],
      }));
      get().playSuccessSound();
      return;
    }

    if (order.status === 'preparing' || order.status === 'ready') {
      if (order.pickupTime + 20 < state.gameTime) {
        const timeoutError = generateErrorRecord(
          state.currentSessionId!,
          'pickup_timeout',
          `${order.student.name}取餐超时，已过取餐时间`,
          state.gameTime
        );
        set(prev => ({
          score: prev.score - SCORE_CONFIG.penalties.pickupTimeout,
          combo: 0,
          errorCount: prev.errorCount + 1,
          errors: [...prev.errors, timeoutError],
          orders: prev.orders.map(o => o.id === orderId ? { ...o, status: 'expired' } : o),
          prepStations: prev.prepStations.map(s => ({
            ...s,
            meals: s.meals.filter(m => m !== order.meal.id),
          })),
        }));
        get().playErrorSound();
        return;
      }

      set(prev => ({
        orders: prev.orders.map(o => o.id === orderId ? { ...o, status: 'picking' } : o),
        pickupWindows: prev.pickupWindows.map(w =>
          w.id === windowId && !w.queue.includes(orderId)
            ? { ...w, queue: [...w.queue, orderId] }
            : w
        ),
        actions: [...prev.actions, generateActionRecord(state.currentSessionId!, 'assign_pickup', state.gameTime, { orderId, targetId: windowId })],
      }));
    }
  },

  endGame: () => {
    const state = get();
    if (!state.currentLevel || !state.currentSessionId) return;

    const session: GameSession = {
      id: state.currentSessionId,
      levelId: state.currentLevel.id,
      levelName: state.currentLevel.name,
      startTime: Date.now() - state.currentLevel.durationSeconds * 1000,
      endTime: Date.now(),
      totalScore: state.score,
      result: determineResult({ ...state, totalScore: state.score } as unknown as GameSession, state.currentLevel.targetScore),
      correctCount: state.correctCount,
      errorCount: state.errorCount,
      allergenMismatches: state.errors.filter(e => e.errorType === 'allergen_mismatch').length,
      pickupTimeouts: state.errors.filter(e => e.errorType === 'pickup_timeout').length,
      congestions: state.errors.filter(e => e.errorType === 'window_congestion').length,
      wastes: state.errors.filter(e => e.errorType === 'food_waste').length,
      maxCombo: state.maxCombo,
      actions: state.actions,
      errors: state.errors,
    };

    get().saveSession(session);

    set({
      phase: 'ended',
      isPaused: true,
    });
  },

  resetGame: () => {
    set({
      phase: 'menu',
      currentLevel: null,
      currentSessionId: null,
      gameTime: 0,
      remainingTime: 0,
      timeScale: 1,
      isPaused: false,
      orders: [],
      ordersForPrep: [],
      ordersForPickup: [],
      completedOrders: [],
      prepStations: initializeStations(),
      pickupWindows: [],
      score: 0,
      combo: 0,
      correctCount: 0,
      errorCount: 0,
      maxCombo: 0,
      actions: [],
      errors: [],
      frameSnapshots: [],
      draggedMeal: null,
    });
  },

  loadSessions: () => {
    try {
      const stored = localStorage.getItem('canteen_sessions');
      if (stored) {
        set({ sessions: JSON.parse(stored) });
      }
    } catch {
      console.warn('Failed to load sessions');
    }
  },

  saveSession: (session) => {
    set(prev => {
      const sessions = [session, ...prev.sessions.filter(s => s.id !== session.id)].slice(0, 50);
      try {
        localStorage.setItem('canteen_sessions', JSON.stringify(sessions));
      } catch {
        console.warn('Failed to save session');
      }
      return { sessions };
    });
  },

  getSession: (sessionId) => {
    return get().sessions.find(s => s.id === sessionId) || null;
  },

  getScoreBreakdown: () => {
    const state = get();
    const total = state.correctCount + state.errorCount;
    if (total === 0) {
      return { prepAccuracy: 0, pickupTimeliness: 0, allergenAvoidance: 0, wasteRatio: 0 };
    }
    return calculateScoreBreakdown({
      ...state,
      totalScore: state.score,
    } as GameSession);
  },

  playSuccessSound: () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch { /* ignore */ }
  },

  playErrorSound: () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch { /* ignore */ }
  },
}));