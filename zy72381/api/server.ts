import express from 'express'
import cors from 'cors'
import type { TemperatureRecord, ExceptionRecord, Sensor } from '../src/types'
import { mockRecords, mockExceptions, mockSensors } from '../src/data/mockData'
import { validateDirection } from '../src/utils/calibration'
import { performEstimation } from '../src/utils/estimation'
import { generateId, generateRecordNo } from '../src/utils/formatters'

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

let records: TemperatureRecord[] = [...mockRecords]
let exceptions: ExceptionRecord[] = [...mockExceptions]
let sensors: Sensor[] = [...mockSensors]

app.get('/api/records', (req, res) => {
  const { status } = req.query
  let result = records
  if (status) {
    result = records.filter((r) => r.status === status)
  }
  res.json(result)
})

app.get('/api/records/:id', (req, res) => {
  const record = records.find((r) => r.id === req.params.id)
  if (!record) {
    return res.status(404).json({ error: '记录不存在' })
  }
  res.json(record)
})

app.post('/api/records/import', (req, res) => {
  const newRecords = req.body
  if (!Array.isArray(newRecords)) {
    return res.status(400).json({ error: '数据格式错误' })
  }

  const importedRecords: TemperatureRecord[] = newRecords.map((record: any, index) => {
    const recordId = generateId()
    const recordNo = generateRecordNo(records.length + index + 1)
    const validation = validateDirection(record.directionMark || '')

    let status: TemperatureRecord['status'] = 'imported'
    let estimatedValue: number | undefined

    if (validation.needsReview) {
      status = 'pending_review'
    } else if (validation.isValid) {
      status = 'success'
      const tempRecord = {
        ...record,
        tempDiff: record.tempDiff || (record.endTemp || 0) - (record.startTemp || 0),
        normalizedDirection: validation.normalizedDirection
      }
      const result = performEstimation(tempRecord)
      estimatedValue = result.expansionValue
    }

    const newRecord: TemperatureRecord = {
      id: recordId,
      recordNo,
      type: validation.needsReview ? 'left' : record.sensorId ? 'supplement' : 'normal',
      startTime: record.startTime || new Date().toISOString(),
      endTime: record.endTime || new Date().toISOString(),
      startTemp: record.startTemp || 0,
      endTemp: record.endTemp || 0,
      tempDiff: record.tempDiff || (record.endTemp || 0) - (record.startTemp || 0),
      directionMark: record.directionMark || '',
      sensorId: record.sensorId,
      status,
      normalizedDirection: validation.normalizedDirection,
      estimatedValue,
      operationHistory: [
        {
          id: generateId(),
          type: 'import',
          operator: '何工',
          description: `通过API导入温度校准记录${estimatedValue ? `，估算伸缩量 ${estimatedValue.toFixed(2)}mm` : ''}`,
          timestamp: new Date().toISOString()
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    if (validation.needsReview) {
      exceptions.push({
        id: generateId(),
        recordId,
        recordNo,
        exceptionType: 'direction_mismatch',
        status: 'pending_review',
        sensorId: record.sensorId,
        description: validation.warning || '方向口径不统一，需实验老师复核',
        operator: '系统',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    }

    if (!record.sensorId) {
      exceptions.push({
        id: generateId(),
        recordId,
        recordNo,
        exceptionType: 'missing_sensor',
        status: 'pending',
        description: '缺失传感器编号，待何工补录',
        operator: '系统',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    }

    return newRecord
  })

  records = [...records, ...importedRecords]
  res.json({ imported: importedRecords.length, records: importedRecords })
})

app.get('/api/sensors', (req, res) => {
  res.json(sensors)
})

app.get('/api/sensors/:id', (req, res) => {
  const sensor = sensors.find((s) => s.sensorNo === req.params.id)
  if (!sensor) {
    return res.status(404).json({ error: '传感器不存在' })
  }
  res.json(sensor)
})

app.post('/api/records/:id/supplement', (req, res) => {
  const { sensorNo } = req.body
  const record = records.find((r) => r.id === req.params.id)
  if (!record) {
    return res.status(404).json({ error: '记录不存在' })
  }

  const sensor = sensors.find((s) => s.sensorNo === sensorNo)
  if (!sensor) {
    return res.status(404).json({ error: '传感器不存在' })
  }

  const hasOldCalibration = sensor.oldCalibrationData && sensor.oldCalibrationData.length > 0

  record.sensorId = sensorNo
  record.status = 'supplemented'
  record.oldCalibrationData = sensor.oldCalibrationData
  record.updatedAt = new Date().toISOString()
  record.operationHistory.push({
    id: generateId(),
    type: 'supplement',
    operator: '何工',
    description: `补录传感器编号：${sensorNo}${hasOldCalibration ? '，已关联' + sensorNo + '的2020版旧口径数据' : ''}`,
    timestamp: new Date().toISOString(),
    oldValue: null,
    newValue: sensorNo
  })

  if (record.normalizedDirection) {
    const result = performEstimation(record)
    record.estimatedValue = result.expansionValue
    record.operationHistory.push({
      id: generateId(),
      type: 'rerun',
      operator: '系统',
      description: `补录后重算完成：伸缩量 ${result.expansionValue.toFixed(2)}mm`,
      timestamp: new Date().toISOString()
    })
  }

  const missingException = exceptions.find(
    (e) => e.recordId === record.id && e.exceptionType === 'missing_sensor'
  )
  if (missingException) {
    missingException.exceptionType = 'supplemented'
    missingException.status = 'supplemented'
    missingException.sensorId = sensorNo
    missingException.description = `缺失传感器编号后补录，已关联${sensorNo}${hasOldCalibration ? '的2020版旧口径数据' : ''}`
    missingException.operator = '何工'
    missingException.updatedAt = new Date().toISOString()
  }

  res.json(record)
})

app.get('/api/exceptions', (req, res) => {
  const { status } = req.query
  let result = exceptions
  if (status) {
    result = exceptions.filter((e) => e.status === status)
  }
  res.json(result)
})

app.post('/api/estimate/:id', (req, res) => {
  const record = records.find((r) => r.id === req.params.id)
  if (!record) {
    return res.status(404).json({ error: '记录不存在' })
  }

  const result = performEstimation(record)
  record.estimatedValue = result.expansionValue
  record.updatedAt = new Date().toISOString()

  res.json(result)
})

app.post('/api/estimate/:id/rerun', (req, res) => {
  const record = records.find((r) => r.id === req.params.id)
  if (!record) {
    return res.status(404).json({ error: '记录不存在' })
  }

  const result = performEstimation(record)
  record.estimatedValue = result.expansionValue
  record.status = 'rerun'
  record.updatedAt = new Date().toISOString()
  record.operationHistory.push({
    id: generateId(),
    type: 'rerun',
    operator: '何工',
    description: `重跑估算完成：伸缩量 ${result.expansionValue.toFixed(2)}mm`,
    timestamp: new Date().toISOString()
  })

  res.json(result)
})

app.post('/api/records/:id/correct', (req, res) => {
  const { newDirection, reason } = req.body
  const record = records.find((r) => r.id === req.params.id)
  if (!record) {
    return res.status(404).json({ error: '记录不存在' })
  }

  const oldDirection = record.directionMark

  record.directionMark = newDirection
  record.status = 'manual_corrected'
  record.normalizedDirection = newDirection === '负方向' ? 'negative' : 'positive'
  record.updatedAt = new Date().toISOString()
  record.operationHistory.push({
    id: generateId(),
    type: 'correct',
    operator: '何工',
    description: `人工修正方向：${oldDirection} → ${newDirection}`,
    timestamp: new Date().toISOString(),
    oldValue: oldDirection,
    newValue: newDirection,
    reason: reason || '现场师傅口径不规范，何工根据实际情况修正'
  })

  const result = performEstimation(record)
  record.estimatedValue = result.expansionValue
  record.operationHistory.push({
    id: generateId(),
    type: 'rerun',
    operator: '何工',
    description: `重跑估算完成：伸缩量 ${result.expansionValue.toFixed(2)}mm`,
    timestamp: new Date().toISOString()
  })

  const directionException = exceptions.find(
    (e) => e.recordId === record.id && e.exceptionType === 'direction_mismatch'
  )
  if (directionException) {
    directionException.status = 'resolved'
    directionException.description = `何工人工修正：${oldDirection} → ${newDirection}${reason ? `，原因：${reason}` : ''}`
    directionException.operator = '何工'
    directionException.updatedAt = new Date().toISOString()
  }

  res.json(record)
})

app.post('/api/records/:id/review', (req, res) => {
  const { result } = req.body
  const record = records.find((r) => r.id === req.params.id)
  if (!record) {
    return res.status(404).json({ error: '记录不存在' })
  }

  record.status = result === 'negative' ? 'reviewed_negative' : 'reviewed_normal'
  record.normalizedDirection = result === 'negative' ? 'negative' : 'positive'
  record.updatedAt = new Date().toISOString()
  record.operationHistory.push({
    id: generateId(),
    type: 'review',
    operator: '实验老师',
    description: `复核完成：${result === 'negative' ? '确认为负方向' : '判定为录入错误，归为正常'}`,
    timestamp: new Date().toISOString()
  })

  const directionException = exceptions.find(
    (e) => e.recordId === record.id && e.exceptionType === 'direction_mismatch'
  )
  if (directionException) {
    directionException.status = 'resolved'
    directionException.description = `实验老师复核完成：${result === 'negative' ? '确认为负方向' : '判定为录入错误'}`
    directionException.operator = '实验老师'
    directionException.updatedAt = new Date().toISOString()
  }

  res.json(record)
})

app.post('/api/reset', (req, res) => {
  records = [...mockRecords]
  exceptions = [...mockExceptions]
  sensors = [...mockSensors]
  res.json({ message: '演示数据已重置' })
})

app.listen(PORT, () => {
  console.log(`API 服务器运行在 http://localhost:${PORT}`)
})
