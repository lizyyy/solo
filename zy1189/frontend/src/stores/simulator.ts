import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { Scheduler } from '@/core/scheduler'
import { ReportGenerator } from '@/core/reportGenerator'
import { createTask, cloneTask } from '@/core/utils'
import { SAMPLE_WORKLOADS } from '@/core/samples'
import { 
  Task, 
  TaskType, 
  Instruction, 
  Event, 
  Snapshot, 
  SimulationConfig,
  Experiment,
  Workload,
  AnalysisReport
} from '@/types'

export const useSimulatorStore = defineStore('simulator', () => {
  const scheduler = ref<Scheduler>(new Scheduler())
  const currentExperiment = ref<Experiment | null>(null)
  const selectedTaskId = ref<string | null>(null)
  const selectedEventId = ref<string | null>(null)
  const isAutoRunning = ref(false)
  const autoRunSpeed = ref(500)
  const autoRunTimer = ref<number | null>(null)

  const tasks = computed(() => scheduler.value.getTasks())
  const events = computed(() => scheduler.value.getEvents())
  const snapshots = computed(() => scheduler.value.getSnapshots())
  const tick = computed(() => scheduler.value.getTick())
  const config = computed(() => scheduler.value.getConfig())
  const readyQueue = computed(() => scheduler.value.getReadyQueue())
  const blockedQueue = computed(() => scheduler.value.getBlockedQueue())
  const runningTask = computed(() => scheduler.value.getRunningTask())

  const selectedTask = computed(() => {
    if (!selectedTaskId.value) return null
    return tasks.value.find(t => t.id === selectedTaskId.value) || null
  })

  const selectedEvent = computed(() => {
    if (!selectedEventId.value) return null
    return events.value.find(e => e.id === selectedEventId.value) || null
  })

  const initFromWorkload = (workload: Workload): void => {
    scheduler.value = new Scheduler(workload.config)
    
    workload.tasks.forEach(wlTask => {
      const task = createTask(
        wlTask.name,
        wlTask.type,
        wlTask.instructions,
        wlTask.priority,
        wlTask.parentTask
      )
      scheduler.value.addTask(task)
    })
    
    resetSelection()
  }

  const loadSampleWorkload = (index: number): void => {
    if (index >= 0 && index < SAMPLE_WORKLOADS.length) {
      initFromWorkload(SAMPLE_WORKLOADS[index])
    }
  }

  const addTask = (
    name: string,
    type: TaskType,
    instructions: Instruction[],
    priority: number = 1
  ): Task => {
    const task = createTask(name, type, instructions, priority)
    scheduler.value.addTask(task)
    return cloneTask(task)
  }

  const removeTask = (id: string): boolean => {
    if (selectedTaskId.value === id) {
      selectedTaskId.value = null
    }
    return scheduler.value.removeTask(id)
  }

  const step = (): Event[] => {
    return scheduler.value.step()
  }

  const stepMulti = (ticks: number): Event[] => {
    return scheduler.value.stepMulti(ticks)
  }

  const startAutoRun = (): void => {
    if (isAutoRunning.value) return
    
    isAutoRunning.value = true
    
    const runStep = () => {
      if (!isAutoRunning.value) return
      
      const newEvents = scheduler.value.step()
      
      const activeTasks = tasks.value.filter(
        t => t.state !== 'terminated' && t.state !== 'new'
      )
      
      if (activeTasks.length === 0 || newEvents.length === 0) {
        if (readyQueue.value.length === 0 && !runningTask.value) {
          stopAutoRun()
          return
        }
      }
      
      autoRunTimer.value = window.setTimeout(runStep, autoRunSpeed.value)
    }
    
    autoRunTimer.value = window.setTimeout(runStep, autoRunSpeed.value)
  }

  const stopAutoRun = (): void => {
    isAutoRunning.value = false
    if (autoRunTimer.value) {
      clearTimeout(autoRunTimer.value)
      autoRunTimer.value = null
    }
  }

  const takeSnapshot = (description: string = ''): Snapshot => {
    return scheduler.value.takeSnapshot(description)
  }

  const loadSnapshot = (snapshot: Snapshot): void => {
    scheduler.value.loadSnapshot(snapshot)
    resetSelection()
  }

  const updateConfig = (newConfig: Partial<SimulationConfig>): void => {
    scheduler.value.setConfig(newConfig)
  }

  const selectTask = (id: string | null): void => {
    selectedTaskId.value = id
  }

  const selectEvent = (id: string | null): void => {
    selectedEventId.value = id
  }

  const resetSelection = (): void => {
    selectedTaskId.value = null
    selectedEventId.value = null
  }

  const reset = (): void => {
    stopAutoRun()
    scheduler.value = new Scheduler()
    resetSelection()
  }

  const generateReport = (): AnalysisReport | null => {
    if (!currentExperiment.value) return null
    
    return ReportGenerator.generateReport(
      currentExperiment.value.id,
      currentExperiment.value.name,
      tasks.value,
      events.value,
      tick.value
    )
  }

  const exportMarkdown = (): string | null => {
    const report = generateReport()
    if (!report) return null
    return ReportGenerator.exportToMarkdown(report, tasks.value)
  }

  const exportJSON = (): string | null => {
    const report = generateReport()
    if (!report) return null
    return ReportGenerator.exportToJSON(report)
  }

  const setAutoRunSpeed = (speed: number): void => {
    autoRunSpeed.value = speed
  }

  return {
    scheduler,
    currentExperiment,
    selectedTaskId,
    selectedEventId,
    isAutoRunning,
    autoRunSpeed,
    
    tasks,
    events,
    snapshots,
    tick,
    config,
    readyQueue,
    blockedQueue,
    runningTask,
    selectedTask,
    selectedEvent,
    
    initFromWorkload,
    loadSampleWorkload,
    addTask,
    removeTask,
    step,
    stepMulti,
    startAutoRun,
    stopAutoRun,
    takeSnapshot,
    loadSnapshot,
    updateConfig,
    selectTask,
    selectEvent,
    resetSelection,
    reset,
    generateReport,
    exportMarkdown,
    exportJSON,
    setAutoRunSpeed
  }
})
