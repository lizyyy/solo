import { create } from 'zustand'
import type { TemperatureRecord, ExceptionRecord, Sensor, Toast, OperationLog, OldCalibration, RecordStatus } from '@/types'
import { mockRecords, mockExceptions, mockSensors, mockOldCalibrations } from '@/data/mockData'
import { validateDirection } from '@/utils/calibration'
import { performEstimation } from '@/utils/estimation'
import { generateId } from '@/utils/formatters'

interface AppState {
  records: TemperatureRecord[]
  exceptions: ExceptionRecord[]
  sensors: Sensor[]
  currentStep: number
  selectedRecordId: string | null
  toasts: Toast[]
  showImportModal: boolean
  showDetailModal: boolean
  showSensorPanel: boolean
  currentOperator: string
}

interface AppActions {
  setCurrentStep: (step: number) => void
  selectRecord: (id: string | null) => void
  setShowImportModal: (show: boolean) => void
  setShowDetailModal: (show: boolean) => void
  setShowSensorPanel: (show: boolean) => void
  addToast: (type: Toast['type'], message: string) => void
  removeToast: (id: string) => void
  importRecords: (newRecords: Partial<TemperatureRecord>[]) => void
  supplementSensor: (recordId: string, sensorNo: string) => void
  manualCorrectDirection: (recordId: string, newDirection: '正方向' | '负方向', reason?: string) => void
  rerunEstimation: (recordId: string) => void
  reviewRecord: (recordId: string, result: 'negative' | 'normal') => void
  resetDemoData: () => void
  addOperationLog: (recordId: string, log: Omit<OperationLog, 'id' | 'timestamp'>) => void
  addException: (exception: Omit<ExceptionRecord, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateException: (exceptionId: string, updates: Partial<ExceptionRecord>) => void
}

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  records: mockRecords,
  exceptions: mockExceptions,
  sensors: mockSensors,
  currentStep: 2,
  selectedRecordId: null,
  toasts: [],
  showImportModal: false,
  showDetailModal: false,
  showSensorPanel: false,
  currentOperator: '何工',

  setCurrentStep: (step) => set({ currentStep: step }),
  selectRecord: (id) => set({ selectedRecordId: id }),
  setShowImportModal: (show) => set({ showImportModal: show }),
  setShowDetailModal: (show) => set({ showDetailModal: show }),
  setShowSensorPanel: (show) => set({ showSensorPanel: show }),

  addToast: (type, message) => {
    const toast: Toast = {
      id: generateId(),
      type,
      message,
      timestamp: new Date().toISOString()
    }
    set((state) => ({ toasts: [...state.toasts, toast] }))
    setTimeout(() => {
      get().removeToast(toast.id)
    }, 4000)
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }))
  },

  addOperationLog: (recordId, log) => {
    set((state) => ({
      records: state.records.map((r) =>
        r.id === recordId
          ? {
              ...r,
              operationHistory: [
                ...r.operationHistory,
                {
                  ...log,
                  id: generateId(),
                  timestamp: new Date().toISOString()
                }
              ],
              updatedAt: new Date().toISOString()
            }
          : r
      )
    }))
  },

  addException: (exception) => {
    set((state) => ({
      exceptions: [
        ...state.exceptions,
        {
          ...exception,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    }))
  },

  updateException: (exceptionId, updates) => {
    set((state) => ({
      exceptions: state.exceptions.map((e) =>
        e.id === exceptionId
          ? { ...e, ...updates, updatedAt: new Date().toISOString() }
          : e
      )
    }))
  },

  importRecords: (newRecords) => {
    const { addOperationLog, addException, addToast, currentOperator } = get()
    const importedRecords: TemperatureRecord[] = newRecords.map((record, index) => {
      const recordId = generateId()
      const recordNo = `REC-00${get().records.length + index + 1}`
      
      const validation = validateDirection(record.directionMark || '')
      
      let status: RecordStatus = 'imported'
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
        operationHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      if (validation.needsReview) {
        addException({
          recordId,
          recordNo,
          exceptionType: 'direction_mismatch',
          status: 'pending_review',
          sensorId: record.sensorId,
          description: validation.warning || '方向口径不统一，需实验老师复核',
          operator: '系统'
        })
      }

      if (!record.sensorId) {
        addException({
          recordId,
          recordNo,
          exceptionType: 'missing_sensor',
          status: 'pending',
          description: '缺失传感器编号，待何工补录',
          operator: '系统'
        })
      }

      return newRecord
    })

    set((state) => ({
      records: [...state.records, ...importedRecords]
    }))

    importedRecords.forEach((r) => {
      addOperationLog(r.id, {
        type: 'import',
        operator: currentOperator,
        description: `导入温度校准记录${r.estimatedValue ? `，估算伸缩量 ${r.estimatedValue.toFixed(2)}mm` : ''}`
      })
    })

    addToast('success', `成功导入 ${importedRecords.length} 条记录`)
    set({ currentStep: 1, showImportModal: false })
  },

  supplementSensor: (recordId, sensorNo) => {
    const { addOperationLog, addToast, currentOperator, sensors } = get()
    const sensor = sensors.find((s) => s.sensorNo === sensorNo)
    
    if (!sensor) {
      addToast('error', `未找到传感器 ${sensorNo}`)
      return
    }

    let oldCalibrationData: OldCalibration[] | undefined
    if (sensor.oldCalibrationData && sensor.oldCalibrationData.length > 0) {
      oldCalibrationData = sensor.oldCalibrationData
    }

    set((state) => ({
      records: state.records.map((r) =>
        r.id === recordId
          ? {
              ...r,
              sensorId: sensorNo,
              status: 'supplemented',
              oldCalibrationData,
              updatedAt: new Date().toISOString()
            }
          : r
      )
    }))

    addOperationLog(recordId, {
      type: 'supplement',
      operator: currentOperator,
      description: `补录传感器编号：${sensorNo}${oldCalibrationData ? '，已关联旧口径数据' : ''}`,
      oldValue: null,
      newValue: sensorNo
    })

    const { exceptions } = get()
    const missingException = exceptions.find(
      (e) => e.recordId === recordId && e.exceptionType === 'missing_sensor'
    )
    if (missingException) {
      get().updateException(missingException.id, {
        exceptionType: 'supplemented',
        status: 'supplemented',
        sensorId: sensorNo,
        description: `缺失传感器编号后补录${oldCalibrationData ? '，已关联旧口径数据' : ''}`,
        operator: currentOperator
      })
    }

    addToast('success', `已补录传感器 ${sensorNo}${oldCalibrationData ? '（含旧口径数据）' : ''}`)
    set({ currentStep: 2, showSensorPanel: false })
  },

  manualCorrectDirection: (recordId, newDirection, reason = '') => {
    const { addOperationLog, addToast, currentOperator, exceptions } = get()
    const record = get().records.find((r) => r.id === recordId)
    if (!record) return

    set((state) => ({
      records: state.records.map((r) =>
        r.id === recordId
          ? {
              ...r,
              directionMark: newDirection,
              status: 'manual_corrected',
              normalizedDirection: newDirection === '负方向' ? 'negative' : 'positive',
              updatedAt: new Date().toISOString()
            }
          : r
      )
    }))

    addOperationLog(recordId, {
      type: 'correct',
      operator: currentOperator,
      description: `人工修正方向：${record.directionMark} → ${newDirection}`,
      oldValue: record.directionMark,
      newValue: newDirection,
      reason: reason || '现场师傅口径不规范，何工根据实际情况修正'
    })

    const directionException = exceptions.find(
      (e) => e.recordId === recordId && e.exceptionType === 'direction_mismatch'
    )
    if (directionException) {
      get().updateException(directionException.id, {
        status: 'resolved',
        description: `何工人工修正：${record.directionMark} → ${newDirection}${reason ? `，原因：${reason}` : ''}`,
        operator: currentOperator
      })
    }

    addToast('success', `已修正方向：${newDirection}`)
  },

  rerunEstimation: (recordId) => {
    const { addOperationLog, addToast, currentOperator, records } = get()
    const record = records.find((r) => r.id === recordId)
    if (!record) return

    const result = performEstimation(record)

    set((state) => ({
      records: state.records.map((r) =>
        r.id === recordId
          ? {
              ...r,
              estimatedValue: result.expansionValue,
              status: 'rerun',
              updatedAt: new Date().toISOString()
            }
          : r
      )
    }))

    addOperationLog(recordId, {
      type: 'rerun',
      operator: currentOperator,
      description: `重跑估算完成：伸缩量 ${result.expansionValue.toFixed(2)}mm`
    })

    addToast('success', `重跑完成：${result.expansionValue.toFixed(2)}mm`)
    set({ currentStep: 3 })
  },

  reviewRecord: (recordId, result) => {
    const { addOperationLog, addToast, exceptions } = get()
    
    set((state) => ({
      records: state.records.map((r) =>
        r.id === recordId
          ? {
              ...r,
              status: result === 'negative' ? 'reviewed_negative' : 'reviewed_normal',
              normalizedDirection: result === 'negative' ? 'negative' : 'positive',
              updatedAt: new Date().toISOString()
            }
          : r
      )
    }))

    addOperationLog(recordId, {
      type: 'review',
      operator: '实验老师',
      description: `复核完成：${result === 'negative' ? '确认为负方向' : '判定为录入错误，归为正常'}`
    })

    const directionException = exceptions.find(
      (e) => e.recordId === recordId && e.exceptionType === 'direction_mismatch'
    )
    if (directionException) {
      get().updateException(directionException.id, {
        status: 'resolved',
        description: `实验老师复核完成：${result === 'negative' ? '确认为负方向' : '判定为录入错误'}`,
        operator: '实验老师'
      })
    }

    addToast('success', `复核完成：${result === 'negative' ? '确认为负方向' : '判定为正常'}`)
  },

  resetDemoData: () => {
    set({
      records: mockRecords,
      exceptions: mockExceptions,
      sensors: mockSensors,
      currentStep: 2,
      selectedRecordId: null,
      toasts: []
    })
    get().addToast('info', '演示数据已重置')
  }
}))

export const getSelectedRecord = () => {
  const { selectedRecordId, records } = useAppStore.getState()
  return records.find((r) => r.id === selectedRecordId)
}
