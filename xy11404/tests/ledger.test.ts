import request from 'supertest'
import app from '../src/index'
import { DataSource, LedgerStatus } from '@prisma/client'

describe('冷链台账 API - 状态流转测试', () => {
  let ledgerId: string

  beforeEach(async () => {
    const response = await request(app)
      .post('/api/ledgers')
      .send({
        boxNo: 'TEST-BOX-001',
        batchNo: 'TEST-BATCH-001',
        driverId: 'DRV-TEST-001',
        driverName: '测试司机',
        driverPhone: '13800000001',
        receiveDate: '2024-01-15T00:00:00.000Z',
        crossDaySign: false,
        boxNameChange: false,
        temperatureMin: -18,
        temperatureMax: -15,
        compensationAmount: 0,
        source: DataSource.WMS_BOX,
        createdBy: 'test_user',
      })

    ledgerId = response.body.id
    expect(response.status).toBe(201)
    expect(response.body.status).toBe(LedgerStatus.DRAFT)
  })

  describe('正常状态流转', () => {
    it('草稿 -> 提交 -> 确认 -> 审计', async () => {
      let response = await request(app)
        .post(`/api/ledgers/${ledgerId}/submit`)
        .send({
          changedBy: 'warehouse_staff',
          changeReason: '数据录入完成，申请审核',
        })
      expect(response.status).toBe(200)
      expect(response.body.status).toBe(LedgerStatus.SUBMITTED)
      expect(response.body.confirmedBy).toBeNull()

      response = await request(app)
        .post(`/api/ledgers/${ledgerId}/confirm`)
        .send({
          changedBy: 'supervisor',
          changeReason: '数据核实无误，确认通过',
        })
      expect(response.status).toBe(200)
      expect(response.body.status).toBe(LedgerStatus.CONFIRMED)
      expect(response.body.confirmedBy).toBe('supervisor')
      expect(response.body.confirmedAt).not.toBeNull()

      response = await request(app)
        .post(`/api/ledgers/${ledgerId}/audit`)
        .send({
          changedBy: 'auditor',
          changeReason: '审计通过，归档',
        })
      expect(response.status).toBe(200)
      expect(response.body.status).toBe(LedgerStatus.AUDITED)
      expect(response.body.auditedBy).toBe('auditor')
    })

    it('草稿 -> 提交 -> 驳回 -> 修改 -> 重新提交 -> 确认', async () => {
      let response = await request(app)
        .post(`/api/ledgers/${ledgerId}/submit`)
        .send({
          changedBy: 'warehouse_staff',
          changeReason: '数据录入完成',
        })
      expect(response.body.status).toBe(LedgerStatus.SUBMITTED)

      response = await request(app)
        .post(`/api/ledgers/${ledgerId}/reject`)
        .send({
          changedBy: 'supervisor',
          changeReason: '需要补充资料',
          rejectionReason: '缺少司机签字照片',
        })
      expect(response.status).toBe(200)
      expect(response.body.status).toBe(LedgerStatus.REJECTED)
      expect(response.body.rejectedBy).toBe('supervisor')
      expect(response.body.rejectionReason).toBe('缺少司机签字照片')

      response = await request(app)
        .put(`/api/ledgers/${ledgerId}`)
        .send({
          compensationAmount: 100,
          changeReason: '修正赔付金额并补充签字照片',
        })
      expect(response.status).toBe(200)
      expect(response.body.ledger.status).toBe(LedgerStatus.REJECTED)
      expect(response.body.diff).toBeDefined()

      response = await request(app)
        .post(`/api/ledgers/${ledgerId}/submit`)
        .send({
          changedBy: 'warehouse_staff',
          changeReason: '补充资料后重新提交',
        })
      expect(response.body.status).toBe(LedgerStatus.SUBMITTED)

      response = await request(app)
        .post(`/api/ledgers/${ledgerId}/confirm`)
        .send({
          changedBy: 'supervisor',
          changeReason: '资料齐全，确认通过',
        })
      expect(response.body.status).toBe(LedgerStatus.CONFIRMED)
    })
  })

  describe('非法状态转换', () => {
    it('不允许直接从草稿跳转到确认', async () => {
      const response = await request(app)
        .post(`/api/ledgers/${ledgerId}/confirm`)
        .send({
          changedBy: 'supervisor',
          changeReason: '跳过提交直接确认',
        })
      expect(response.status).toBe(400)
      expect(response.body.error).toBe('ValidationError')
    })

    it('不允许从审计状态回到确认状态', async () => {
      await request(app)
        .post(`/api/ledgers/${ledgerId}/submit`)
        .send({ changedBy: 'staff', changeReason: '提交' })
      await request(app)
        .post(`/api/ledgers/${ledgerId}/confirm`)
        .send({ changedBy: 'supervisor', changeReason: '确认' })
      await request(app)
        .post(`/api/ledgers/${ledgerId}/audit`)
        .send({ changedBy: 'auditor', changeReason: '审计' })

      const response = await request(app)
        .post(`/api/ledgers/${ledgerId}/confirm`)
        .send({
          changedBy: 'supervisor',
          changeReason: '尝试从审计回到确认',
        })
      expect(response.status).toBe(400)
    })

    it('审计状态下不允许编辑', async () => {
      await request(app)
        .post(`/api/ledgers/${ledgerId}/submit`)
        .send({ changedBy: 'staff', changeReason: '提交' })
      await request(app)
        .post(`/api/ledgers/${ledgerId}/confirm`)
        .send({ changedBy: 'supervisor', changeReason: '确认' })
      await request(app)
        .post(`/api/ledgers/${ledgerId}/audit`)
        .send({ changedBy: 'auditor', changeReason: '审计' })

      const response = await request(app)
        .put(`/api/ledgers/${ledgerId}`)
        .send({
          compensationAmount: 999,
          changeReason: '尝试修改审计后的数据',
        })
      expect(response.status).toBe(400)
    })
  })

  describe('幂等性测试', () => {
    it('重复提交相同数据应返回相同结果', async () => {
      const createData = {
        boxNo: 'IDEMPOTENT-BOX-001',
        batchNo: 'IDEMPOTENT-BATCH-001',
        driverId: 'DRV-001',
        driverName: '张三',
        driverPhone: '13800000001',
        receiveDate: '2024-01-15T00:00:00.000Z',
        source: DataSource.WMS_BOX,
        createdBy: 'test_user',
      }

      const response1 = await request(app)
        .post('/api/ledgers')
        .send(createData)

      const response2 = await request(app)
        .post('/api/ledgers')
        .send(createData)

      expect(response1.status).toBe(201)
      expect(response2.status).toBe(201)
      expect(response1.body.boxNo).toBe(response2.body.boxNo)
      expect(response1.body.status).toBe(LedgerStatus.DRAFT)
      expect(response2.body.status).toBe(LedgerStatus.DRAFT)
    })

    it('多次执行同一状态转换应保持一致', async () => {
      await request(app)
        .post(`/api/ledgers/${ledgerId}/submit`)
        .send({ changedBy: 'staff', changeReason: '首次提交' })

      const response = await request(app)
        .post(`/api/ledgers/${ledgerId}/submit`)
        .send({ changedBy: 'staff', changeReason: '重复提交' })

      expect(response.status).toBe(400)
    })

    it('查询接口多次调用返回一致结果', async () => {
      const response1 = await request(app).get(`/api/ledgers/${ledgerId}`)
      const response2 = await request(app).get(`/api/ledgers/${ledgerId}`)

      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)
      expect(response1.body.id).toBe(response2.body.id)
      expect(response1.body.status).toBe(response2.body.status)
      expect(response1.body.updatedAt).toBe(response2.body.updatedAt)
    })
  })
})

describe('冷链台账 API - 历史记录和差异对比', () => {
  let ledgerId: string

  beforeEach(async () => {
    const response = await request(app)
      .post('/api/ledgers')
      .send({
        boxNo: 'HISTORY-BOX-001',
        batchNo: 'HISTORY-BATCH-001',
        driverId: 'DRV-001',
        driverName: '张三',
        driverPhone: '13800000001',
        receiveDate: '2024-01-15T00:00:00.000Z',
        temperatureMin: -18,
        temperatureMax: -15,
        source: DataSource.DRIVER_PHOTO,
        createdBy: 'test_user',
      })
    ledgerId = response.body.id
  })

  it('每次状态变更都应记录历史', async () => {
    await request(app)
      .post(`/api/ledgers/${ledgerId}/submit`)
      .send({ changedBy: 'staff', changeReason: '提交审核' })

    await request(app)
      .post(`/api/ledgers/${ledgerId}/confirm`)
      .send({ changedBy: 'supervisor', changeReason: '审核通过' })

    const historyResponse = await request(app)
      .get(`/api/ledgers/${ledgerId}/history`)

    expect(historyResponse.status).toBe(200)
    expect(historyResponse.body.length).toBeGreaterThanOrEqual(3)

    const statuses = historyResponse.body.map((h: any) => h.toStatus)
    expect(statuses).toContain(LedgerStatus.DRAFT)
    expect(statuses).toContain(LedgerStatus.SUBMITTED)
    expect(statuses).toContain(LedgerStatus.CONFIRMED)
  })

  it('编辑操作应记录字段差异', async () => {
    const updateResponse = await request(app)
      .put(`/api/ledgers/${ledgerId}`)
      .send({
        temperatureMin: -20,
        temperatureMax: -12,
        compensationAmount: 500,
        changeReason: '修正温度范围和赔付金额',
      })

    expect(updateResponse.body.diff).toBeDefined()
    const diffFields = updateResponse.body.diff.map((d: any) => d.field)
    expect(diffFields).toContain('temperatureMin')
    expect(diffFields).toContain('temperatureMax')
    expect(diffFields).toContain('compensationAmount')
  })
})

describe('冷链台账 API - 扫码明细和失败记录', () => {
  let ledgerId: string

  beforeEach(async () => {
    const response = await request(app)
      .post('/api/ledgers')
      .send({
        boxNo: 'SCAN-BOX-001',
        batchNo: 'SCAN-BATCH-001',
        driverId: 'DRV-001',
        driverName: '张三',
        driverPhone: '13800000001',
        receiveDate: '2024-01-15T00:00:00.000Z',
        source: DataSource.SCAN_DETAIL,
        createdBy: 'test_user',
      })
    ledgerId = response.body.id
  })

  it('可以追加扫码明细', async () => {
    const response = await request(app)
      .post(`/api/ledgers/${ledgerId}/scan-details`)
      .send({
        scanTime: '2024-01-15T08:30:00.000Z',
        scanLocation: '中转仓库A',
        operator: 'scan_op_001',
        temperature: -16,
        boxCondition: '完好',
        remark: '正常扫码',
      })

    expect(response.status).toBe(201)
    expect(response.body.scanLocation).toBe('中转仓库A')

    const ledgerResponse = await request(app).get(`/api/ledgers/${ledgerId}`)
    expect(ledgerResponse.body.scanDetails.length).toBe(1)
  })

  it('可以记录失败数据', async () => {
    const response = await request(app)
      .post(`/api/ledgers/${ledgerId}/failed-records`)
      .send({
        source: DataSource.TEMPERATURE_LOG,
        rawData: { temperature: 999, unit: 'invalid' },
        errorMessage: '温度数据超出有效范围',
      })

    expect(response.status).toBe(201)

    const failedResponse = await request(app)
      .get(`/api/ledgers/${ledgerId}/failed-records`)

    expect(failedResponse.status).toBe(200)
    expect(failedResponse.body.length).toBe(1)
    expect(failedResponse.body[0].errorMessage).toContain('超出有效范围')
  })
})

describe('冷链台账 API - 敏感字段和导出', () => {
  let ledgerId: string

  beforeEach(async () => {
    const response = await request(app)
      .post('/api/ledgers')
      .send({
        boxNo: 'MASK-BOX-001',
        batchNo: 'MASK-BATCH-001',
        driverId: 'DRV-001',
        driverName: '张三',
        driverPhone: '13812345678',
        receiveDate: '2024-01-15T00:00:00.000Z',
        source: DataSource.WMS_BOX,
        createdBy: 'test_user',
      })
    ledgerId = response.body.id
  })

  it('默认查询对敏感字段脱敏', async () => {
    const response = await request(app).get(`/api/ledgers/${ledgerId}`)
    expect(response.body.driverPhone).toBe('138****5678')
  })

  it('可以关闭脱敏查看原始数据', async () => {
    const response = await request(app)
      .get(`/api/ledgers/${ledgerId}?maskSensitive=false`)
    expect(response.body.driverPhone).toBe('13812345678')
  })

  it('可以导出CSV格式数据', async () => {
    const response = await request(app)
      .get(`/api/ledgers/export?format=csv`)

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toContain('text/csv')
    expect(response.text).toContain('boxNo')
    expect(response.text).toContain('MASK-BOX-001')
  })

  it('导出数据也支持脱敏', async () => {
    const response = await request(app)
      .get(`/api/ledgers/${ledgerId}/export?format=json&maskSensitive=true`)

    const data = JSON.parse(response.text)
    expect(data.driverPhone).toBe('138****5678')
  })
})

describe('冷链台账 API - 报表汇总', () => {
  beforeEach(async () => {
    const ledgers = [
      { boxNo: 'RPT-001', status: LedgerStatus.CONFIRMED, compensationAmount: 100 },
      { boxNo: 'RPT-002', status: LedgerStatus.CONFIRMED, compensationAmount: 200, crossDaySign: true },
      { boxNo: 'RPT-003', status: LedgerStatus.AUDITED, compensationAmount: 300, boxNameChange: true },
      { boxNo: 'RPT-004', status: LedgerStatus.SUBMITTED, compensationAmount: 500 },
    ]

    for (const ledger of ledgers) {
      await request(app)
        .post('/api/ledgers')
        .send({
          boxNo: ledger.boxNo,
          batchNo: 'RPT-BATCH-001',
          driverId: 'DRV-001',
          driverName: '张三',
          driverPhone: '13800000001',
          receiveDate: '2024-01-15T00:00:00.000Z',
          crossDaySign: ledger.crossDaySign,
          boxNameChange: ledger.boxNameChange,
          temperatureMin: -18,
          temperatureMax: -15,
          compensationAmount: ledger.compensationAmount,
          source: DataSource.WMS_BOX,
          createdBy: 'test_user',
        })
        .then(async (res) => {
          const id = res.body.id
          if (ledger.status === LedgerStatus.SUBMITTED) {
            await request(app)
              .post(`/api/ledgers/${id}/submit`)
              .send({ changedBy: 'staff', changeReason: '提交' })
          } else if (ledger.status === LedgerStatus.CONFIRMED || ledger.status === LedgerStatus.AUDITED) {
            await request(app)
              .post(`/api/ledgers/${id}/submit`)
              .send({ changedBy: 'staff', changeReason: '提交' })
            await request(app)
              .post(`/api/ledgers/${id}/confirm`)
              .send({ changedBy: 'supervisor', changeReason: '确认' })
            if (ledger.status === LedgerStatus.AUDITED) {
              await request(app)
                .post(`/api/ledgers/${id}/audit`)
                .send({ changedBy: 'auditor', changeReason: '审计' })
            }
          }
        })
    }
  })

  it('报表只统计已确认及以上状态的数据', async () => {
    const response = await request(app).get('/api/ledgers/report/summary')

    expect(response.status).toBe(200)
    expect(response.body.totalValidLedgers).toBe(3)
    expect(response.body.totalCompensation).toBe(600)
  })

  it('报表统计跨日签收和箱号改名数量', async () => {
    const response = await request(app).get('/api/ledgers/report/summary')

    expect(response.body.crossDayCount).toBe(1)
    expect(response.body.boxNameChangeCount).toBe(1)
  })
})
