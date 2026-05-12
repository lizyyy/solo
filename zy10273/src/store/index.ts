import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  Appointment,
  AppointmentStatus,
  PriceChange,
  PriceChangeStatus,
  InspectionItem,
  InspectionLog,
  Settlement,
  AbnormalRecord,
  Statistics
} from '../types'
import { generateId, generateAppointmentNo, getDefaultInspectionItems } from '../utils'

interface AppState {
  appointments: Appointment[]
  abnormalRecords: AbnormalRecord[]
  currentUser: string
  
  addAppointment: (appointment: Omit<Appointment, 'id' | 'appointmentNo' | 'status' | 'photos' | 'inspectionItems' | 'priceChanges' | 'inspectionLogs' | 'createdAt' | 'updatedAt'>) => { success: boolean; error?: string; appointment?: Appointment }
  updateAppointment: (id: string, updates: Partial<Appointment>) => void
  startInspection: (appointmentId: string) => void
  completeInspection: (appointmentId: string, items: InspectionItem[], actualPrice: number) => void
  requestPriceChange: (appointmentId: string, newPrice: number, reason: string) => void
  approvePriceChange: (changeId: string, approved: boolean, notes?: string) => void
  rejectAppointment: (appointmentId: string, reason: string) => void
  settleAppointment: (appointmentId: string, paymentMethod: string, notes: string) => { success: boolean; error?: string }
  addInspectionLog: (appointmentId: string, action: string, description: string) => void
  getAppointmentById: (id: string) => Appointment | undefined
  getStatistics: () => Statistics
  detectAbnormalities: () => void
  resolveAbnormality: (id: string) => void
  exportSettlementReport: () => any[]
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      appointments: [],
      abnormalRecords: [],
      currentUser: '业务专员',

      addAppointment: (appointmentData) => {
        const state = get()
        
        const duplicate = state.appointments.find(
          a => a.customerPhone === appointmentData.customerPhone &&
               a.applianceBrand === appointmentData.applianceBrand &&
               a.applianceModel === appointmentData.applianceModel &&
               a.status !== AppointmentStatus.REJECTED &&
               a.status !== AppointmentStatus.SETTLED
        )

        if (duplicate) {
          return {
            success: false,
            error: `该客户的相同型号家电已有进行中的预约（单号：${duplicate.appointmentNo}）`
          }
        }

        const newAppointment: Appointment = {
          ...appointmentData,
          id: generateId(),
          appointmentNo: generateAppointmentNo(),
          status: AppointmentStatus.PENDING,
          photos: [],
          inspectionItems: getDefaultInspectionItems(appointmentData.applianceType),
          priceChanges: [],
          inspectionLogs: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }

        set(state => ({
          appointments: [...state.appointments, newAppointment]
        }))

        get().addInspectionLog(newAppointment.id, '创建预约', '预约创建成功')
        get().detectAbnormalities()

        return { success: true, appointment: newAppointment }
      },

      updateAppointment: (id, updates) => {
        set(state => ({
          appointments: state.appointments.map(a =>
            a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
          )
        }))
      },

      startInspection: (appointmentId) => {
        const state = get()
        const appointment = state.getAppointmentById(appointmentId)
        if (!appointment) return

        set(state => ({
          appointments: state.appointments.map(a =>
            a.id === appointmentId
              ? { ...a, status: AppointmentStatus.IN_PROGRESS, arrivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
              : a
          )
        }))

        get().addInspectionLog(appointmentId, '开始检测', '师傅到达客户家，开始检测')
      },

      completeInspection: (appointmentId, items, actualPrice) => {
        const state = get()
        const appointment = state.getAppointmentById(appointmentId)
        if (!appointment) return

        const allChecked = items.every(item => item.checked && item.result !== null)
        if (!allChecked) {
          throw new Error('请完成所有检测项')
        }

        set(state => ({
          appointments: state.appointments.map(a =>
            a.id === appointmentId
              ? {
                  ...a,
                  status: AppointmentStatus.INSPECTED,
                  inspectionItems: items,
                  actualPrice,
                  completedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                }
              : a
          )
        }))

        get().addInspectionLog(appointmentId, '完成检测', `检测完成，初步估价：¥${actualPrice}`)
        get().detectAbnormalities()
      },

      requestPriceChange: (appointmentId, newPrice, reason) => {
        const state = get()
        const appointment = state.getAppointmentById(appointmentId)
        if (!appointment) return

        const priceChange: PriceChange = {
          id: generateId(),
          appointmentId,
          originalPrice: appointment.actualPrice || appointment.estimatedPrice,
          newPrice,
          reason,
          status: PriceChangeStatus.PENDING,
          requestedBy: state.currentUser,
          requestedAt: new Date().toISOString()
        }

        set(state => ({
          appointments: state.appointments.map(a =>
            a.id === appointmentId
              ? { ...a, priceChanges: [...a.priceChanges, priceChange], updatedAt: new Date().toISOString() }
              : a
          )
        }))

        get().addInspectionLog(appointmentId, '申请改价', `改价申请：¥${priceChange.originalPrice} → ¥${newPrice}，原因：${reason}`)
        get().detectAbnormalities()
      },

      approvePriceChange: (changeId, approved, notes) => {
        const state = get()
        
        const appointment = state.appointments.find(a =>
          a.priceChanges.some(pc => pc.id === changeId)
        )
        if (!appointment) return

        const priceChange = appointment.priceChanges.find(pc => pc.id === changeId)
        if (!priceChange) return

        const newStatus = approved ? PriceChangeStatus.APPROVED : PriceChangeStatus.REJECTED

        set(state => ({
          appointments: state.appointments.map(a =>
            a.id === appointment.id
              ? {
                  ...a,
                  actualPrice: approved ? priceChange.newPrice : a.actualPrice,
                  priceChanges: a.priceChanges.map(pc =>
                    pc.id === changeId
                      ? {
                          ...pc,
                          status: newStatus,
                          approvedBy: state.currentUser,
                          approvedAt: new Date().toISOString(),
                          approvalNotes: notes
                        }
                      : pc
                  ),
                  updatedAt: new Date().toISOString()
                }
              : a
          )
        }))

        const action = approved ? '改价通过' : '改价驳回'
        get().addInspectionLog(appointment.id, action, `改价${approved ? '通过' : '驳回'}：${notes || ''}`)
        get().detectAbnormalities()
      },

      rejectAppointment: (appointmentId, reason) => {
        const state = get()
        const appointment = state.getAppointmentById(appointmentId)
        if (!appointment) return

        set(state => ({
          appointments: state.appointments.map(a =>
            a.id === appointmentId
              ? {
                  ...a,
                  status: AppointmentStatus.REJECTED,
                  rejectReason: reason,
                  rejectedAt: new Date().toISOString(),
                  rejectedBy: state.currentUser,
                  updatedAt: new Date().toISOString()
                }
              : a
          )
        }))

        get().addInspectionLog(appointmentId, '拒收家电', `拒收原因：${reason}`)
        get().detectAbnormalities()
      },

      settleAppointment: (appointmentId, paymentMethod, notes) => {
        const state = get()
        const appointment = state.getAppointmentById(appointmentId)
        if (!appointment) return { success: false, error: '预约不存在' }

        if (appointment.status !== AppointmentStatus.INSPECTED) {
          if (appointment.status === AppointmentStatus.REJECTED) {
            return { success: false, error: '已拒收的预约不能结算' }
          }
          if (appointment.status === AppointmentStatus.PENDING || appointment.status === AppointmentStatus.IN_PROGRESS) {
            return { success: false, error: '检测未完成，不能结算' }
          }
        }

        const pendingPriceChange = appointment.priceChanges.find(
          pc => pc.status === PriceChangeStatus.PENDING
        )
        if (pendingPriceChange) {
          return { success: false, error: '存在待审批的改价申请，请先处理' }
        }

        const finalPrice = appointment.actualPrice || appointment.estimatedPrice

        const settlement: Settlement = {
          id: generateId(),
          appointmentId,
          finalPrice,
          settledAt: new Date().toISOString(),
          settledBy: state.currentUser,
          paymentMethod,
          notes
        }

        set(state => ({
          appointments: state.appointments.map(a =>
            a.id === appointmentId
              ? { ...a, status: AppointmentStatus.SETTLED, settlement, updatedAt: new Date().toISOString() }
              : a
          )
        }))

        get().addInspectionLog(appointmentId, '完成结算', `结算完成，金额：¥${finalPrice}，支付方式：${paymentMethod}`)
        get().detectAbnormalities()

        return { success: true }
      },

      addInspectionLog: (appointmentId, action, description) => {
        const state = get()
        const log: InspectionLog = {
          id: generateId(),
          appointmentId,
          action,
          description,
          operator: state.currentUser,
          timestamp: new Date().toISOString()
        }

        set(state => ({
          appointments: state.appointments.map(a =>
            a.id === appointmentId
              ? { ...a, inspectionLogs: [...a.inspectionLogs, log], updatedAt: new Date().toISOString() }
              : a
          )
        }))
      },

      getAppointmentById: (id) => {
        return get().appointments.find(a => a.id === id)
      },

      getStatistics: () => {
        const state = get()
        const appointments = state.appointments

        return {
          totalAppointments: appointments.length,
          pendingAppointments: appointments.filter(a => a.status === AppointmentStatus.PENDING).length,
          inProgressAppointments: appointments.filter(a => a.status === AppointmentStatus.IN_PROGRESS).length,
          inspectedAppointments: appointments.filter(a => a.status === AppointmentStatus.INSPECTED).length,
          rejectedAppointments: appointments.filter(a => a.status === AppointmentStatus.REJECTED).length,
          settledAppointments: appointments.filter(a => a.status === AppointmentStatus.SETTLED).length,
          totalRevenue: appointments
            .filter(a => a.settlement)
            .reduce((sum, a) => sum + (a.settlement?.finalPrice || 0), 0),
          pendingPriceChanges: appointments.reduce(
            (sum, a) => sum + a.priceChanges.filter(pc => pc.status === PriceChangeStatus.PENDING).length,
            0
          ),
          abnormalCount: state.abnormalRecords.filter(r => !r.resolved).length
        }
      },

      detectAbnormalities: () => {
        const state = get()
        const abnormalities: AbnormalRecord[] = []

        state.appointments.forEach(appointment => {
          if (appointment.status === AppointmentStatus.INSPECTED) {
            const inspectedDays = (new Date().getTime() - new Date(appointment.completedAt || '').getTime()) / (1000 * 60 * 60 * 24)
            if (inspectedDays > 3) {
              abnormalities.push({
                id: generateId(),
                type: 'unsettled_inspection',
                appointmentId: appointment.id,
                appointmentNo: appointment.appointmentNo,
                description: '检测完成超过3天未结算',
                detectedAt: new Date().toISOString(),
                resolved: false
              })
            }
          }

          if (appointment.priceChanges.some(pc => pc.status === PriceChangeStatus.PENDING)) {
            abnormalities.push({
              id: generateId(),
              type: 'unapproved_price_change',
              appointmentId: appointment.id,
              appointmentNo: appointment.appointmentNo,
              description: '存在待审批的改价申请',
              detectedAt: new Date().toISOString(),
              resolved: false
            })
          }

          if (appointment.status === AppointmentStatus.REJECTED && appointment.settlement) {
            abnormalities.push({
              id: generateId(),
              type: 'rejected_with_payment',
              appointmentId: appointment.id,
              appointmentNo: appointment.appointmentNo,
              description: '已拒收但存在结算记录',
              detectedAt: new Date().toISOString(),
              resolved: false
            })
          }
        })

        const phoneModelMap = new Map()
        state.appointments.forEach(appointment => {
          const key = `${appointment.customerPhone}-${appointment.applianceBrand}-${appointment.applianceModel}`
          phoneModelMap.set(key, (phoneModelMap.get(key) || 0) + 1)
        })

        phoneModelMap.forEach((count, key) => {
          if (count > 1) {
            const [phone, brand, model] = key.split('-')
            const duplicateAppointments = state.appointments.filter(
              a => a.customerPhone === phone && a.applianceBrand === brand && a.applianceModel === model
            )
            duplicateAppointments.forEach(appointment => {
              if (!appointment.settlement && appointment.status !== AppointmentStatus.REJECTED) {
                abnormalities.push({
                  id: generateId(),
                  type: 'duplicate_appointment',
                  appointmentId: appointment.id,
                  appointmentNo: appointment.appointmentNo,
                  description: `同一客户的${brand} ${model}存在重复预约`,
                  detectedAt: new Date().toISOString(),
                  resolved: false
                })
              }
            })
          }
        })

        set({ abnormalRecords: abnormalities })
      },

      resolveAbnormality: (id) => {
        set(state => ({
          abnormalRecords: state.abnormalRecords.map(r =>
            r.id === id ? { ...r, resolved: true } : r
          )
        }))
      },

      exportSettlementReport: () => {
        const state = get()
        return state.appointments
          .filter(a => a.status === AppointmentStatus.SETTLED)
          .map(a => ({
            预约单号: a.appointmentNo,
            客户姓名: a.customerName,
            客户电话: a.customerPhone,
            家电类型: a.applianceType,
            家电品牌: a.applianceBrand,
            家电型号: a.applianceModel,
            预估价格: a.estimatedPrice,
            实际价格: a.actualPrice,
            最终结算价: a.settlement?.finalPrice,
            结算时间: a.settlement?.settledAt,
            结算人: a.settlement?.settledBy,
            支付方式: a.settlement?.paymentMethod,
            改价次数: a.priceChanges.length,
            备注: a.settlement?.notes
          }))
      }
    }),
    {
      name: 'appliance-inspection-storage'
    }
  )
)
