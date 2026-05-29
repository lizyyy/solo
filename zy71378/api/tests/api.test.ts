import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../app.js'
import db from '../db.js'

describe('Callbacks API', () => {
  beforeAll(() => {
    db.prepare("DELETE FROM callback_records WHERE id LIKE 'test_%'").run()
  })

  afterAll(() => {
    db.prepare("DELETE FROM callback_records WHERE id LIKE 'test_%'").run()
  })

  it('GET /api/callbacks returns list with pagination', async () => {
    const res = await request(app).get('/api/callbacks?page=1&limit=5')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.total).toBeGreaterThan(0)
    expect(res.body.page).toBe(1)
    expect(res.body.limit).toBe(5)
  })

  it('GET /api/callbacks filters by signature_status', async () => {
    const res = await request(app).get('/api/callbacks?signature_status=expired')
    expect(res.status).toBe(200)
    expect(res.body.data.every((c: any) => c.signature_status === 'expired')).toBe(true)
  })

  it('GET /api/callbacks filters by order_status', async () => {
    const res = await request(app).get('/api/callbacks?order_status=paid')
    expect(res.status).toBe(200)
    expect(res.body.data.every((c: any) => c.order_status === 'paid')).toBe(true)
  })

  it('GET /api/callbacks/:id returns single callback', async () => {
    const res = await request(app).get('/api/callbacks/cb_001')
    expect(res.status).toBe(200)
    expect(res.body.id).toBe('cb_001')
  })

  it('GET /api/callbacks/:id returns 404 for missing', async () => {
    const res = await request(app).get('/api/callbacks/nonexistent')
    expect(res.status).toBe(404)
  })

  it('POST /api/callbacks/import - duplicate callback gets pending confirm', async () => {
    const res = await request(app)
      .post('/api/callbacks/import')
      .send({
        records: [{
          id: 'test_dup_001',
          webhook_id: 'wh_pay_001',
          timestamp: '2026-05-29T11:00:00Z',
          signature_header: 'sha256=abc123',
          order_id: 'ORD-20260529-001',
          order_status: 'paid',
          retry_count: 2,
          raw_payload: '{"event":"payment.success","amount":100.00}',
        }],
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.summary.duplicates).toBeGreaterThanOrEqual(1)

    const callback = db.prepare('SELECT * FROM callback_records WHERE id = ?').get('test_dup_001') as any
    expect(callback).toBeDefined()
    expect(callback.confirm_status).toBe('pending')
  })

  it('POST /api/callbacks/import - missing order_id gets error', async () => {
    const res = await request(app)
      .post('/api/callbacks/import')
      .send({
        records: [{
          id: 'test_missing_001',
          webhook_id: 'wh_pay_100',
          timestamp: '2026-05-29T11:00:00Z',
          order_status: 'paid',
        }],
      })

    expect(res.status).toBe(200)
    expect(res.body.summary.errors).toBeGreaterThanOrEqual(1)
  })

  it('POST /api/callbacks/import - status regression gets pending confirm', async () => {
    const res = await request(app)
      .post('/api/callbacks/import')
      .send({
        records: [{
          id: 'test_regression_001',
          webhook_id: 'wh_pay_099',
          timestamp: '2026-05-29T12:00:00Z',
          signature_header: 'sha256=regtest',
          order_id: 'ORD-REG-TEST-001',
          order_status: 'pending',
          previous_status: 'paid',
          raw_payload: '{"event":"payment.regression"}',
        }],
      })

    expect(res.status).toBe(200)
    expect(res.body.summary.regressions).toBeGreaterThanOrEqual(1)

    const callback = db.prepare('SELECT * FROM callback_records WHERE id = ?').get('test_regression_001') as any
    expect(callback).toBeDefined()
    expect(callback.confirm_status).toBe('pending')
  })

  it('POST /api/callbacks/import - non-array returns 400', async () => {
    const res = await request(app)
      .post('/api/callbacks/import')
      .send({ records: 'not an array' })

    expect(res.status).toBe(400)
  })

  it('PATCH /api/callbacks/:id/confirm updates confirm status', async () => {
    const res = await request(app)
      .patch('/api/callbacks/test_dup_001/confirm')
      .send({ confirm_status: 'confirmed', confirm_note: '审计确认' })

    expect(res.status).toBe(200)
    expect(res.body.confirm_status).toBe('confirmed')
    expect(res.body.confirm_note).toBe('审计确认')
  })

  it('PATCH /api/callbacks/:id/confirm requires confirm_status', async () => {
    const res = await request(app)
      .patch('/api/callbacks/test_dup_001/confirm')
      .send({ confirm_note: 'note' })

    expect(res.status).toBe(400)
  })

  it('PATCH /api/callbacks/:id/confirm returns 404 for missing', async () => {
    const res = await request(app)
      .patch('/api/callbacks/nonexistent/confirm')
      .send({ confirm_status: 'confirmed' })

    expect(res.status).toBe(404)
  })
})

describe('Stats API', () => {
  it('GET /api/stats/overview returns report', async () => {
    const res = await request(app).get('/api/stats/overview')
    expect(res.status).toBe(200)
    expect(res.body.total_callbacks).toBeGreaterThan(0)
    expect(typeof res.body.signature_valid).toBe('number')
    expect(typeof res.body.pending_confirmations).toBe('number')
  })

  it('GET /api/stats/overview applies filters', async () => {
    const allRes = await request(app).get('/api/stats/overview')
    const filteredRes = await request(app).get('/api/stats/overview?signature_status=expired')

    expect(filteredRes.body.total_callbacks).toBeLessThanOrEqual(allRes.body.total_callbacks)
  })

  it('GET /api/stats/retry-distribution returns distribution', async () => {
    const res = await request(app).get('/api/stats/retry-distribution')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('GET /api/stats/status-distribution returns distribution', async () => {
    const res = await request(app).get('/api/stats/status-distribution')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('GET /api/stats/trend returns trend data', async () => {
    const res = await request(app).get('/api/stats/trend')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})

describe('Replay API', () => {
  beforeEach(() => {
    db.prepare("DELETE FROM replay_tasks WHERE id NOT IN ('rp_001', 'rp_002')").run()
  })

  it('GET /api/replay-tasks returns list', async () => {
    const res = await request(app).get('/api/replay-tasks')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('POST /api/replay-tasks creates replay task', async () => {
    const res = await request(app)
      .post('/api/replay-tasks')
      .send({ callback_ids: ['cb_005'] })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.length).toBeGreaterThan(0)

    const task = res.body.data[0]
    expect(task.callback_id).toBe('cb_005')
    expect(task.status).toBe('queued')
  })

  it('POST /api/replay-tasks requires callback_ids', async () => {
    const res = await request(app)
      .post('/api/replay-tasks')
      .send({})

    expect(res.status).toBe(400)
  })

  it('POST /api/replay-tasks/:id/execute executes a task', async () => {
    const createRes = await request(app)
      .post('/api/replay-tasks')
      .send({ callback_ids: ['cb_006'] })

    expect(createRes.status).toBe(200)
    const taskId = createRes.body.data[0]?.id
    if (!taskId) return

    const execRes = await request(app)
      .post(`/api/replay-tasks/${taskId}/execute`)

    expect(execRes.status).toBe(200)
  })

  it('POST /api/replay-tasks/:id/execute returns 404 for missing', async () => {
    const res = await request(app)
      .post('/api/replay-tasks/nonexistent/execute')

    expect(res.status).toBe(404)
  })

  it('GET /api/replay-tasks/:id returns task detail', async () => {
    const res = await request(app).get('/api/replay-tasks/rp_001')
    expect(res.status).toBe(200)
    expect(res.body.id).toBe('rp_001')
  })
})

describe('Reports API', () => {
  it('GET /api/reports/audit returns audit report', async () => {
    const res = await request(app).get('/api/reports/audit')
    expect(res.status).toBe(200)
    expect(res.body.total_callbacks).toBeGreaterThan(0)
    expect(res.body.generated_at).toBeDefined()
  })

  it('GET /api/reports/export returns CSV', async () => {
    const res = await request(app).get('/api/reports/export?format=csv')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.headers['content-disposition']).toContain('audit-report.csv')
  })

  it('GET /api/reports/export returns JSON', async () => {
    const res = await request(app).get('/api/reports/export?format=json')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/json')
    expect(res.headers['content-disposition']).toContain('audit-report.json')
  })

  it('GET /api/reports/export applies same filters as callbacks', async () => {
    const csvRes = await request(app).get('/api/reports/export?format=csv&signature_status=expired')
    expect(csvRes.status).toBe(200)

    const callbacksRes = await request(app).get('/api/callbacks?signature_status=expired')
    expect(callbacksRes.status).toBe(200)

    const csvLines = csvRes.text.split('\n').filter((l: string) => l.trim())
    expect(csvLines.length - 1).toBe(callbacksRes.body.total)
  })

  it('PATCH /api/reports/annotations/:id updates note', async () => {
    const res = await request(app)
      .patch('/api/reports/annotations/cb_001')
      .send({ note: '审计备注更新' })

    expect(res.status).toBe(200)
    expect(res.body.confirm_note).toBe('审计备注更新')
  })

  it('PATCH /api/reports/annotations/:id returns 404 for missing', async () => {
    const res = await request(app)
      .patch('/api/reports/annotations/nonexistent')
      .send({ note: 'test' })

    expect(res.status).toBe(404)
  })
})

describe('Verify API', () => {
  it('POST /api/verify/signature verifies signature', async () => {
    const res = await request(app)
      .post('/api/verify/signature')
      .send({
        payload: '{"event":"test"}',
        signature_header: 'sha256=abc123',
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(typeof res.body.valid).toBe('boolean')
  })

  it('POST /api/verify/signature requires payload', async () => {
    const res = await request(app)
      .post('/api/verify/signature')
      .send({ signature_header: 'sha256=abc' })

    expect(res.status).toBe(400)
  })

  it('POST /api/verify/signature null header returns not valid', async () => {
    const res = await request(app)
      .post('/api/verify/signature')
      .send({ payload: '{"event":"test"}', signature_header: null })

    expect(res.status).toBe(200)
    expect(res.body.valid).toBe(false)
  })
})

describe('Signature Verifier Service', () => {
  it('detects expired signature', async () => {
    const { verifySignature } = await import('../services/signatureVerifier.js')
    const oldTimestamp = Date.now() - 10 * 60 * 1000
    const header = `sha256=abc,t=${oldTimestamp}`
    const result = verifySignature('test', header)
    expect(result.expired).toBe(true)
  })

  it('detects missing signature header', async () => {
    const { verifySignature } = await import('../services/signatureVerifier.js')
    const result = verifySignature('test', null)
    expect(result.valid).toBe(false)
  })

  it('detects empty signature header', async () => {
    const { verifySignature } = await import('../services/signatureVerifier.js')
    const result = verifySignature('test', '')
    expect(result.valid).toBe(false)
  })
})

describe('Status Tracker Service', () => {
  it('detects status regression', async () => {
    const { detectStatusRegression } = await import('../services/statusTracker.js')
    expect(detectStatusRegression('paid', 'pending')).toBe(true)
    expect(detectStatusRegression('refunded', 'paid')).toBe(true)
    expect(detectStatusRegression('pending', 'paid')).toBe(false)
    expect(detectStatusRegression('paid', 'refunded')).toBe(false)
  })

  it('handles unknown status as potential regression', async () => {
    const { detectStatusRegression } = await import('../services/statusTracker.js')
    expect(detectStatusRegression('unknown_status', 'pending')).toBe(true)
  })

  it('returns false for null current status', async () => {
    const { detectStatusRegression } = await import('../services/statusTracker.js')
    expect(detectStatusRegression('', 'paid')).toBe(false)
  })
})

describe('Idempotency Checker Service', () => {
  it('detects duplicate by order_id', async () => {
    const { checkIdempotency } = await import('../services/idempotencyChecker.js')
    const result = checkIdempotency('ORD-20260529-001', 'some_new_id', db)
    expect(result.isDuplicate).toBe(true)
  })

  it('no duplicate for unique order', async () => {
    const { checkIdempotency } = await import('../services/idempotencyChecker.js')
    const result = checkIdempotency('ORD-BRAND-NEW-999', 'some_new_id', db)
    expect(result.isDuplicate).toBe(false)
  })
})
