import { v4 as uuidv4 } from 'uuid'
import db from './db.js'

export function seedProject(projectId: string): void {
  const now = new Date().toISOString()

  const insertRecord = db.prepare(`
    INSERT INTO import_records (id, project_id, source, raw_row, location_name, address, longitude, latitude, period, sunlight_hours, complaint, remark, raw_remark, imported_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const records: Array<{
    source: 'sunlight' | 'ledger'
    rawRow: Record<string, string>
    locationName: string
    address: string
    longitude: number | null
    latitude: number | null
    period: string
    sunlightHours: number | null
    complaint: string | null
    remark: string | null
    rawRemark: string
  }> = [
    {
      source: 'sunlight',
      rawRow: { '点位名称': '建设路口口袋公园', '地址': '建设路1号', '经度': '114.3051', '纬度': '30.5931', '时段': '2024年下半年', '日照时长': '2.1', '备注': '' },
      locationName: '建设路口口袋公园',
      address: '建设路1号',
      longitude: 114.3051,
      latitude: 30.5931,
      period: '2024年下半年',
      sunlightHours: 2.1,
      complaint: null,
      remark: null,
      rawRemark: ''
    },
    {
      source: 'sunlight',
      rawRow: { '点位名称': '建设路口口袋公园', '地址': '解放大道建设路口', '经度': '114.3068', '纬度': '30.5945', '时段': '2024年下半年', '日照时长': '3.5', '备注': '' },
      locationName: '建设路口口袋公园',
      address: '解放大道建设路口',
      longitude: 114.3068,
      latitude: 30.5945,
      period: '2024年下半年',
      sunlightHours: 3.5,
      complaint: null,
      remark: null,
      rawRemark: ''
    },
    {
      source: 'ledger',
      rawRow: { '点位名称': '建设路口口袋公园', '地址': '建设路1号', '经度': '114.3051', '纬度': '30.5931', '时段': '2024年下半年', '日照时长': '3.2', '投诉情况': '', '备注': '已处理!!!说好的3小时但实TM才2.1' },
      locationName: '建设路口口袋公园',
      address: '建设路1号',
      longitude: 114.3051,
      latitude: 30.5931,
      period: '2024年下半年',
      sunlightHours: 3.2,
      complaint: null,
      remark: '已处理!!!说好的3小时但实TM才2.1',
      rawRemark: '已处理!!!说好的3小时但实TM才2.1'
    },
    {
      source: 'sunlight',
      rawRow: { '点位名称': '翠竹路口口袋公园', '地址': '翠竹路28号', '经度': '114.3102', '纬度': '30.5988', '时段': '2024年下半年', '日照时长': '4.2', '备注': '' },
      locationName: '翠竹路口口袋公园',
      address: '翠竹路28号',
      longitude: 114.3102,
      latitude: 30.5988,
      period: '2024年下半年',
      sunlightHours: 4.2,
      complaint: null,
      remark: null,
      rawRemark: ''
    },
    {
      source: 'sunlight',
      rawRow: { '点位名称': '翠竹路口口袋公园', '地址': '翠竹路28号', '经度': '114.3102', '纬度': '30.5988', '时段': '2024年下半年', '日照时长': '4.2', '投诉情况': '日照不足', '备注': '' },
      locationName: '翠竹路口口袋公园',
      address: '翠竹路28号',
      longitude: 114.3102,
      latitude: 30.5988,
      period: '2024年下半年',
      sunlightHours: 4.2,
      complaint: '日照不足',
      remark: null,
      rawRemark: ''
    },
    {
      source: 'sunlight',
      rawRow: { '点位名称': '翠竹路口口袋公园', '地址': '翠竹路28号', '经度': '114.3102', '纬度': '30.5988', '时段': '2024年下半年', '日照时长': '4.2', '投诉情况': '日照不足', '备注': '' },
      locationName: '翠竹路口口袋公园',
      address: '翠竹路28号',
      longitude: 114.3102,
      latitude: 30.5988,
      period: '2024年下半年',
      sunlightHours: 4.2,
      complaint: '日照不足',
      remark: null,
      rawRemark: ''
    },
    {
      source: 'sunlight',
      rawRow: { '点位名称': '银杏大道口袋公园', '地址': '银杏大道99号', '经度': '114.2987', '纬度': '30.5876', '时段': '2023年上半年', '日照时长': '3.8', '备注': '' },
      locationName: '银杏大道口袋公园',
      address: '银杏大道99号',
      longitude: 114.2987,
      latitude: 30.5876,
      period: '2023年上半年',
      sunlightHours: 3.8,
      complaint: null,
      remark: null,
      rawRemark: ''
    },
    {
      source: 'sunlight',
      rawRow: { '点位名称': '银杏大道口袋公园', '地址': '银杏大道99号', '经度': '114.2987', '纬度': '30.5876', '时段': '2024年下半年', '日照时长': '3.1', '备注': '' },
      locationName: '银杏大道口袋公园',
      address: '银杏大道99号',
      longitude: 114.2987,
      latitude: 30.5876,
      period: '2024年下半年',
      sunlightHours: 3.1,
      complaint: null,
      remark: null,
      rawRemark: ''
    },
    {
      source: 'ledger',
      rawRow: { '点位名称': '银杏大道口袋公园', '地址': '银杏大道99号', '经度': '114.2987', '纬度': '30.5876', '时段': '2024年下半年', '日照时长': '3.5', '投诉情况': '', '备注': '正常通过' },
      locationName: '银杏大道口袋公园',
      address: '银杏大道99号',
      longitude: 114.2987,
      latitude: 30.5876,
      period: '2024年下半年',
      sunlightHours: 3.5,
      complaint: null,
      remark: '正常通过',
      rawRemark: '正常通过'
    },
    {
      source: 'sunlight',
      rawRow: { '点位名称': '桂花巷口袋公园', '地址': '桂花巷15号', '经度': '114.3120', '纬度': '30.6012', '时段': '2024年下半年', '日照时长': '', '备注': '数据待补' },
      locationName: '桂花巷口袋公园',
      address: '桂花巷15号',
      longitude: 114.3120,
      latitude: 30.6012,
      period: '2024年下半年',
      sunlightHours: null,
      complaint: null,
      remark: '数据待补',
      rawRemark: '数据待补'
    }
  ]

  const recordIds: string[] = []

  const transaction = db.transaction(() => {
    for (const r of records) {
      const id = uuidv4()
      recordIds.push(id)
      insertRecord.run(
        id,
        projectId,
        r.source,
        JSON.stringify(r.rawRow),
        r.locationName,
        r.address,
        r.longitude,
        r.latitude,
        r.period,
        r.sunlightHours,
        r.complaint,
        r.remark,
        r.rawRemark,
        now
      )
    }
  })

  transaction()

  const updateProject = db.prepare(`UPDATE projects SET status = 'prechecking', updated_at = ? WHERE id = ?`)
  updateProject.run(now, projectId)
}
