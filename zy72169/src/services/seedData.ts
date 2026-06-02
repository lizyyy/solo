import { getDB, generateId, nowISO } from '@/services/db'
import type {
  Location, LocationAlias, Feedback, PlanVersion,
  PlanLocation, OperationLog, MergeSuggestion
} from '@/types'

export async function seedDemoData(): Promise<void> {
  const db = await getDB()

  const tx = db.transaction(
    ['locations', 'locationAliases', 'feedbacks', 'planVersions', 'planLocations', 'operationLogs', 'mergeSuggestions'],
    'readwrite'
  )

  const now = new Date()
  const ts = (daysAgo: number, hours = 0) => {
    const d = new Date(now)
    d.setDate(d.getDate() - daysAgo)
    d.setHours(hours, Math.floor(Math.random() * 60), 0, 0)
    return d.toISOString()
  }

  const locations: Location[] = [
    {
      id: generateId(), originalName: '阳光花园东门', canonicalName: '阳光花园东门',
      address: '阳光路88号东门', chargerCount: 8, status: '已启用',
      source: '表格', sourceDetail: '2024年12月街道摸排表', mergeStatus: '未归并',
      mergedIntoId: null, isException: false, exceptionNote: '',
      rawNote: '居民反映高峰期排队，建议增设4桩', createdAt: ts(30), updatedAt: ts(2)
    },
    {
      id: generateId(), originalName: '阳光花园东区门', canonicalName: '阳光花园东区门',
      address: '阳光路88号东区门', chargerCount: 6, status: '规划中',
      source: '审批记录', sourceDetail: '2025年1月审批第3批', mergeStatus: '疑似重复',
      mergedIntoId: null, isException: false, exceptionNote: '',
      rawNote: '和东门不是同一个！这是东区单独入口', createdAt: ts(25), updatedAt: ts(5)
    },
    {
      id: generateId(), originalName: '新城丽苑B区', canonicalName: '新城丽苑B区',
      address: '新城路166号', chargerCount: 10, status: '施工中',
      source: '照片', sourceDetail: '2025年3月现场照片', mergeStatus: '未归并',
      mergedIntoId: null, isException: false, exceptionNote: '',
      rawNote: '地基已打好，预计5月完成', createdAt: ts(20), updatedAt: ts(3)
    },
    {
      id: generateId(), originalName: '新成丽苑B区', canonicalName: '新城丽苑B区',
      address: '新城路166号', chargerCount: 10, status: '施工中',
      source: '表格', sourceDetail: '2025年2月统计表(手写扫描件)', mergeStatus: '已归并',
      mergedIntoId: null, isException: false, exceptionNote: '',
      rawNote: '手写件，字迹模糊，可能写成"新成"', createdAt: ts(18), updatedAt: ts(10)
    },
    {
      id: generateId(), originalName: '碧桂苑南门充电站', canonicalName: '碧桂苑南门充电站',
      address: '碧桂路23号', chargerCount: 12, status: '已启用',
      source: '表格', sourceDetail: '2024年12月街道摸排表', mergeStatus: '未归并',
      mergedIntoId: null, isException: false, exceptionNote: '',
      rawNote: '', createdAt: ts(28), updatedAt: ts(15)
    },
    {
      id: generateId(), originalName: '碧桂苑南门', canonicalName: '碧桂苑南门充电站',
      address: '碧桂路23号', chargerCount: 12, status: '已启用',
      source: '审批记录', sourceDetail: '2025年1月审批第2批', mergeStatus: '已归并',
      mergedIntoId: null, isException: false, exceptionNote: '',
      rawNote: '审批文件中省略了"充电站"后缀，实为同一地点', createdAt: ts(22), updatedAt: ts(12)
    },
    {
      id: generateId(), originalName: '金色家园地下车库', canonicalName: '金色家园地下车库',
      address: '金辉路56号B2层', chargerCount: 0, status: '暂停',
      source: '照片', sourceDetail: '2025年3月现场核实', mergeStatus: '未归并',
      mergedIntoId: null, isException: true, exceptionNote: '充电桩数量为0但状态为暂停，需核实是否已拆除',
      rawNote: '现场看桩都拆了 但系统里还是暂停 没人改', createdAt: ts(15), updatedAt: ts(1)
    },
    {
      id: generateId(), originalName: '翠湖畔小区', canonicalName: '翠湖畔小区',
      address: '', chargerCount: 4, status: '规划中',
      source: '手动补录', sourceDetail: '周姐2025年4月会议记录', mergeStatus: '未归并',
      mergedIntoId: null, isException: true, exceptionNote: '地址缺失',
      rawNote: '地址忘写了 会议上口头说的是湖畔路那边', createdAt: ts(5), updatedAt: ts(5)
    },
    {
      id: generateId(), originalName: '龙腾广场', canonicalName: '龙腾广场',
      address: '龙腾大道100号', chargerCount: 20, status: '已启用',
      source: '表格', sourceDetail: '2024年12月街道摸排表', mergeStatus: '未归并',
      mergedIntoId: null, isException: false, exceptionNote: '',
      rawNote: '商业广场，24小时开放，利用率高', createdAt: ts(35), updatedAt: ts(7)
    },
    {
      id: generateId(), originalName: '福泰路社区中心', canonicalName: '福泰路社区中心',
      address: '福泰路78号', chargerCount: -1, status: '规划中',
      source: '表格', sourceDetail: '2025年3月临时统计(微信截图)', mergeStatus: '未归并',
      mergedIntoId: null, isException: true, exceptionNote: '充电桩数量为-1，疑似录入错误',
      rawNote: '微信群里发的数字看不清 可能是1也可能写错了', createdAt: ts(3), updatedAt: ts(3)
    },
    {
      id: generateId(), originalName: '和平里小区西门', canonicalName: '和平里小区西门',
      address: '和平路12号', chargerCount: 6, status: '施工中',
      source: '审批记录', sourceDetail: '2025年4月审批第1批', mergeStatus: '未归并',
      mergedIntoId: null, isException: false, exceptionNote: '',
      rawNote: '审批刚下来，下月开工', createdAt: ts(2), updatedAt: ts(2)
    },
    {
      id: generateId(), originalName: '锦绣花园', canonicalName: '锦绣花园',
      address: '锦绣路200号', chargerCount: 8, status: '已启用',
      source: '表格', sourceDetail: '2024年12月街道摸排表', mergeStatus: '未归并',
      mergedIntoId: null, isException: false, exceptionNote: '',
      rawNote: '老旧小区，线路容量有限制', createdAt: ts(32), updatedAt: ts(20)
    },
  ]

  const aliases: LocationAlias[] = [
    { id: generateId(), locationId: locations[3].id, alias: '新成丽苑B区', source: '表格', recordedAt: ts(18) },
    { id: generateId(), locationId: locations[5].id, alias: '碧桂苑南门', source: '审批记录', recordedAt: ts(22) },
  ]

  const feedbacks: Feedback[] = [
    {
      id: generateId(), locationId: locations[0].id,
      content: '东门充电桩经常坏，3号桩和5号桩轮流故障，修了又坏，居民意见很大，希望整体更换而不是修修补补',
      source: '照片', status: '待处理', createdAt: ts(4)
    },
    {
      id: generateId(), locationId: locations[0].id,
      content: '高峰期排队要等1个多小时，建议错峰收费或增设临时桩',
      source: '手动补录', status: '已回复', createdAt: ts(10)
    },
    {
      id: generateId(), locationId: locations[6].id,
      content: '桩都拆了快半年了，系统里还是暂停状态，没人更新，居民以为是暂修结果跑过去白跑一趟',
      source: '照片', status: '待处理', createdAt: ts(1)
    },
    {
      id: generateId(), locationId: locations[7].id,
      content: '地址信息缺失，需要补录',
      source: '手动补录', status: '待处理', createdAt: ts(5)
    },
    {
      id: generateId(), locationId: locations[9].id,
      content: '微信群传的数字不确定，建议现场核实',
      source: '表格', status: '已回复', createdAt: ts(3)
    },
    {
      id: generateId(), locationId: locations[8].id,
      content: '商业广场利用率太高，周末经常满桩，周边小区居民也来充',
      source: '手动补录', status: '待处理', createdAt: ts(2)
    },
  ]

  const planVersions: PlanVersion[] = [
    {
      id: generateId(), versionName: 'V1',
      description: '2024年12月摸排初版方案，覆盖8个社区',
      createdAt: ts(30)
    },
    {
      id: generateId(), versionName: 'V2',
      description: '2025年3月修订版，新增2个社区，调整3处点位状态',
      createdAt: ts(15)
    },
    {
      id: generateId(), versionName: 'V3',
      description: '2025年4月最新版，补充现场核实结果，标记异常点位',
      createdAt: ts(2)
    },
  ]

  const planLocations: PlanLocation[] = [
    { id: generateId(), planId: planVersions[0].id, locationId: locations[0].id, note: '东门8桩已启用', action: '保留' },
    { id: generateId(), planId: planVersions[0].id, locationId: locations[4].id, note: '南门12桩已启用', action: '保留' },
    { id: generateId(), planId: planVersions[0].id, locationId: locations[8].id, note: '广场20桩', action: '保留' },
    { id: generateId(), planId: planVersions[0].id, locationId: locations[11].id, note: '8桩已启用', action: '保留' },
    { id: generateId(), planId: planVersions[1].id, locationId: locations[0].id, note: '高峰排队需增桩', action: '修改' },
    { id: generateId(), planId: planVersions[1].id, locationId: locations[2].id, note: '新增施工中点位', action: '新增' },
    { id: generateId(), planId: planVersions[1].id, locationId: locations[6].id, note: '暂停需核实', action: '修改' },
    { id: generateId(), planId: planVersions[1].id, locationId: locations[4].id, note: '', action: '保留' },
    { id: generateId(), planId: planVersions[1].id, locationId: locations[8].id, note: '', action: '保留' },
    { id: generateId(), planId: planVersions[1].id, locationId: locations[11].id, note: '', action: '保留' },
    { id: generateId(), planId: planVersions[2].id, locationId: locations[0].id, note: '反馈高峰排队', action: '修改' },
    { id: generateId(), planId: planVersions[2].id, locationId: locations[1].id, note: '新增规划中点位', action: '新增' },
    { id: generateId(), planId: planVersions[2].id, locationId: locations[7].id, note: '手动补录，地址待补', action: '新增' },
    { id: generateId(), planId: planVersions[2].id, locationId: locations[9].id, note: '异常：数量为-1', action: '新增' },
    { id: generateId(), planId: planVersions[2].id, locationId: locations[10].id, note: '新审批', action: '新增' },
    { id: generateId(), planId: planVersions[2].id, locationId: locations[6].id, note: '确认已拆除，待更新', action: '修改' },
  ]

  const logs: OperationLog[] = [
    { id: generateId(), type: '导入', summary: '批量导入12条点位数据（来自2024年12月摸排表）', detail: '', operator: '周姐', operatedAt: ts(30) },
    { id: generateId(), type: '归并', summary: '确认归并："碧桂苑南门" → "碧桂苑南门充电站"', detail: '{"from":"碧桂苑南门","to":"碧桂苑南门充电站","similarity":0.92}', operator: '周姐', operatedAt: ts(12) },
    { id: generateId(), type: '归并', summary: '确认归并："新成丽苑B区" → "新城丽苑B区"', detail: '{"from":"新成丽苑B区","to":"新城丽苑B区","similarity":0.89}', operator: '周姐', operatedAt: ts(10) },
    { id: generateId(), type: '补录', summary: '补录1条点位：翠湖畔小区（地址缺失）', detail: '{"added":1}', operator: '周姐', operatedAt: ts(5) },
    { id: generateId(), type: '导入', summary: '导入3月临时统计数据（含1条异常：数量为-1）', detail: '{"added":2,"anomaly":1}', operator: '周姐', operatedAt: ts(3) },
    { id: generateId(), type: '导出', summary: '导出全部12条点位CSV', detail: '{"count":12}', operator: '周姐', operatedAt: ts(1) },
  ]

  const mergeSuggestions: MergeSuggestion[] = [
    {
      id: generateId(), locationIdA: locations[0].id, locationIdB: locations[1].id,
      similarity: 0.87, reason: '名称高度相似，但含方向词"东门"vs"东区门"需人工确认',
      resolved: false, accepted: null
    },
  ]

  for (const loc of locations) tx.objectStore('locations').put(loc)
  for (const alias of aliases) tx.objectStore('locationAliases').put(alias)
  for (const fb of feedbacks) tx.objectStore('feedbacks').put(fb)
  for (const pv of planVersions) tx.objectStore('planVersions').put(pv)
  for (const pl of planLocations) tx.objectStore('planLocations').put(pl)
  for (const log of logs) tx.objectStore('operationLogs').put(log)
  for (const ms of mergeSuggestions) tx.objectStore('mergeSuggestions').put(ms)

  await tx.done
}
