import { Router, type Request, type Response } from 'express'
import {
  importCalibrationData,
  supplementPhoto,
  manualCorrect,
  rerunCalibration,
  resetDatabase,
  getRecords,
} from '../services/calibrationService.js'
import { getDb } from '../db/database.js'

const router = Router()

function seedDemoData() {
  const record1 = importCalibrationData({
    beaconId: 'BEACON-A01',
    originDescription: 'A栋1层大厅入口信标，经纬度参考点为园区GPS基准站',
    coordinates: [
      { pointName: 'A01-原点', type: 'latlng', lat: 31.2304, lng: 121.4737 },
    ],
    photoIds: ['A01-2024-001', 'A01-2024-002'],
  })

  const record2 = importCalibrationData({
    beaconId: 'BEACON-B03',
    originDescription: 'B栋3层走廊中段信标，米制坐标原点为B栋西南角',
    coordinates: [
      { pointName: 'B03-参考点', type: 'metric', x: 12.5, y: 33.8, z: 0.0 },
    ],
  })

  supplementPhoto(record2.recordId, ['B03-2024-001', 'B03-2024-002'], '巡检员张三')

  const record3 = importCalibrationData({
    beaconId: 'BEACON-C07',
    originDescription: 'C栋地下1层停车场入口信标',
    coordinates: [
      { pointName: 'C07-原点', type: 'latlng', lat: 31.2315, lng: 121.4745 },
    ],
    photoIds: ['C07-2024-001'],
  })

  const db = getDb()
  const coord3 = db
    .prepare('SELECT id FROM coordinate_entries WHERE record_id = ?')
    .get(record3.recordId) as { id: string }

  manualCorrect(
    record3.recordId,
    coord3.id,
    { lat: 31.2310 },
    '运维工程师李四',
    '原始GPS读数偏差0.0005度，参照巡检照片C07-2024-001修正',
  )

  const record4 = importCalibrationData({
    beaconId: 'BEACON-D12',
    originDescription: 'D栋2层会议室信标，坐标原点为D栋东北角',
    coordinates: [
      { pointName: 'D12-原点', type: 'metric', x: 45.2, y: 18.7, z: 3.5 },
    ],
    photoIds: ['D12-2024-001'],
  })

  rerunCalibration(record4.recordId, '运维工程师王五')

  importCalibrationData({
    beaconId: 'BEACON-E05',
    originDescription: 'E栋连廊信标，原始数据中经纬度和米制坐标混用',
    coordinates: [
      { pointName: 'E05-原点', type: 'mixed', lat: 31.2298, lng: 121.4730, x: 5.3, y: 22.1, z: 0.0 },
    ],
  })
}

router.get('/seed', (req: Request, res: Response): void => {
  try {
    const existing = getRecords()
    if (existing.length > 0) {
      res.json({ success: true, data: { message: '数据已存在，如需重置请使用 /api/demo/reset', count: existing.length } })
      return
    }
    seedDemoData()
    res.json({ success: true, data: { message: 'Demo数据种子完成', count: getRecords().length } })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/reset', (req: Request, res: Response): void => {
  try {
    resetDatabase()
    seedDemoData()
    res.json({ success: true, data: { message: '数据已重置并重新种子', count: getRecords().length } })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
