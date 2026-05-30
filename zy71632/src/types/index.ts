export interface SurfaceConfig {
  expression: string
  xRange: [number, number]
  yRange: [number, number]
  resolution: number
  colorScheme: string
}

export interface VectorFieldConfig {
  arrowScale: number
  density: number
  showArrows: boolean
  colorByMagnitude: boolean
}

export interface SkiPath {
  id: string
  startPoint: [number, number]
  stepSize: number
  maxSteps: number
  points: [number, number, number][]
  createdAt: number
}

export interface Note {
  id: string
  pathId: string | null
  content: string
  createdAt: number
  updatedAt: number
}

export interface TeacherAnnotation {
  id: string
  pathId: string | null
  content: string
  tags: ('重点' | '易错' | '注意')[]
  createdAt: number
  updatedAt: number
}

export type AnomalyType = 'ARROW_REVERSED' | 'PATH_BOUNDARY' | 'STEP_TOO_LARGE'

export interface AnomalyEntry {
  id: string
  type: AnomalyType
  pathId: string
  stepIndex: number
  message: string
  handlingNote: string
  timestamp: number
}

export type ViewMode = 'surface' | 'vector' | 'path' | 'params'

export interface ViewState {
  activeView: ViewMode
  cameraPosition: [number, number, number]
  cameraTarget: [number, number, number]
}

export interface ProjectData {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  surface: SurfaceConfig
  vectorField: VectorFieldConfig
  paths: SkiPath[]
  notes: Note[]
  teacherAnnotations: TeacherAnnotation[]
  anomalyLog: AnomalyEntry[]
  viewState: ViewState
}

export interface GradientPoint {
  x: number
  y: number
  z: number
  dx: number
  dy: number
  magnitude: number
}

export const ANOMALY_MESSAGES: Record<AnomalyType, { message: string; handlingNote: string }> = {
  ARROW_REVERSED: {
    message: '梯度方向与路径前进方向相反',
    handlingNote: '梯度箭头指向最陡上升方向，滑雪路径沿最陡下降方向（-∇f）前进，二者方向相反是正确行为。',
  },
  PATH_BOUNDARY: {
    message: '路径超出定义域',
    handlingNote: '路径已超出曲面定义域，已在边界处截断。建议缩小步长或调整起点。',
  },
  STEP_TOO_LARGE: {
    message: '步长过大导致路径跳跃',
    handlingNote: '步长过大导致路径跳跃，梯度场变化可能被跳过。建议将步长减小至当前值的1/2。',
  },
}

export const DEFAULT_SURFACE: SurfaceConfig = {
  expression: 'sin(sqrt(x^2 + y^2))',
  xRange: [-5, 5],
  yRange: [-5, 5],
  resolution: 40,
  colorScheme: 'ocean',
}

export const DEFAULT_VECTOR_FIELD: VectorFieldConfig = {
  arrowScale: 0.3,
  density: 8,
  showArrows: true,
  colorByMagnitude: true,
}

export const DEFAULT_VIEW_STATE: ViewState = {
  activeView: 'surface',
  cameraPosition: [8, 8, 8],
  cameraTarget: [0, 0, 0],
}

export const PRESET_FUNCTIONS = [
  { label: 'sin(√(x²+y²))', value: 'sin(sqrt(x^2 + y^2))' },
  { label: 'x² + y²', value: 'x^2 + y^2' },
  { label: 'x² - y²', value: 'x^2 - y^2' },
  { label: 'cos(x)·sin(y)', value: 'cos(x) * sin(y)' },
  { label: 'e^(-(x²+y²)/4)', value: 'exp(-(x^2 + y^2) / 4)' },
  { label: 'xy', value: 'x * y' },
  { label: 'sin(x)·cos(y)', value: 'sin(x) * cos(y)' },
  { label: '1/(1+x²+y²)', value: '1 / (1 + x^2 + y^2)' },
]
