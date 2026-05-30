import { create } from 'zustand'
import {
  Table, Waiter, Task, RiskRecord, DecisionLog, GameSnapshot, GameResult,
  TableStatus, RiskCategory, RecordStatus, DecisionType, TaskType, WaiterState,
  Position,
  DELIVERY_TIMEOUT_MS, CLEAN_DEADLINE_MS, EATING_DURATION_MS, GAME_DURATION_MS, WAITER_SPEED,
} from '@/types'

interface GameState {
  gameStarted: boolean
  gamePaused: boolean
  gameOver: boolean
  gameTime: number
  tables: Table[]
  waiters: Waiter[]
  tasks: Task[]
  riskRecords: RiskRecord[]
  decisionLogs: DecisionLog[]
  snapshots: GameSnapshot[]
  gameResult: GameResult | null
  selectedWaiterId: string | null
  selectedTableId: string | null
  riskDashboardOpen: boolean
  activeRiskFilter: RiskCategory | 'all'

  startGame: () => void
  pauseGame: () => void
  resumeGame: () => void
  tick: (deltaMs: number) => void
  selectWaiter: (id: string | null) => void
  selectTable: (id: string | null) => void
  assignTask: (waiterId: string, taskId: string) => void
  setTaskPriority: (taskId: string, priority: number) => void
  toggleRiskDashboard: () => void
  setRiskFilter: (filter: RiskCategory | 'all') => void
  updateRecordStatus: (recordId: string, status: RecordStatus, returnReason?: string) => void
  saveSnapshot: (event: string) => void
  endGame: () => void
  resetGame: () => void
}

const KITCHEN_POS: Position = { x: -6, z: 0 }
const DISH_AREA_POS: Position = { x: 6, z: -3 }

const INITIAL_TABLES: Table[] = [
  { id: 't1', position: { x: -3, z: -2 }, status: 'idle', orderTime: null, finishTime: null, cleanDeadline: null, seatCount: 4 },
  { id: 't2', position: { x: -3, z: 2 }, status: 'idle', orderTime: null, finishTime: null, cleanDeadline: null, seatCount: 2 },
  { id: 't3', position: { x: 0, z: -2 }, status: 'idle', orderTime: null, finishTime: null, cleanDeadline: null, seatCount: 4 },
  { id: 't4', position: { x: 0, z: 2 }, status: 'idle', orderTime: null, finishTime: null, cleanDeadline: null, seatCount: 2 },
  { id: 't5', position: { x: 3, z: -2 }, status: 'idle', orderTime: null, finishTime: null, cleanDeadline: null, seatCount: 6 },
  { id: 't6', position: { x: 3, z: 2 }, status: 'idle', orderTime: null, finishTime: null, cleanDeadline: null, seatCount: 4 },
]

const INITIAL_WAITERS: Waiter[] = [
  { id: 'w1', position: { x: -5, z: 0 }, state: 'idle', currentTask: null, path: [], pathIndex: 0, carryingFood: false, carryingDishes: false },
  { id: 'w2', position: { x: -5, z: 1 }, state: 'idle', currentTask: null, path: [], pathIndex: 0, carryingFood: false, carryingDishes: false },
  { id: 'w3', position: { x: -5, z: -1 }, state: 'idle', currentTask: null, path: [], pathIndex: 0, carryingFood: false, carryingDishes: false },
]

let idCounter = 0
const genId = (prefix: string) => `${prefix}_${++idCounter}`

function buildPath(from: Position, to: Position): Position[] {
  const waypoints: Position[] = [{ ...from }]
  const midZ = from.z
  waypoints.push({ x: from.x, z: midZ })
  if (Math.abs(to.x - from.x) > 0.1) {
    waypoints.push({ x: to.x, z: midZ })
  }
  waypoints.push({ x: to.x, z: to.z })
  return waypoints
}

function checkRouteCrossing(waiters: Waiter[], deliverWaiter: Waiter): boolean {
  const deliverPath = deliverWaiter.path
  if (deliverPath.length < 2) return false

  for (const w of waiters) {
    if (w.id === deliverWaiter.id || w.path.length < 2) continue
    if (w.state === 'idle') continue

    const isClearing = w.carryingDishes || w.state === 'clearing' || w.state === 'moving_to_table_clear'
    const isDelivering = deliverWaiter.carryingFood || deliverWaiter.state === 'delivering'

    if (isClearing && isDelivering) {
      for (let i = 0; i < deliverPath.length - 1; i++) {
        for (let j = 0; j < w.path.length - 1; j++) {
          if (segmentsIntersect(deliverPath[i], deliverPath[i + 1], w.path[j], w.path[j + 1])) {
            return true
          }
        }
      }
    }
  }
  return false
}

function segmentsIntersect(a1: Position, a2: Position, b1: Position, b2: Position): boolean {
  const d1x = a2.x - a1.x, d1z = a2.z - a1.z
  const d2x = b2.x - b1.x, d2z = b2.z - b1.z
  const cross = d1x * d2z - d1z * d2x
  if (Math.abs(cross) < 0.001) return false
  const t = ((b1.x - a1.x) * d2z - (b1.z - a1.z) * d2x) / cross
  const u = ((b1.x - a1.x) * d1z - (b1.z - a1.z) * d1x) / cross
  return t > 0.05 && t < 0.95 && u > 0.05 && u < 0.95
}

function moveAlongPath(waiter: Waiter, speed: number): boolean {
  if (waiter.pathIndex >= waiter.path.length - 1) return true
  const target = waiter.path[waiter.pathIndex + 1]
  const dx = target.x - waiter.position.x
  const dz = target.z - waiter.position.z
  const dist = Math.sqrt(dx * dx + dz * dz)
  if (dist < speed) {
    waiter.position = { ...target }
    waiter.pathIndex++
    return waiter.pathIndex >= waiter.path.length - 1
  }
  waiter.position = {
    x: waiter.position.x + (dx / dist) * speed,
    z: waiter.position.z + (dz / dist) * speed,
  }
  return false
}

export const useGameStore = create<GameState>((set, get) => ({
  gameStarted: false,
  gamePaused: false,
  gameOver: false,
  gameTime: 0,
  tables: INITIAL_TABLES.map(t => ({ ...t })),
  waiters: INITIAL_WAITERS.map(w => ({ ...w })),
  tasks: [],
  riskRecords: [],
  decisionLogs: [],
  snapshots: [],
  gameResult: null,
  selectedWaiterId: null,
  selectedTableId: null,
  riskDashboardOpen: false,
  activeRiskFilter: 'all',

  startGame: () => {
    idCounter = 0
    set({
      gameStarted: true,
      gamePaused: false,
      gameOver: false,
      gameTime: 0,
      tables: INITIAL_TABLES.map(t => ({ ...t })),
      waiters: INITIAL_WAITERS.map(w => ({ ...w })),
      tasks: [],
      riskRecords: [],
      decisionLogs: [],
      snapshots: [],
      gameResult: null,
      selectedWaiterId: null,
      selectedTableId: null,
    })
  },

  pauseGame: () => set({ gamePaused: true }),
  resumeGame: () => set({ gamePaused: false }),

  tick: (deltaMs: number) => {
    const state = get()
    if (!state.gameStarted || state.gamePaused || state.gameOver) return

    const newTime = state.gameTime + deltaMs
    const tables = state.tables.map(t => ({ ...t }))
    const waiters = state.waiters.map(w => ({ ...w }))
    const tasks = state.tasks.map(t => ({ ...t }))
    const riskRecords = [...state.riskRecords]
    const decisionLogs = [...state.decisionLogs]
    const snapshots = [...state.snapshots]
    let routeCrossPenalty = state.gameResult?.routeCrossPenalty ?? 0
    let timeoutPenalty = state.gameResult?.timeoutPenalty ?? 0
    let missedCleanPenalty = state.gameResult?.missedCleanPenalty ?? 0

    if (Math.random() < deltaMs / 2000 && tables.filter(t => t.status === 'idle').length > 0) {
      const idleTables = tables.filter(t => t.status === 'idle')
      const table = idleTables[Math.floor(Math.random() * idleTables.length)]
      if (table) {
        table.status = 'ordered'
        table.orderTime = newTime
        const task: Task = {
          id: genId('task'),
          type: 'deliver',
          tableId: table.id,
          waiterId: null,
          priority: tasks.filter(t => !t.completed).length + 1,
          createdAt: newTime,
          deadline: newTime + DELIVERY_TIMEOUT_MS,
          completed: false,
        }
        tasks.push(task)
      }
    }

    for (const table of tables) {
      if (table.status === 'ordered' && table.orderTime && newTime - table.orderTime > DELIVERY_TIMEOUT_MS) {
        const existing = riskRecords.find(r => r.category === 'delivery_timeout' && r.tableId === table.id && r.timestamp > table.orderTime!)
        if (!existing) {
          const task = tasks.find(t => t.tableId === table.id && t.type === 'deliver' && !t.completed)
          const explanation = task?.waiterId
            ? `服务员${task.waiterId}配送桌位${table.id}超时${Math.round((newTime - table.orderTime - DELIVERY_TIMEOUT_MS) / 1000)}秒，路线拥堵导致延迟`
            : `桌位${table.id}出餐超时${Math.round((newTime - table.orderTime - DELIVERY_TIMEOUT_MS) / 1000)}秒，无可用服务员`
          riskRecords.push({
            id: genId('risk'),
            category: 'delivery_timeout',
            status: 'processed',
            description: `桌位${table.id}出餐超时`,
            explanation,
            decisionType: 'time_pressure',
            timestamp: newTime,
            snapshotId: genId('snap'),
            tableId: table.id,
            severity: Math.min(5, Math.floor((newTime - table.orderTime - DELIVERY_TIMEOUT_MS) / 5000) + 1),
          })
          timeoutPenalty += 10
        }
      }

      if (table.status === 'eating' && table.finishTime && newTime - table.finishTime > EATING_DURATION_MS) {
        table.status = 'needs_clearing'
        table.cleanDeadline = newTime + CLEAN_DEADLINE_MS
        const task: Task = {
          id: genId('task'),
          type: 'clear',
          tableId: table.id,
          waiterId: null,
          priority: tasks.filter(t => !t.completed).length + 1,
          createdAt: newTime,
          deadline: newTime + CLEAN_DEADLINE_MS,
          completed: false,
        }
        tasks.push(task)
      }

      if (table.status === 'needs_clearing' && table.cleanDeadline && newTime > table.cleanDeadline) {
        const existing = riskRecords.find(r => r.category === 'missed_cleaning' && r.tableId === table.id && r.timestamp > (newTime - CLEAN_DEADLINE_MS))
        if (!existing) {
          riskRecords.push({
            id: genId('risk'),
            category: 'missed_cleaning',
            status: 'pending',
            description: `桌位${table.id}清洁漏做`,
            explanation: `桌位${table.id}收台超时${Math.round((newTime - table.cleanDeadline!) / 1000)}秒，影响翻台效率`,
            decisionType: 'task_priority',
            timestamp: newTime,
            snapshotId: genId('snap'),
            tableId: table.id,
            severity: Math.min(5, Math.floor((newTime - table.cleanDeadline!) / 5000) + 1),
          })
          missedCleanPenalty += 15
        }
      }
    }

    for (const waiter of waiters) {
      if (waiter.state === 'idle') continue

      const arrived = moveAlongPath(waiter, WAITER_SPEED * deltaMs)

      if (arrived) {
        if (waiter.state === 'moving_to_kitchen') {
          waiter.state = 'picking_up'
          waiter.carryingFood = true
          const task = tasks.find(t => t.waiterId === waiter.id && t.type === 'deliver' && !t.completed)
          if (task) {
            const table = tables.find(t => t.id === task.tableId)
            if (table) {
              waiter.path = buildPath(KITCHEN_POS, table.position)
              waiter.pathIndex = 0
              waiter.state = 'delivering'

              if (checkRouteCrossing(waiters, waiter)) {
                const existing = riskRecords.find(r => r.category === 'route_cross' && r.waiterId === waiter.id && newTime - r.timestamp < 3000)
                if (!existing) {
                  riskRecords.push({
                    id: genId('risk'),
                    category: 'route_cross',
                    status: 'pending',
                    description: `服务员${waiter.id}出餐路线与收台路线交叉`,
                    explanation: `服务员${waiter.id}前往桌位${task.tableId}的出餐路线与收台路线交叉，可能导致碰撞和拥堵`,
                    decisionType: 'path_planning',
                    timestamp: newTime,
                    snapshotId: genId('snap'),
                    waiterId: waiter.id,
                    tableId: task.tableId,
                    severity: 2,
                  })
                  routeCrossPenalty += 5
                }
              }
            }
          }
        } else if (waiter.state === 'delivering') {
          const task = tasks.find(t => t.waiterId === waiter.id && t.type === 'deliver' && !t.completed)
          if (task) {
            task.completed = true
            const table = tables.find(t => t.id === task.tableId)
            if (table) {
              table.status = 'eating'
              table.finishTime = newTime
            }
          }
          waiter.carryingFood = false
          waiter.currentTask = null
          waiter.state = 'idle'
          waiter.path = []
          waiter.pathIndex = 0
        } else if (waiter.state === 'moving_to_table_clear') {
          waiter.state = 'clearing'
          waiter.carryingDishes = true
          const task = tasks.find(t => t.waiterId === waiter.id && t.type === 'clear' && !t.completed)
          if (task) {
            const table = tables.find(t => t.id === task.tableId)
            if (table) table.status = 'clearing'
          }
          waiter.path = buildPath(waiter.position, DISH_AREA_POS)
          waiter.pathIndex = 0
          waiter.state = 'returning'

          if (checkRouteCrossing(waiters, waiter)) {
            const existing = riskRecords.find(r => r.category === 'route_cross' && r.waiterId === waiter.id && newTime - r.timestamp < 3000)
            if (!existing) {
              riskRecords.push({
                id: genId('risk'),
                category: 'route_cross',
                status: 'pending',
                description: `服务员${waiter.id}收台路线与出餐路线交叉`,
                explanation: `服务员${waiter.id}从桌位前往收台区的路线与出餐路线交叉，增加了碰撞风险`,
                decisionType: 'path_planning',
                timestamp: newTime,
                snapshotId: genId('snap'),
                waiterId: waiter.id,
                severity: 2,
              })
              routeCrossPenalty += 5
            }
          }
        } else if (waiter.state === 'returning') {
          const task = tasks.find(t => t.waiterId === waiter.id && t.type === 'clear' && !t.completed)
          if (task) {
            task.completed = true
            const table = tables.find(t => t.id === task.tableId)
            if (table) {
              table.status = 'idle'
              table.orderTime = null
              table.finishTime = null
              table.cleanDeadline = null
            }
          }
          waiter.carryingDishes = false
          waiter.currentTask = null
          waiter.state = 'idle'
          waiter.path = []
          waiter.pathIndex = 0
        }
      }
    }

    const isGameOver = newTime >= GAME_DURATION_MS

    set({
      gameTime: newTime,
      tables,
      waiters,
      tasks,
      riskRecords,
      decisionLogs,
      snapshots,
      gameOver: isGameOver,
      gameResult: isGameOver ? {
        id: genId('game'),
        startTime: 0,
        endTime: newTime,
        score: Math.max(0, 1000 - routeCrossPenalty - timeoutPenalty - missedCleanPenalty),
        routeCrossPenalty,
        timeoutPenalty,
        missedCleanPenalty,
        totalRisks: riskRecords.length,
        decisionsCount: decisionLogs.length,
      } : state.gameResult,
    })
  },

  selectWaiter: (id) => set({ selectedWaiterId: id }),
  selectTable: (id) => set({ selectedTableId: id }),

  assignTask: (waiterId, taskId) => {
    const state = get()
    const waiter = state.waiters.find(w => w.id === waiterId)
    const task = state.tasks.find(t => t.id === taskId)
    if (!waiter || !task || waiter.state !== 'idle') return

    const table = state.tables.find(t => t.id === task.tableId)
    if (!table) return

    const updatedWaiters = state.waiters.map(w => {
      if (w.id !== waiterId) return w
      if (task.type === 'deliver') {
        const path = buildPath(w.position, KITCHEN_POS)
        return {
          ...w,
          state: 'moving_to_kitchen' as WaiterState,
          currentTask: task,
          path,
          pathIndex: 0,
          carryingFood: false,
        }
      } else {
        const path = buildPath(w.position, table.position)
        return {
          ...w,
          state: 'moving_to_table_clear' as WaiterState,
          currentTask: task,
          path,
          pathIndex: 0,
          carryingDishes: false,
        }
      }
    })

    const updatedTasks = state.tasks.map(t =>
      t.id === taskId ? { ...t, waiterId } : t
    )

    const tableLabel = task.tableId
    const taskLabel = task.type === 'deliver' ? '出餐' : '收台'
    const reason = task.type === 'deliver'
      ? `优先为桌位${tableLabel}出餐`
      : `优先为桌位${tableLabel}收台`

    const decisionLog: DecisionLog = {
      id: genId('dec'),
      decisionType: state.gameTime > GAME_DURATION_MS * 0.7 ? 'time_pressure' : 'task_priority',
      reason,
      consequence: task.type === 'deliver' ? `服务员${waiterId}前往厨房取餐` : `服务员${waiterId}前往桌位${tableLabel}收台`,
      timestamp: state.gameTime,
      taskId: task.id,
      waiterId,
    }

    set({
      waiters: updatedWaiters,
      tasks: updatedTasks,
      decisionLogs: [...state.decisionLogs, decisionLog],
      selectedWaiterId: null,
      selectedTableId: null,
    })
  },

  setTaskPriority: (taskId, priority) => {
    set(state => ({
      tasks: state.tasks.map(t => t.id === taskId ? { ...t, priority } : t),
    }))
  },

  toggleRiskDashboard: () => set(state => ({ riskDashboardOpen: !state.riskDashboardOpen })),
  setRiskFilter: (filter) => set({ activeRiskFilter: filter }),

  updateRecordStatus: (recordId, status, returnReason?) => {
    set(state => ({
      riskRecords: state.riskRecords.map(r =>
        r.id === recordId ? { ...r, status, returnReason: returnReason || r.returnReason } : r
      ),
    }))
  },

  saveSnapshot: (event) => {
    const state = get()
    const snapshot = {
      id: genId('snap'),
      timestamp: state.gameTime,
      tables: state.tables.map(t => ({ ...t })),
      waiters: state.waiters.map(w => ({ ...w })),
      tasks: state.tasks.map(t => ({ ...t })),
      event,
    }
    set({ snapshots: [...state.snapshots, snapshot] })
  },

  endGame: () => {
    const state = get()
    const routeCrossPenalty = state.riskRecords.filter(r => r.category === 'route_cross').length * 5
    const timeoutPenalty = state.riskRecords.filter(r => r.category === 'delivery_timeout').length * 10
    const missedCleanPenalty = state.riskRecords.filter(r => r.category === 'missed_cleaning').length * 15
    set({
      gameOver: true,
      gameResult: {
        id: genId('game'),
        startTime: 0,
        endTime: state.gameTime,
        score: Math.max(0, 1000 - routeCrossPenalty - timeoutPenalty - missedCleanPenalty),
        routeCrossPenalty,
        timeoutPenalty,
        missedCleanPenalty,
        totalRisks: state.riskRecords.length,
        decisionsCount: state.decisionLogs.length,
      },
    })
  },

  resetGame: () => {
    idCounter = 0
    set({
      gameStarted: false,
      gamePaused: false,
      gameOver: false,
      gameTime: 0,
      tables: INITIAL_TABLES.map(t => ({ ...t })),
      waiters: INITIAL_WAITERS.map(w => ({ ...w })),
      tasks: [],
      riskRecords: [],
      decisionLogs: [],
      snapshots: [],
      gameResult: null,
      selectedWaiterId: null,
      selectedTableId: null,
      riskDashboardOpen: false,
      activeRiskFilter: 'all',
    })
  },
}))

export { KITCHEN_POS, DISH_AREA_POS }
