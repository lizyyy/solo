export interface Vec3 {
  x: number
  y: number
  z: number
}

export type JointPositions = Record<string, Vec3>

export interface AngleJointDef {
  name: string
  center: string
  from: string
  to: string
  label: string
}

export interface SkeletonDefinition {
  joints: string[]
  bones: [string, string][]
  angleJoints: AngleJointDef[]
}

export interface Frame {
  frameIndex: number
  timestamp: number
  joints: JointPositions
}

export interface MotionData {
  frames: Frame[]
  fps: number
  skeletonDefinition: SkeletonDefinition
}

export interface AngleResult {
  jointName: string
  frameIndex: number
  angle: number
  isAnomaly: boolean
}

export interface AnomalyLogEntry {
  frameIndex: number
  jointName: string
  type: 'misconnect' | 'jump'
  detail: string
}

export interface Project {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  skeletonDefinition: SkeletonDefinition
  appState: AppState
}

export interface Student {
  id: string
  projectId: string
  name: string
  grade: string
  notes: string
}

export interface MotionClip {
  id: string
  projectId: string
  studentId: string
  name: string
  startFrame: number
  endFrame: number
  frames: Frame[]
  angleResults: AngleResult[]
  anomalyLog: AnomalyLogEntry[]
}

export interface Keyframe {
  id: string
  clipId: string
  frameIndex: number
  label: string
  source: 'manual' | 'auto'
}

export interface Comment {
  id: string
  clipId: string
  frameIndex: number
  content: string
  createdAt: string
}

export interface Report {
  id: string
  projectId: string
  summary: ReportSummary
  generatedAt: string
}

export interface ReportSummary {
  totalFrames: number
  totalAnomalies: number
  anomalyByJoint: Record<string, number>
  avgAngles: Record<string, number>
  keyframeCount: number
  commentCount: number
}

export interface ManualNote {
  id: string
  reportId: string
  section: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface AppState {
  currentFrame: number
  selectedJoints: string[]
  cameraPreset: 'front' | 'side' | 'top' | 'free'
  jumpThreshold: number
  activeClipId: string | null
  isPlaying: boolean
}

export const DEFAULT_SKELETON: SkeletonDefinition = {
  joints: [
    'head',
    'neck',
    'leftShoulder',
    'rightShoulder',
    'leftElbow',
    'rightElbow',
    'leftWrist',
    'rightWrist',
    'spine',
    'hip',
    'leftHip',
    'rightHip',
    'leftKnee',
    'rightKnee',
    'leftAnkle',
    'rightAnkle',
  ],
  bones: [
    ['head', 'neck'],
    ['neck', 'leftShoulder'],
    ['neck', 'rightShoulder'],
    ['leftShoulder', 'leftElbow'],
    ['rightShoulder', 'rightElbow'],
    ['leftElbow', 'leftWrist'],
    ['rightElbow', 'rightWrist'],
    ['neck', 'spine'],
    ['spine', 'hip'],
    ['hip', 'leftHip'],
    ['hip', 'rightHip'],
    ['leftHip', 'leftKnee'],
    ['rightHip', 'rightKnee'],
    ['leftKnee', 'leftAnkle'],
    ['rightKnee', 'rightAnkle'],
  ],
  angleJoints: [
    { name: 'leftKnee', center: 'leftKnee', from: 'leftHip', to: 'leftAnkle', label: '左膝' },
    { name: 'rightKnee', center: 'rightKnee', from: 'rightHip', to: 'rightAnkle', label: '右膝' },
    { name: 'leftHip', center: 'leftHip', from: 'spine', to: 'leftKnee', label: '左髋' },
    { name: 'rightHip', center: 'rightHip', from: 'spine', to: 'rightKnee', label: '右髋' },
    { name: 'leftElbow', center: 'leftElbow', from: 'leftShoulder', to: 'leftWrist', label: '左肘' },
    { name: 'rightElbow', center: 'rightElbow', from: 'rightShoulder', to: 'rightWrist', label: '右肘' },
  ],
}

export const DEFAULT_APP_STATE: AppState = {
  currentFrame: 0,
  selectedJoints: ['leftKnee', 'rightKnee', 'leftHip', 'rightHip'],
  cameraPreset: 'front',
  jumpThreshold: 15,
  activeClipId: null,
  isPlaying: false,
}
