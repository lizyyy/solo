import type { GISPoint, CrowdingStatus, ResidentFeedback, InspectionPhoto, ManualNote, ProcessingRecord, HistoricalOpinion, Conflict } from '@/types'

export const seedPoints: GISPoint[] = [
  { id: 'p1', latitude: 31.2304, longitude: 121.4737, name: '外滩滨江步道A段', street: '中山东一路', source: 'gis_import', sourceId: 'GIS-2024-001', importedAt: '2025-03-15T08:00:00Z' },
  { id: 'p2', latitude: 31.2310, longitude: 121.4790, name: '外滩滨江步道B段', street: '中山东一路', source: 'gis_import', sourceId: 'GIS-2024-002', importedAt: '2025-03-15T08:00:00Z' },
  { id: 'p3', latitude: 31.2280, longitude: 121.4850, name: '陆家嘴滨江步道', street: '银城中路', source: 'resident_feedback', sourceId: 'FB-2025-018', importedAt: '2025-04-02T14:30:00Z' },
  { id: 'p4', latitude: 31.2250, longitude: 121.4700, name: '老城厢河岸步道', street: '人民路', source: 'inspection', sourceId: 'INS-2025-007', importedAt: '2025-04-10T09:15:00Z' },
  { id: 'p5', latitude: 31.2330, longitude: 121.4880, name: '北外滩步道', street: '东大名路', source: 'gis_import', sourceId: 'GIS-2024-005', importedAt: '2025-03-15T08:00:00Z' },
  { id: 'p6', latitude: 31.2260, longitude: 121.4760, name: '十六铺步道入口', street: '外咸瓜街', source: 'resident_feedback', sourceId: 'FB-2025-022', importedAt: '2025-04-15T16:45:00Z' },
  { id: 'p7', latitude: 31.2340, longitude: 121.4820, name: '浦东滨江大道C段', street: '滨江大道', source: 'gis_import', sourceId: 'GIS-2024-008', importedAt: '2025-03-15T08:00:00Z' },
  { id: 'p8', latitude: 31.2290, longitude: 121.4680, name: '南外滩步道', street: '董家渡路', source: 'inspection', sourceId: 'INS-2025-012', importedAt: '2025-04-20T10:30:00Z' },
]

export const seedStatuses: CrowdingStatus[] = [
  { id: 's1', pointId: 'p1', status: 'crowded', source: 'GIS导入', recordedAt: '2025-05-01T10:00:00Z' },
  { id: 's2', pointId: 'p2', status: 'normal', source: 'GIS导入', recordedAt: '2025-05-01T10:00:00Z' },
  { id: 's3', pointId: 'p3', status: 'crowded', source: '居民反馈', recordedAt: '2025-05-05T15:00:00Z' },
  { id: 's4', pointId: 'p4', status: 'pending_review', source: '巡检录入', recordedAt: '2025-05-08T09:00:00Z' },
  { id: 's5', pointId: 'p5', status: 'normal', source: 'GIS导入', recordedAt: '2025-05-01T10:00:00Z' },
  { id: 's6', pointId: 'p6', status: 'crowded', source: '居民反馈', recordedAt: '2025-05-10T11:00:00Z' },
  { id: 's7', pointId: 'p7', status: 'normal', source: 'GIS导入', recordedAt: '2025-05-01T10:00:00Z' },
  { id: 's8', pointId: 'p8', status: 'pending_review', source: '巡检录入', recordedAt: '2025-05-12T14:00:00Z' },
]

export const seedFeedbacks: ResidentFeedback[] = [
  { id: 'f1', pointId: 'p1', residentName: '王秀英', content: '周末外滩A段人特别多，推婴儿车根本走不动，建议分时段限流', feedbackTime: '2025-05-15T09:30:00Z', hasConflict: false },
  { id: 'f2', pointId: 'p3', residentName: '李建国', content: '陆家嘴步道周末拥挤严重，但GIS数据显示正常，我每天遛弯都走那里，肯定不对', feedbackTime: '2025-05-16T14:20:00Z', hasConflict: true, conflictDetail: '居民反映拥挤与GIS导入的正常状态不一致' },
  { id: 'f3', pointId: 'p6', residentName: '张美华', content: '十六铺入口处摊贩占道严重，步行空间被挤压到只剩一米多', feedbackTime: '2025-05-17T08:45:00Z', hasConflict: false },
  { id: 'f4', pointId: 'p4', residentName: '陈志强', content: '老城厢那段步道晚上灯光暗，人又多，安全隐患很大', feedbackTime: '2025-05-18T19:30:00Z', hasConflict: false },
  { id: 'f5', pointId: 'p2', residentName: '赵玉兰', content: 'B段平时还行，就是傍晚散步人多一些，算不上拥挤', feedbackTime: '2025-05-19T17:00:00Z', hasConflict: false },
  { id: 'f6', pointId: 'p5', residentName: '刘海涛', content: '北外滩步道挺好的，空间宽敞没什么人，不用管', feedbackTime: '2025-05-20T10:00:00Z', hasConflict: true, conflictDetail: '居民反映空闲与GIS导入的拥挤状态不一致' },
  { id: 'f7', pointId: 'p8', residentName: '孙桂芳', content: '南外滩步道施工围挡占了半边路，剩余空间很挤，行人只能侧身过', feedbackTime: '2025-05-21T16:15:00Z', hasConflict: false },
  { id: 'f8', pointId: 'p1', residentName: '周明远', content: '五一假期A段人山人海，建议节假日增设临时引导通道', feedbackTime: '2025-05-22T20:00:00Z', hasConflict: false },
]

export const seedPhotos: InspectionPhoto[] = [
  { id: 'ph1', pointId: 'p1', photoUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=crowded%20riverside%20walkway%20in%20Shanghai%20bund%20area%2C%20many%20pedestrians%20walking%2C%20modern%20waterfront%20promenade%2C%20daytime%2C%20realistic%20photograph&image_size=landscape_16_9', takenAt: '2025-05-15T10:30:00Z', inspector: '巡检员小张' },
  { id: 'ph2', pointId: 'p3', photoUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Lujiazui%20waterfront%20promenade%20crowded%20with%20tourists%2C%20Shanghai%20skyline%20background%2C%20sunny%20day%2C%20realistic%20photograph&image_size=landscape_16_9', takenAt: '2025-05-16T11:00:00Z', inspector: '巡检员小张' },
  { id: 'ph3', pointId: 'p4', photoUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=old%20town%20riverside%20walkway%20dim%20lighting%20evening%2C%20Shanghai%20old%20city%20area%2C%20narrow%20path%2C%20realistic%20photograph&image_size=landscape_16_9', takenAt: '2025-05-18T19:45:00Z', inspector: '巡检员小李' },
  { id: 'ph4', pointId: 'p6', photoUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=street%20vendors%20blocking%20riverside%20walkway%20entrance%2C%20narrow%20passage%2C%20Shanghai%20waterfront%2C%20realistic%20photograph&image_size=landscape_16_9', takenAt: '2025-05-17T09:00:00Z', inspector: '巡检员小李' },
  { id: 'ph5', pointId: 'p8', photoUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=construction%20fence%20blocking%20half%20of%20riverside%20walkway%2C%20pedestrians%20squeezing%20through%2C%20realistic%20photograph&image_size=landscape_16_9', takenAt: '2025-05-21T16:30:00Z', inspector: '巡检员小张' },
  { id: 'ph6', pointId: 'p2', photoUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=peaceful%20riverside%20walkway%20few%20pedestrians%2C%20Shanghai%20bund%20section%2C%20evening%20walk%2C%20realistic%20photograph&image_size=landscape_16_9', takenAt: '2025-05-19T17:30:00Z', inspector: '巡检员小张' },
]

export const seedNotes: ManualNote[] = [
  { id: 'n1', pointId: 'p1', street: '中山东一路', content: '周末和节假日A段建议安排2名引导员，分时段放行。已和街道办老陈沟通过，他说下月可以排班。', editedAt: '2025-05-20T14:00:00Z', editedBy: '阿宁' },
  { id: 'n2', pointId: 'p3', street: '银城中路', content: '陆家嘴步道节假日人流集中，平日还可以。等冲突确认后再定方案。', editedAt: '2025-05-18T10:00:00Z', editedBy: '阿宁' },
  { id: 'n3', pointId: 'p4', street: '人民路', content: '老城厢灯光问题已报城管，回复说下季度加装路灯。', editedAt: '2025-05-22T09:30:00Z', editedBy: '阿宁' },
  { id: 'n4', pointId: 'p6', street: '外咸瓜街', content: '占道摊贩问题已转交市场监管，正在协调中。', editedAt: '2025-05-21T11:00:00Z', editedBy: '阿宁' },
  { id: 'n5', pointId: 'p8', street: '董家渡路', content: '施工围挡预计7月拆除，期间需设临时通行标识。', editedAt: '2025-05-22T15:00:00Z', editedBy: '阿宁' },
]

export const seedRecords: ProcessingRecord[] = [
  { id: 'r1', pointId: 'p1', action: '状态变更', fromStatus: '正常', toStatus: '拥挤', reason: '五一期间居民集中反馈拥挤', operatedAt: '2025-05-02T10:00:00Z', operator: '阿宁' },
  { id: 'r2', pointId: 'p3', action: '状态变更', fromStatus: '正常', toStatus: '拥挤', reason: '居民反馈与GIS数据冲突，经核实居民反映属实', operatedAt: '2025-05-06T14:00:00Z', operator: '阿宁' },
  { id: 'r3', pointId: 'p4', action: '新增录入', fromStatus: '无', toStatus: '待确认', reason: '巡检发现安全隐患，待进一步确认', operatedAt: '2025-05-10T09:30:00Z', operator: '巡检员小李' },
  { id: 'r4', pointId: 'p6', action: '状态变更', fromStatus: '正常', toStatus: '拥挤', reason: '居民反映摊贩占道导致拥挤', operatedAt: '2025-05-12T11:00:00Z', operator: '阿宁' },
  { id: 'r5', pointId: 'p8', action: '新增录入', fromStatus: '无', toStatus: '待确认', reason: '巡检发现施工围挡影响通行', operatedAt: '2025-05-14T15:00:00Z', operator: '巡检员小张' },
  { id: 'r6', pointId: 'p1', action: '方案覆盖', fromStatus: '正常', toStatus: '拥挤', reason: '旧方案"维持现状"被新方案"分时段限流"替代', operatedAt: '2025-05-20T14:00:00Z', operator: '阿宁' },
]

export const seedOpinions: HistoricalOpinion[] = [
  { id: 'o1', pointId: 'p1', content: '维持现状，加强巡逻即可', source: '街道办老陈', createdAt: '2025-04-10T10:00:00Z', isOverridden: true, overriddenAt: '2025-05-20T14:00:00Z', overrideReason: '五一拥挤严重，巡逻不够，改为分时段限流' },
  { id: 'o2', pointId: 'p1', content: '分时段限流，增设引导员', source: '阿宁', createdAt: '2025-05-20T14:00:00Z', isOverridden: false },
  { id: 'o3', pointId: 'p3', content: '陆家嘴步道人流可控，无需特殊措施', source: 'GIS数据分析报告', createdAt: '2025-04-01T08:00:00Z', isOverridden: true, overriddenAt: '2025-05-06T14:00:00Z', overrideReason: '居民实地反馈与数据分析结论矛盾，以居民反馈为准' },
  { id: 'o4', pointId: 'p3', content: '节假日增设临时引导标识，延长巡检时段', source: '阿宁', createdAt: '2025-05-06T14:00:00Z', isOverridden: false },
  { id: 'o5', pointId: 'p6', content: '加强占道经营整治', source: '阿宁', createdAt: '2025-05-12T11:00:00Z', isOverridden: false },
  { id: 'o6', pointId: 'p8', content: '设临时通行标识，待施工结束后评估', source: '巡检员小张', createdAt: '2025-05-14T15:00:00Z', isOverridden: false },
]

export const seedConflicts: Conflict[] = [
  {
    id: 'c1',
    pointId: 'p3',
    feedbackId: 'f2',
    importDataSummary: 'GIS数据分析显示陆家嘴滨江步道人流量在正常范围内，无拥挤迹象',
    feedbackSummary: '居民李建国每日实地遛弯，反映该步道周末拥挤严重，与GIS数据结论矛盾',
    suggestedAction: 'use_feedback',
    detectedAt: '2025-05-16T14:20:00Z',
  },
  {
    id: 'c2',
    pointId: 'p5',
    feedbackId: 'f6',
    importDataSummary: 'GIS数据标记北外滩步道为拥挤状态',
    feedbackSummary: '居民刘海涛反映北外滩步道空间宽敞没什么人，不需要管理',
    suggestedAction: 'mark_for_review',
    detectedAt: '2025-05-20T10:00:00Z',
  },
]
