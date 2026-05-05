import { v4 as uuidv4 } from 'uuid'
import { Experiment } from '../types/index.js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const DATA_DIR = join(__dirname, '../../../data')

export class DataStore {
  private experiments: Map<string, Experiment> = new Map()
  private autoSave: boolean = true

  constructor() {
    this.ensureDataDir()
    this.loadFromFile()
  }

  private ensureDataDir(): void {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true })
    }
  }

  private getFilePath(): string {
    return join(DATA_DIR, 'experiments.json')
  }

  private loadFromFile(): void {
    const filePath = this.getFilePath()
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf-8')
        const data = JSON.parse(content) as Experiment[]
        data.forEach(exp => {
          this.experiments.set(exp.id, exp)
        })
        console.log(`Loaded ${data.length} experiments from file`)
      } catch (error) {
        console.error('Failed to load experiments:', error)
      }
    }
  }

  private saveToFile(): void {
    if (!this.autoSave) return
    try {
      const data = Array.from(this.experiments.values())
      writeFileSync(this.getFilePath(), JSON.stringify(data, null, 2), 'utf-8')
    } catch (error) {
      console.error('Failed to save experiments:', error)
    }
  }

  createExperiment(name: string, description: string = ''): Experiment {
    const experiment: Experiment = {
      id: uuidv4(),
      name,
      description,
      configuration: {
        timeSlice: 5,
        ioLatency: 3,
        schedulerType: 'round_robin',
        enablePreemption: true,
        enableTimerInterrupt: true,
        timerInterval: 5
      },
      tasks: [],
      events: [],
      snapshots: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastTick: 0,
      isRunning: false
    }
    
    this.experiments.set(experiment.id, experiment)
    this.saveToFile()
    return experiment
  }

  getExperiment(id: string): Experiment | undefined {
    return this.experiments.get(id)
  }

  getAllExperiments(): Experiment[] {
    return Array.from(this.experiments.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  updateExperiment(id: string, updates: Partial<Experiment>): Experiment | null {
    const experiment = this.experiments.get(id)
    if (!experiment) return null
    
    const updated: Experiment = {
      ...experiment,
      ...updates,
      updatedAt: Date.now()
    }
    
    this.experiments.set(id, updated)
    this.saveToFile()
    return updated
  }

  deleteExperiment(id: string): boolean {
    const result = this.experiments.delete(id)
    if (result) {
      this.saveToFile()
    }
    return result
  }

  duplicateExperiment(id: string): Experiment | null {
    const original = this.experiments.get(id)
    if (!original) return null
    
    const duplicated: Experiment = {
      ...JSON.parse(JSON.stringify(original)),
      id: uuidv4(),
      name: `${original.name} (复制)`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    
    this.experiments.set(duplicated.id, duplicated)
    this.saveToFile()
    return duplicated
  }

  setAutoSave(enabled: boolean): void {
    this.autoSave = enabled
  }

  forceSave(): void {
    this.saveToFile()
  }
}

export const dataStore = new DataStore()
