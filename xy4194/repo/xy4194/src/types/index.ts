// 场次表类型
export interface Scene {
  id: string
  sceneNumber: string
  sceneName: string
  episode?: string
  shootDate: string
  shootTime: string
  location: string
  interiorExterior: string
  dayNight: string
  scriptPages: number
  estimatedMinutes: number
  actors: string[]
  props: string[]
  costumes: string[]
  notes?: string
  storyOrder: number
  shootOrder: number
}

// 道具/服装状态类型
export interface PropStatus {
  id: string
  name: string
  type: 'prop' | 'costume' | 'makeup' | 'wound'
  sceneNumber: string
  actorName?: string
  status: string
  description: string
  photoReference?: string
  timestamp: string
  recordedBy: string
}

// 演员通告类型
export interface ActorCall {
  id: string
  actorName: string
  characterName: string
  sceneNumber: string
  callTime: string
  makeupTime: string
  wardrobeTime: string
  onSetTime: string
  shootDate: string
  costume: string
  makeup: string
  notes?: string
}

// 照片信息类型
export interface PhotoInfo {
  id: string
  fileName: string
  filePath: string
  sceneNumber?: string
  actorName?: string
  propName?: string
  timestamp: string
  tags: string[]
}

// 验证问题类型
export type IssueSeverity = 'critical' | 'warning' | 'info'
export type IssueType = 
  | 'prop_state_jump'
  | 'costume_missing'
  | 'photo_missing'
  | 'reshoot_date_conflict'
  | 'timeline_inconsistency'
  | 'actor_schedule_conflict'
  | 'wound_continuity'
  | 'makeup_continuity'

export interface ValidationIssue {
  id: string
  type: IssueType
  severity: IssueSeverity
  title: string
  description: string
  affectedScenes: string[]
  affectedActors: string[]
  affectedProps: string[]
  evidence: {
    type: 'prop_record' | 'costume_record' | 'photo' | 'schedule' | 'note'
    reference: string
    description: string
  }[]
  suggestion: string
  timestamp: string
}

// 复核意见类型
export interface Review {
  id: string
  issueId: string
  projectId: string
  status: 'confirmed' | 'dismissed' | 'needs_more_info' | 'resolved'
  reviewerName: string
  comment: string
  evidencePhoto?: string
  createdAt: string
  updatedAt: string
}

// 项目类型
export interface Project {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  sceneSheetPath?: string
  propStatusPath?: string
  actorCallSheetPath?: string
  photoDirectory?: string
  scenes: Scene[]
  propStatus: PropStatus[]
  actorCalls: ActorCall[]
  photos: PhotoInfo[]
  issues: ValidationIssue[]
}

// 导出选项类型
export interface ExportOptions {
  includeResolved: boolean
  includeDismissed: boolean
  format: 'markdown' | 'csv' | 'json'
}
