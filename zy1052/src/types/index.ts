export type FilterType = 'crop' | 'resize' | 'grayscale' | 'sharpen' | 'levels' | 'mosaic' | 'watermark'

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface RGB {
  r: number
  g: number
  b: number
}

export interface RGBA extends RGB {
  a: number
}

export interface ImageSize {
  width: number
  height: number
}

export interface FilterParameterDefinition {
  name: string
  type: 'number' | 'string' | 'boolean' | 'point' | 'rect' | 'color' | 'select' | 'image'
  label: string
  min?: number
  max?: number
  step?: number
  default: any
  options?: { value: string; label: string }[]
  description?: string
}

export interface FilterDefinition {
  type: FilterType
  name: string
  description: string
  category: 'transform' | 'color' | 'filter' | 'composite'
  parameters: FilterParameterDefinition[]
  supportsGPU: boolean
  supportsCPU: boolean
}

export interface FilterNode {
  id: string
  type: FilterType
  name: string
  parameters: Record<string, any>
  enabled: boolean
  order: number
}

export interface FilterNodeState extends FilterNode {
  status: 'idle' | 'running' | 'success' | 'failed' | 'skipped'
  error?: string
  gpuTime?: number
  cpuTime?: number
}

export interface ImageSource {
  id: string
  name: string
  width: number
  height: number
  url: string
  file?: File
  imageData?: ImageData
}

export interface PipelineResult {
  imageData: ImageData
  width: number
  height: number
}

export interface NodeExecutionResult {
  nodeId: string
  success: boolean
  error?: string
  gpuTime?: number
  cpuTime?: number
  outputSize?: ImageSize
}

export interface PipelineExecutionResult {
  success: boolean
  gpuResult?: PipelineResult
  cpuResult?: PipelineResult
  nodeResults: NodeExecutionResult[]
  totalGpuTime?: number
  totalCpuTime?: number
  pixelDiff?: PixelDifferenceSummary
}

export interface PixelDifference {
  totalPixels: number
  differingPixels: number
  maxDifference: number
  avgDifference: number
  differenceMap: number[]
}

export interface PixelDifferenceSummary {
  totalPixels: number
  differingPixels: number
  differingPercent: number
  maxDifference: number
  avgDifference: number
  rmsDifference: number
  psnr: number
}

export interface ProjectData {
  version: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  imageSource: ImageSource | null
  filterNodes: FilterNode[]
}

export interface ReportData {
  projectName: string
  timestamp: string
  webgpuAvailable: boolean
  imageInfo: {
    name: string
    width: number
    height: number
  }
  pipelineResult: PipelineExecutionResult
  nodeDetails: Array<{
    node: FilterNode
    result: NodeExecutionResult
  }>
}

export interface Renderer {
  initialize(): Promise<boolean>
  isAvailable(): boolean
  applyFilter(
    input: ImageData | HTMLCanvasElement,
    filterType: FilterType,
    parameters: Record<string, any>
  ): Promise<ImageData>
  applyPipeline(
    input: ImageData | HTMLCanvasElement,
    filters: Array<{ type: FilterType; parameters: Record<string, any> }>
  ): Promise<{
    result: ImageData
    nodeTimes: number[]
    errors: Array<{ index: number; error: string }>
  }>
  destroy(): void
}
