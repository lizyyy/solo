import type {
  FilterType,
  FilterNode,
  FilterNodeState,
  NodeExecutionResult,
  PipelineExecutionResult,
  Renderer
} from '@/types'
import { getFilterDefaultParameters } from '@/filters/definitions'
import { calculateDifferenceSummary } from './pixelComparison'

export class PipelineManager {
  private nodes: FilterNodeState[] = []
  private gpuRenderer: Renderer | null = null
  private cpuRenderer: Renderer | null = null
  private gpuAvailable: boolean = false
  private cpuAvailable: boolean = false

  constructor(gpuRenderer?: Renderer, cpuRenderer?: Renderer) {
    this.gpuRenderer = gpuRenderer || null
    this.cpuRenderer = cpuRenderer || null
  }

  async initialize(): Promise<{ gpu: boolean; cpu: boolean }> {
    if (this.gpuRenderer) {
      this.gpuAvailable = await this.gpuRenderer.initialize()
    }
    
    if (this.cpuRenderer) {
      this.cpuAvailable = await this.cpuRenderer.initialize()
    }

    return {
      gpu: this.gpuAvailable,
      cpu: this.cpuAvailable
    }
  }

  isGpuAvailable(): boolean {
    return this.gpuAvailable
  }

  isCpuAvailable(): boolean {
    return this.cpuAvailable
  }

  getNodes(): FilterNodeState[] {
    return [...this.nodes]
  }

  getNode(id: string): FilterNodeState | undefined {
    return this.nodes.find(n => n.id === id)
  }

  addNode(type: FilterType, index?: number): FilterNodeState {
    const id = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const defaultParams = getFilterDefaultParameters(type)
    
    const node: FilterNodeState = {
      id,
      type,
      name: type,
      parameters: defaultParams,
      enabled: true,
      order: this.nodes.length,
      status: 'idle'
    }

    if (typeof index === 'number' && index >= 0 && index < this.nodes.length) {
      this.nodes.splice(index, 0, node)
      this.reorderNodes()
    } else {
      this.nodes.push(node)
    }

    return node
  }

  removeNode(id: string): boolean {
    const index = this.nodes.findIndex(n => n.id === id)
    if (index === -1) return false

    this.nodes.splice(index, 1)
    this.reorderNodes()
    return true
  }

  moveNode(id: string, newIndex: number): boolean {
    const currentIndex = this.nodes.findIndex(n => n.id === id)
    if (currentIndex === -1) return false
    if (newIndex < 0 || newIndex >= this.nodes.length) return false
    if (newIndex === currentIndex) return true

    const [node] = this.nodes.splice(currentIndex, 1)
    this.nodes.splice(newIndex, 0, node)
    this.reorderNodes()
    return true
  }

  swapNodes(id1: string, id2: string): boolean {
    const index1 = this.nodes.findIndex(n => n.id === id1)
    const index2 = this.nodes.findIndex(n => n.id === id2)
    
    if (index1 === -1 || index2 === -1) return false

    const temp = this.nodes[index1]
    this.nodes[index1] = this.nodes[index2]
    this.nodes[index2] = temp
    this.reorderNodes()
    return true
  }

  updateNodeParameters(id: string, parameters: Record<string, any>): boolean {
    const node = this.nodes.find(n => n.id === id)
    if (!node) return false

    node.parameters = { ...node.parameters, ...parameters }
    node.status = 'idle'
    return true
  }

  updateNodeEnabled(id: string, enabled: boolean): boolean {
    const node = this.nodes.find(n => n.id === id)
    if (!node) return false

    node.enabled = enabled
    node.status = 'idle'
    return true
  }

  clearNodes(): void {
    this.nodes = []
  }

  setNodes(nodes: FilterNode[]): void {
    this.nodes = nodes.map((node, index) => ({
      ...node,
      order: index,
      status: 'idle' as const
    }))
  }

  private reorderNodes(): void {
    this.nodes.forEach((node, index) => {
      node.order = index
    })
  }

  private getActiveFilters(): Array<{ type: FilterType; parameters: Record<string, any>; nodeId: string }> {
    return this.nodes
      .filter(n => n.enabled)
      .sort((a, b) => a.order - b.order)
      .map(n => ({
        type: n.type,
        parameters: n.parameters,
        nodeId: n.id
      }))
  }

  async execute(
    input: ImageData
  ): Promise<PipelineExecutionResult> {
    const activeFilters = this.getActiveFilters()
    
    this.nodes.forEach(node => {
      node.status = 'idle'
      node.error = undefined
      node.gpuTime = undefined
      node.cpuTime = undefined
    })

    const nodeResults: NodeExecutionResult[] = []
    let gpuResult: ImageData | undefined
    let cpuResult: ImageData | undefined
    let totalGpuTime: number | undefined
    let totalCpuTime: number | undefined

    if (this.gpuAvailable && this.gpuRenderer) {
      try {
        const startTime = performance.now()
        const result = await this.executeWithRenderer(this.gpuRenderer, input, activeFilters, 'gpu')
        totalGpuTime = performance.now() - startTime
        gpuResult = result.imageData
        result.nodeResults.forEach((r, i) => {
          const nodeResult = nodeResults[i] || { nodeId: activeFilters[i].nodeId, success: true }
          nodeResult.gpuTime = r.time
          if (r.error) {
            nodeResult.success = false
            nodeResult.error = r.error
          }
          nodeResults[i] = nodeResult
        })
      } catch (error) {
        console.error('GPU execution failed:', error)
      }
    }

    if (this.cpuAvailable && this.cpuRenderer) {
      try {
        const startTime = performance.now()
        const result = await this.executeWithRenderer(this.cpuRenderer, input, activeFilters, 'cpu')
        totalCpuTime = performance.now() - startTime
        cpuResult = result.imageData
        result.nodeResults.forEach((r, i) => {
          const nodeResult = nodeResults[i] || { nodeId: activeFilters[i].nodeId, success: true }
          nodeResult.cpuTime = r.time
          if (r.error) {
            nodeResult.success = false
            nodeResult.error = r.error
          }
          nodeResults[i] = nodeResult
        })
      } catch (error) {
        console.error('CPU execution failed:', error)
      }
    }

    nodeResults.forEach((result, i) => {
      const node = this.nodes.find(n => n.id === result.nodeId)
      if (node) {
        node.gpuTime = result.gpuTime
        node.cpuTime = result.cpuTime
        if (!result.success) {
          node.status = 'failed'
          node.error = result.error
        } else if (node.enabled) {
          node.status = 'success'
        }
      }
    })

    this.nodes.filter(n => !n.enabled).forEach(n => {
      n.status = 'skipped'
    })

    const success = nodeResults.length === 0 || nodeResults.every(r => r.success)

    let pixelDiff = undefined
    if (gpuResult && cpuResult) {
      pixelDiff = calculateDifferenceSummary(gpuResult, cpuResult)
    }

    return {
      success,
      gpuResult: gpuResult ? {
        imageData: gpuResult,
        width: gpuResult.width,
        height: gpuResult.height
      } : undefined,
      cpuResult: cpuResult ? {
        imageData: cpuResult,
        width: cpuResult.width,
        height: cpuResult.height
      } : undefined,
      nodeResults,
      totalGpuTime,
      totalCpuTime,
      pixelDiff
    }
  }

  private async executeWithRenderer(
    renderer: Renderer,
    input: ImageData,
    filters: Array<{ type: FilterType; parameters: Record<string, any>; nodeId: string }>,
    mode: 'gpu' | 'cpu'
  ): Promise<{
    imageData: ImageData
    nodeResults: Array<{ time: number; error?: string }>
  }> {
    let currentImageData = input
    const nodeResults: Array<{ time: number; error?: string }> = []

    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i]
      const startTime = performance.now()

      try {
        currentImageData = await renderer.applyFilter(
          currentImageData,
          filter.type,
          filter.parameters
        )
        nodeResults.push({
          time: performance.now() - startTime
        })
      } catch (error) {
        nodeResults.push({
          time: performance.now() - startTime,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    return {
      imageData: currentImageData,
      nodeResults
    }
  }

  destroy(): void {
    if (this.gpuRenderer) {
      this.gpuRenderer.destroy()
    }
    if (this.cpuRenderer) {
      this.cpuRenderer.destroy()
    }
  }
}
