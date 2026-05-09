import { describe, test, expect } from 'vitest'
import { v4 as uuidv4 } from 'uuid'
import http from 'http'

const BASE_URL = 'localhost'
const BASE_PORT = 3001

function httpRequest(options: http.RequestOptions, body?: string): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: BASE_URL,
        port: BASE_PORT,
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': body ? Buffer.byteLength(body) : 0,
          ...options.headers
        }
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            data: data ? JSON.parse(data) : null
          })
        })
      }
    )

    req.on('error', reject)

    if (body) {
      req.write(body)
    }
    req.end()
  })
}

async function createTestDevice(): Promise<string> {
  const requestId = uuidv4()
  const body = JSON.stringify({
    code: `TEST-${Date.now()}-${Math.random()}`,
    name: '测试设备',
    type: '测试设备类型',
    requestId
  })

  const response = await httpRequest(
    {
      method: 'POST',
      path: '/api/devices',
      headers: {
        'X-Request-ID': requestId
      }
    },
    body
  )

  return response.data.data.id
}

describe('并发和幂等性测试', () => {
  test('并发借用同一个设备应该只有一个成功', async () => {
    const testDeviceId = await createTestDevice()
    
    const requestId1 = uuidv4()
    const requestId2 = uuidv4()
    
    const borrowData1 = JSON.stringify({
      deviceId: testDeviceId,
      purpose: '测试借用1',
      expectedReturnTime: new Date(Date.now() + 86400000).toISOString(),
      requestId: requestId1
    })

    const borrowData2 = JSON.stringify({
      deviceId: testDeviceId,
      purpose: '测试借用2',
      expectedReturnTime: new Date(Date.now() + 86400000).toISOString(),
      requestId: requestId2
    })

    const [result1, result2] = await Promise.all([
      httpRequest(
        {
          method: 'POST',
          path: '/api/borrow/borrow',
          headers: { 'X-Request-ID': requestId1 }
        },
        borrowData1
      ),
      httpRequest(
        {
          method: 'POST',
          path: '/api/borrow/borrow',
          headers: { 'X-Request-ID': requestId2 }
        },
        borrowData2
      )
    ])

    let successCount = 0
    let conflictCount = 0

    if (result1.data?.success) {
      successCount++
    } else if (result1.data?.error?.code === 'CONFLICT') {
      conflictCount++
    }

    if (result2.data?.success) {
      successCount++
    } else if (result2.data?.error?.code === 'CONFLICT') {
      conflictCount++
    }

    expect(successCount).toBe(1)
    expect(conflictCount).toBe(1)
  }, 30000)

  test('相同请求ID重复提交应该返回相同结果（幂等性）', async () => {
    const testDevice = await createTestDevice()
    const requestId = uuidv4()
    
    const borrowData = JSON.stringify({
      deviceId: testDevice,
      purpose: '测试幂等性',
      expectedReturnTime: new Date(Date.now() + 86400000).toISOString(),
      requestId
    })

    const response1 = await httpRequest(
      {
        method: 'POST',
        path: '/api/borrow/borrow',
        headers: { 'X-Request-ID': requestId }
      },
      borrowData
    )

    const response2 = await httpRequest(
      {
        method: 'POST',
        path: '/api/borrow/borrow',
        headers: { 'X-Request-ID': requestId }
      },
      borrowData
    )

    expect(response1.data.success).toBe(true)
    expect(response2.data.success).toBe(true)
    expect(response1.data.data.id).toBe(response2.data.data.id)
  }, 30000)

  test('归还操作应该正确更新设备状态', async () => {
    const testDevice = await createTestDevice()
    const requestId = uuidv4()

    const borrowData = JSON.stringify({
      deviceId: testDevice,
      purpose: '测试归还',
      expectedReturnTime: new Date(Date.now() + 86400000).toISOString(),
      requestId
    })

    const borrowResponse = await httpRequest(
      {
        method: 'POST',
        path: '/api/borrow/borrow',
        headers: { 'X-Request-ID': requestId }
      },
      borrowData
    )

    expect(borrowResponse.data.success).toBe(true)
    const borrowRecordId = borrowResponse.data.data.id

    const returnRequestId = uuidv4()
    const returnData = JSON.stringify({
      borrowRecordId,
      notes: '测试归还备注',
      requestId: returnRequestId
    })

    const returnResponse = await httpRequest(
      {
        method: 'POST',
        path: '/api/borrow/return',
        headers: { 'X-Request-ID': returnRequestId }
      },
      returnData
    )

    expect(returnResponse.data.success).toBe(true)
    expect(returnResponse.data.data.status).toBe('returned')

    const deviceResponse = await httpRequest({
      method: 'GET',
      path: `/api/devices/${testDevice}`
    })

    expect(deviceResponse.data.data.status).toBe('available')
  }, 30000)

  test('版本号不匹配时应该返回乐观锁错误', async () => {
    const testDevice = await createTestDevice()
    
    const borrowRequestId1 = uuidv4()
    const borrowData1 = JSON.stringify({
      deviceId: testDevice,
      purpose: '测试乐观锁1',
      expectedReturnTime: new Date(Date.now() + 86400000).toISOString(),
      requestId: borrowRequestId1
    })

    const borrowResponse1 = await httpRequest(
      {
        method: 'POST',
        path: '/api/borrow/borrow',
        headers: { 'X-Request-ID': borrowRequestId1 }
      },
      borrowData1
    )

    expect(borrowResponse1.data.success).toBe(true)
    const borrowRecordId = borrowResponse1.data.data.id
    const currentVersion = borrowResponse1.data.data.version
    const wrongVersion = currentVersion + 100

    const returnRequestId = uuidv4()
    const returnData = JSON.stringify({
      borrowRecordId: borrowRecordId,
      version: wrongVersion,
      requestId: returnRequestId
    })

    const returnResponse = await httpRequest(
      {
        method: 'POST',
        path: '/api/borrow/return',
        headers: { 'X-Request-ID': returnRequestId }
      },
      returnData
    )

    expect(returnResponse.data.error?.code).toBe('OPTIMISTIC_LOCK_ERROR')
  }, 30000)

  test('操作审计日志应该正确记录', async () => {
    const testDevice = await createTestDevice()
    const requestId = uuidv4()

    const borrowData = JSON.stringify({
      deviceId: testDevice,
      purpose: '测试审计日志',
      expectedReturnTime: new Date(Date.now() + 86400000).toISOString(),
      requestId
    })

    const borrowResponse = await httpRequest(
      {
        method: 'POST',
        path: '/api/borrow/borrow',
        headers: { 'X-Request-ID': requestId }
      },
      borrowData
    )

    expect(borrowResponse.data.success).toBe(true)

    const auditResponse = await httpRequest({
      method: 'GET',
      path: `/api/audit?entityType=device&entityId=${testDevice}&page=1&pageSize=10`
    })

    expect(auditResponse.data.success).toBe(true)
    expect(auditResponse.data.data.items.length).toBeGreaterThan(0)

    const borrowLog = auditResponse.data.data.items.find((log: any) => log.action === 'borrow')
    expect(borrowLog).toBeDefined()
    expect(borrowLog.entityId).toBe(testDevice)
    expect(borrowLog.before?.status).toBe('available')
    expect(borrowLog.after?.status).toBe('borrowed')
  }, 30000)
})
