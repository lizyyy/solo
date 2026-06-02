import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

router.post('/sample', (req: Request, res: Response): void => {
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM audit_logs').run()
    db.prepare('DELETE FROM tracks').run()

    const insertStmt = db.prepare(`
      INSERT INTO tracks (name, version, source, audio_file_path, contract_id, auth_start_date, auth_end_date, contract_note, status)
      VALUES (@name, @version, @source, @audio_file_path, @contract_id, @auth_start_date, @auth_end_date, @contract_note, @status)
    `)

    const sampleData = [
      {
        name: '月光奏鸣曲',
        version: 'v2',
        source: 'excel',
        audio_file_path: '/audio/moonlight_v2.wav',
        contract_id: 'CT-2024-001',
        auth_start_date: '2024-01-01',
        auth_end_date: '2026-12-31',
        contract_note: '授权期至2026年底',
        status: 'pending',
      },
      {
        name: '月光奏鸣曲',
        version: 'v1',
        source: 'excel',
        audio_file_path: '/audio/moonlight_v1.wav',
        contract_id: 'CT-2023-001',
        auth_start_date: '2023-01-01',
        auth_end_date: '2024-12-31',
        contract_note: '旧版授权已过期',
        status: 'pending',
      },
      {
        name: '天鹅湖',
        version: 'v1',
        source: 'contract',
        audio_file_path: '/audio/swan_lake.wav',
        contract_id: 'CT-2024-003',
        auth_start_date: '2024-03-01',
        auth_end_date: '2026-03-01',
        contract_note: null,
        status: 'pending',
      },
      {
        name: '天鹅湖',
        version: 'v1',
        source: 'excel',
        audio_file_path: '/audio/swan_lake_dup.wav',
        contract_id: 'CT-2024-003',
        auth_start_date: '2024-03-01',
        auth_end_date: '2026-03-01',
        contract_note: '与合同记录重复',
        status: 'pending',
      },
      {
        name: '卡门序曲',
        version: 'v1',
        source: 'excel',
        audio_file_path: '/audio/carmen.wav',
        contract_id: null,
        auth_start_date: null,
        auth_end_date: null,
        contract_note: '合同待补充',
        status: 'pending',
      },
      {
        name: '蓝色多瑙河（修订版）',
        version: 'v1',
        source: 'manual',
        audio_file_path: '/audio/danube_revised.wav',
        contract_id: 'CT-2024-006',
        auth_start_date: '2024-06-01',
        auth_end_date: '2026-06-01',
        contract_note: "原名'蓝色多瑙河'，运营手动改名",
        status: 'pending',
      },
      {
        name: '春之声圆舞曲',
        version: 'v1',
        source: 'excel',
        audio_file_path: null,
        contract_id: 'CT-OLD-2020',
        auth_start_date: '2020-01-01',
        auth_end_date: '2022-01-01',
        contract_note: '旧口径录入，授权已过期，仅供参考',
        status: 'pending',
      },
    ]

    for (const data of sampleData) {
      insertStmt.run(data)
    }

    return sampleData.length
  })

  const count = transaction()

  res.json({
    success: true,
    data: { insertedCount: count },
  })
})

export default router
