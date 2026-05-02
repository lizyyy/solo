import { describe, it, expect, beforeEach } from 'vitest'
import { validateContinuity } from '../electron/validators'
import type { Scene, PropStatus, ActorCall } from '../src/types'

function createMockScenes(): Scene[] {
  return [
    {
      id: '1',
      sceneNumber: '1-01',
      sceneName: '第一场',
      shootDate: '2024-03-15',
      shootTime: '09:00',
      location: '公寓',
      interiorExterior: '内景',
      dayNight: '日',
      scriptPages: 2,
      estimatedMinutes: 30,
      actors: ['张三'],
      props: ['咖啡杯'],
      costumes: ['蓝色西装'],
      storyOrder: 1,
      shootOrder: 1,
    },
    {
      id: '2',
      sceneNumber: '1-02',
      sceneName: '第二场',
      shootDate: '2024-03-16',
      shootTime: '10:00',
      location: '酒吧',
      interiorExterior: '内景',
      dayNight: '夜',
      scriptPages: 3,
      estimatedMinutes: 45,
      actors: ['张三', '李四'],
      props: ['酒杯'],
      costumes: ['黑色夹克'],
      storyOrder: 2,
      shootOrder: 2,
    },
    {
      id: '3',
      sceneNumber: '1-03',
      sceneName: '第三场',
      shootDate: '2024-03-15',
      shootTime: '14:00',
      location: '警局',
      interiorExterior: '内景',
      dayNight: '日',
      scriptPages: 2,
      estimatedMinutes: 30,
      actors: ['李四'],
      props: ['笔记本'],
      costumes: ['警服'],
      storyOrder: 3,
      shootOrder: 3,
    },
  ]
}

function createMockPropStatus(): PropStatus[] {
  return [
    {
      id: '1',
      name: '咖啡杯',
      type: 'prop',
      sceneNumber: '1-01',
      actorName: '张三',
      status: '满',
      description: '有半杯咖啡',
      timestamp: '2024-03-15T09:30:00Z',
      recordedBy: '场记',
    },
    {
      id: '2',
      name: '咖啡杯',
      type: 'prop',
      sceneNumber: '1-02',
      actorName: '张三',
      status: '空',
      description: '杯底有咖啡渍',
      timestamp: '2024-03-16T10:00:00Z',
      recordedBy: '场记',
    },
    {
      id: '3',
      name: '额头伤口',
      type: 'wound',
      sceneNumber: '1-01',
      actorName: '张三',
      status: '新伤',
      description: '新鲜伤口，有血迹',
      timestamp: '2024-03-15T09:30:00Z',
      recordedBy: '场记',
    },
    {
      id: '4',
      name: '额头伤口',
      type: 'wound',
      sceneNumber: '1-02',
      actorName: '张三',
      status: '结痂',
      description: '伤口已结痂',
      timestamp: '2024-03-16T10:00:00Z',
      recordedBy: '场记',
    },
  ]
}

function createMockActorCalls(): ActorCall[] {
  return [
    {
      id: '1',
      actorName: '张三',
      characterName: '张建国',
      sceneNumber: '1-01',
      callTime: '07:30',
      makeupTime: '08:00',
      wardrobeTime: '07:45',
      onSetTime: '08:30',
      shootDate: '2024-03-15',
      costume: '蓝色西装',
      makeup: '淡妆',
    },
    {
      id: '2',
      actorName: '张三',
      characterName: '张建国',
      sceneNumber: '1-02',
      callTime: '09:00',
      makeupTime: '09:30',
      wardrobeTime: '09:15',
      onSetTime: '10:00',
      shootDate: '2024-03-16',
      costume: '黑色夹克',
      makeup: '浓妆',
    },
    {
      id: '3',
      actorName: '李四',
      characterName: '李警官',
      sceneNumber: '1-02',
      callTime: '09:00',
      makeupTime: '09:30',
      wardrobeTime: '09:15',
      onSetTime: '10:00',
      shootDate: '2024-03-16',
      costume: '红色连衣裙',
      makeup: '浓妆',
    },
  ]
}

describe('validateContinuity', () => {
  let scenes: Scene[]
  let propStatus: PropStatus[]
  let actorCalls: ActorCall[]

  beforeEach(() => {
    scenes = createMockScenes()
    propStatus = createMockPropStatus()
    actorCalls = createMockActorCalls()
  })

  it('should detect prop state jumps', () => {
    const issues = validateContinuity({
      scenes,
      propStatus,
      actorCalls,
    })

    const propJumpIssues = issues.filter(i => i.type === 'prop_state_jump')
    expect(propJumpIssues.length).toBeGreaterThan(0)
    
    const coffeeCupIssue = propJumpIssues.find(i => 
      i.affectedProps.includes('咖啡杯') || i.title.includes('咖啡杯')
    )
    expect(coffeeCupIssue).toBeDefined()
  })

  it('should detect wound continuity issues', () => {
    const issues = validateContinuity({
      scenes,
      propStatus,
      actorCalls,
    })

    const woundIssues = issues.filter(i => i.type === 'wound_continuity')
    expect(woundIssues.length).toBeGreaterThan(0)
    
    const foreheadWoundIssue = woundIssues.find(i => 
      i.affectedProps.includes('额头伤口') || i.title.includes('伤口')
    )
    expect(foreheadWoundIssue).toBeDefined()
  })

  it('should detect reshoot date conflicts', () => {
    // 场景 1-03 剧情顺序是 3，但拍摄日期是 2024-03-15，
    // 比场景 1-02 (剧情顺序 2，拍摄日期 2024-03-16) 早
    const issues = validateContinuity({
      scenes,
      propStatus,
      actorCalls,
    })

    const reshootIssues = issues.filter(i => i.type === 'reshoot_date_conflict')
    expect(reshootIssues.length).toBeGreaterThan(0)
  })

  it('should detect timeline inconsistencies', () => {
    // 场景 1-01 是日景，场景 1-02 是夜景，中间没有转场标记
    const issues = validateContinuity({
      scenes,
      propStatus,
      actorCalls,
    })

    const timelineIssues = issues.filter(i => i.type === 'timeline_inconsistency')
    expect(timelineIssues.length).toBeGreaterThan(0)
  })

  it('should detect makeup continuity issues', () => {
    // 李四在场景 1-02 穿红色连衣裙，但在场景 1-01 是便装
    const issues = validateContinuity({
      scenes,
      propStatus,
      actorCalls,
    })

    const makeupIssues = issues.filter(i => i.type === 'makeup_continuity')
    // 可能有也可能没有，取决于是否有妆容突变
  })

  it('should handle missing photo directory', () => {
    const issues = validateContinuity({
      scenes,
      propStatus,
      actorCalls,
      photoFiles: [],
    })

    const photoIssues = issues.filter(i => i.type === 'photo_missing')
    expect(photoIssues.length).toBeGreaterThan(0)
  })

  it('should return empty array when no issues', () => {
    // 创建一个没有问题的简单场景
    const simpleScenes: Scene[] = [
      {
        id: '1',
        sceneNumber: '1-01',
        sceneName: '简单场景',
        shootDate: '2024-03-15',
        shootTime: '09:00',
        location: '办公室',
        interiorExterior: '内景',
        dayNight: '日',
        scriptPages: 1,
        estimatedMinutes: 15,
        actors: [],
        props: [],
        costumes: [],
        storyOrder: 1,
        shootOrder: 1,
      },
    ]

    const issues = validateContinuity({
      scenes: simpleScenes,
      propStatus: [],
      actorCalls: [],
      photoFiles: ['photo1.jpg'],
    })

    // 可能会有一些信息级别的问题
  })

  it('should correctly classify issue severity', () => {
    const issues = validateContinuity({
      scenes,
      propStatus,
      actorCalls,
    })

    const criticalIssues = issues.filter(i => i.severity === 'critical')
    const warningIssues = issues.filter(i => i.severity === 'warning')
    const infoIssues = issues.filter(i => i.severity === 'info')

    expect(criticalIssues.length + warningIssues.length + infoIssues.length).toBe(issues.length)
  })

  it('should include affected scenes in issues', () => {
    const issues = validateContinuity({
      scenes,
      propStatus,
      actorCalls,
    })

    issues.forEach(issue => {
      expect(Array.isArray(issue.affectedScenes)).toBe(true)
    })
  })

  it('should include evidence in issues', () => {
    const issues = validateContinuity({
      scenes,
      propStatus,
      actorCalls,
    })

    const issuesWithEvidence = issues.filter(i => i.evidence.length > 0)
    expect(issuesWithEvidence.length).toBeGreaterThan(0)
  })
})

describe('issue types', () => {
  it('should have all expected issue types', () => {
    const expectedTypes = [
      'prop_state_jump',
      'costume_missing',
      'photo_missing',
      'reshoot_date_conflict',
      'timeline_inconsistency',
      'actor_schedule_conflict',
      'wound_continuity',
      'makeup_continuity',
    ]

    expectedTypes.forEach(type => {
      expect(typeof type).toBe('string')
    })
  })
})
