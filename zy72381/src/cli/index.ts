#!/usr/bin/env node

import { Command } from 'commander'
import type { TemperatureRecord, ExceptionRecord, Sensor } from '@/types'
import { mockRecords, mockExceptions, mockSensors } from '@/data/mockData'
import { validateDirection } from '@/utils/calibration'
import { performEstimation } from '@/utils/estimation'
import { generateId, generateRecordNo } from '@/utils/formatters'

const program = new Command()

let records: TemperatureRecord[] = [...mockRecords]
let exceptions: ExceptionRecord[] = [...mockExceptions]
let sensors: Sensor[] = [...mockSensors]

program
  .name('bridge-expansion')
  .description('桥面热胀伸缩估算 CLI')
  .version('1.0.0')

program
  .command('list')
  .description('查看温度校准记录列表')
  .option('-s, --status <status>', '按状态筛选')
  .action((options) => {
    let result = records
    if (options.status) {
      result = records.filter((r) => r.status === options.status)
    }
    console.log('\n温度校准记录列表:')
    console.log('='.repeat(80))
    result.forEach((r) => {
      console.log(
        `[${r.recordNo}] ${r.startTemp}℃→${r.endTemp}℃ | 方向: ${r.directionMark} | 状态: ${r.status} | 伸缩量: ${r.estimatedValue?.toFixed(2) || '未估算'}mm`
      )
    })
    console.log('='.repeat(80))
  })

program
  .command('import')
  .description('导入温度校准记录')
  .option('-f, --file <path>', 'JSON文件路径')
  .option('-d, --demo', '导入演示数据')
  .action((options) => {
    if (options.demo) {
      const demoRecords = [
        {
          startTemp: 22.0,
          endTemp: 36.5,
          directionMark: '负方向',
          sensorId: 'SNS-BR-001'
        },
        {
          startTemp: 20.5,
          endTemp: 35.2,
          directionMark: '向左',
          sensorId: 'SNS-BR-002'
        },
        {
          startTemp: 24.0,
          endTemp: 38.8,
          directionMark: '负方向'
        }
      ]

      const imported: TemperatureRecord[] = demoRecords.map((record, index) => {
        const recordId = generateId()
        const recordNo = generateRecordNo(records.length + index + 1)
        const validation = validateDirection(record.directionMark)

        return {
          id: recordId,
          recordNo,
          type: (validation.needsReview ? 'left' : 'normal') as 'left' | 'normal',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          startTemp: record.startTemp,
          endTemp: record.endTemp,
          tempDiff: record.endTemp - record.startTemp,
          directionMark: record.directionMark,
          sensorId: record.sensorId,
          status: validation.needsReview ? 'pending_review' : 'success',
          normalizedDirection: validation.normalizedDirection,
          operationHistory: [
            {
              id: generateId(),
              type: 'import' as const,
              operator: '何工',
              description: '通过CLI导入',
              timestamp: new Date().toISOString()
            }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      })

      records = [...records, ...imported]
      console.log(`成功导入 ${imported.length} 条演示记录`)
      return
    }

    console.log('请使用 --demo 选项导入演示数据')
  })

program
  .command('supplement')
  .description('补录传感器编号')
  .requiredOption('-r, --record <recordNo>', '记录编号')
  .requiredOption('-s, --sensor <sensorNo>', '传感器编号')
  .action((options) => {
    const record = records.find((r) => r.recordNo === options.record)
    if (!record) {
      console.error('记录不存在')
      return
    }

    const sensor = sensors.find((s) => s.sensorNo === options.sensor)
    if (!sensor) {
      console.error('传感器不存在')
      return
    }

    record.sensorId = options.sensor
    record.status = 'supplemented'
    record.oldCalibrationData = sensor.oldCalibrationData
    record.operationHistory.push({
      id: generateId(),
      type: 'supplement',
      operator: '何工',
      description: `补录传感器编号：${options.sensor}`,
      timestamp: new Date().toISOString(),
      oldValue: null,
      newValue: options.sensor
    })

    console.log(`已补录传感器 ${options.sensor} 到记录 ${options.record}`)
    if (sensor.oldCalibrationData) {
      console.log('已关联旧口径数据')
    }
  })

program
  .command('estimate')
  .description('执行估算')
  .requiredOption('-r, --record <recordNo>', '记录编号')
  .action((options) => {
    const record = records.find((r) => r.recordNo === options.record)
    if (!record) {
      console.error('记录不存在')
      return
    }

    const result = performEstimation(record)
    record.estimatedValue = result.expansionValue

    console.log(`\n估算结果:`)
    console.log('='.repeat(40))
    console.log(`记录编号: ${record.recordNo}`)
    console.log(`伸缩量: ${result.expansionValue.toFixed(2)}mm`)
    console.log(`方向: ${result.direction === 'positive' ? '正方向' : '负方向'}`)
    console.log(`置信度: ${(result.confidence * 100).toFixed(0)}%`)
    console.log(`公式: ${result.calculationFormula}`)
    console.log('='.repeat(40))
  })

program
  .command('rerun')
  .description('重跑估算')
  .requiredOption('-r, --record <recordNo>', '记录编号')
  .action((options) => {
    const record = records.find((r) => r.recordNo === options.record)
    if (!record) {
      console.error('记录不存在')
      return
    }

    const result = performEstimation(record)
    record.estimatedValue = result.expansionValue
    record.status = 'rerun'
    record.operationHistory.push({
      id: generateId(),
      type: 'rerun',
      operator: '何工',
      description: `重跑估算：${result.expansionValue.toFixed(2)}mm`,
      timestamp: new Date().toISOString()
    })

    console.log(`重跑完成：${result.expansionValue.toFixed(2)}mm`)
  })

program
  .command('exceptions')
  .description('查看异常工况表')
  .action(() => {
    console.log('\n异常工况表:')
    console.log('='.repeat(100))
    exceptions.forEach((e) => {
      console.log(
        `[${e.recordNo}] ${e.exceptionType} | ${e.status} | ${e.sensorId || 'N/A'} | ${e.description}`
      )
    })
    console.log('='.repeat(100))
  })

program
  .command('reset-demo')
  .description('重置演示数据')
  .action(() => {
    records = [...mockRecords]
    exceptions = [...mockExceptions]
    sensors = [...mockSensors]
    console.log('演示数据已重置')
  })

program.parse(process.argv)
