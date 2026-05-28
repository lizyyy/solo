import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import { useCreditStore } from './credit'

export const REDEMPTION_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  BUYER_CONFIRMED: 'buyer_confirmed',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  REJECTED: 'rejected'
}

export const REDEMPTION_STATUS_LABEL = {
  [REDEMPTION_STATUS.DRAFT]: '草稿',
  [REDEMPTION_STATUS.SUBMITTED]: '已提交',
  [REDEMPTION_STATUS.BUYER_CONFIRMED]: '买方已确认',
  [REDEMPTION_STATUS.PROCESSING]: '处理中',
  [REDEMPTION_STATUS.COMPLETED]: '已完成',
  [REDEMPTION_STATUS.REJECTED]: '已拒绝'
}

export const ANOMALY_TYPES = {
  DUPLICATE: 'duplicate',
  EARLY_RELEASE: 'early_release',
  UNCONFIRMED: 'unconfirmed'
}

export const ANOMALY_LABELS = {
  [ANOMALY_TYPES.DUPLICATE]: '重复红冲',
  [ANOMALY_TYPES.EARLY_RELEASE]: '额度提前释放',
  [ANOMALY_TYPES.UNCONFIRMED]: '买方未确认'
}

export const useRedemptionStore = defineStore('redemption', () => {
  const redemptions = ref([])
  const statusHistory = ref([])

  const totalRedemptions = computed(() => redemptions.value.length)
  const completedRedemptions = computed(() => redemptions.value.filter(r => r.status === REDEMPTION_STATUS.COMPLETED).length)
  const pendingRedemptions = computed(() => redemptions.value.filter(r => 
    [REDEMPTION_STATUS.DRAFT, REDEMPTION_STATUS.SUBMITTED, REDEMPTION_STATUS.PROCESSING].includes(r.status)
  ).length)

  const anomalies = computed(() => {
    return redemptions.value.filter(r => r.anomalies && r.anomalies.length > 0)
  })

  const duplicateAnomalies = computed(() => {
    return redemptions.value.filter(r => 
      r.anomalies?.some(a => a.type === ANOMALY_TYPES.DUPLICATE)
    )
  })

  const earlyReleaseAnomalies = computed(() => {
    return redemptions.value.filter(r => 
      r.anomalies?.some(a => a.type === ANOMALY_TYPES.EARLY_RELEASE)
    )
  })

  const unconfirmedAnomalies = computed(() => {
    return redemptions.value.filter(r => 
      r.anomalies?.some(a => a.type === ANOMALY_TYPES.UNCONFIRMED)
    )
  })

  function checkDuplicate(redemption) {
    const duplicates = redemptions.value.filter(r => 
      r.id !== redemption.id &&
      r.invoiceId === redemption.invoiceId &&
      r.status !== REDEMPTION_STATUS.REJECTED &&
      r.amount === redemption.amount
    )
    return duplicates.length > 0
  }

  function checkBuyerConfirmation(redemption) {
    return redemption.buyerConfirmed === true
  }

  function checkEarlyRelease(redemption) {
    if (!redemption.creditReleaseTime || !redemption.buyerConfirmTime) {
      return false
    }
    return dayjs(redemption.creditReleaseTime).isBefore(dayjs(redemption.buyerConfirmTime))
  }

  function detectAnomalies(redemption) {
    const anomalies = []
    
    if (checkDuplicate(redemption)) {
      anomalies.push({
        type: ANOMALY_TYPES.DUPLICATE,
        reason: '该发票存在相同金额的红冲申请，可能存在重复红冲风险',
        evidence: `发票号 ${redemption.invoiceNo} 已有 ${redemptions.value.filter(r => 
          r.id !== redemption.id && 
          r.invoiceId === redemption.invoiceId && 
          r.amount === redemption.amount
        ).length} 笔相同金额的红冲记录`
      })
    }

    if (!checkBuyerConfirmation(redemption) && redemption.status !== REDEMPTION_STATUS.DRAFT) {
      anomalies.push({
        type: ANOMALY_TYPES.UNCONFIRMED,
        reason: '买方尚未确认此红冲申请，不应释放额度',
        evidence: `红冲申请于 ${dayjs(redemption.submitTime).format('YYYY-MM-DD HH:mm')} 提交，截至目前买方未确认`
      })
    }

    if (checkEarlyRelease(redemption)) {
      anomalies.push({
        type: ANOMALY_TYPES.EARLY_RELEASE,
        reason: '额度释放时间早于买方确认时间，存在提前释放风险',
        evidence: `额度释放时间 ${dayjs(redemption.creditReleaseTime).format('YYYY-MM-DD HH:mm')} 早于买方确认时间 ${dayjs(redemption.buyerConfirmTime).format('YYYY-MM-DD HH:mm')}`
      })
    }

    return anomalies
  }

  function transitionStatus(redemptionId, newStatus, operator, remark = '') {
    const redemption = redemptions.value.find(r => r.id === redemptionId)
    if (!redemption) return { success: false, message: '红冲申请不存在' }

    const validTransitions = {
      [REDEMPTION_STATUS.DRAFT]: [REDEMPTION_STATUS.SUBMITTED, REDEMPTION_STATUS.REJECTED],
      [REDEMPTION_STATUS.SUBMITTED]: [REDEMPTION_STATUS.BUYER_CONFIRMED, REDEMPTION_STATUS.REJECTED],
      [REDEMPTION_STATUS.BUYER_CONFIRMED]: [REDEMPTION_STATUS.PROCESSING, REDEMPTION_STATUS.REJECTED],
      [REDEMPTION_STATUS.PROCESSING]: [REDEMPTION_STATUS.COMPLETED, REDEMPTION_STATUS.REJECTED],
      [REDEMPTION_STATUS.COMPLETED]: [],
      [REDEMPTION_STATUS.REJECTED]: []
    }

    if (!validTransitions[redemption.status].includes(newStatus)) {
      return { 
        success: false, 
        message: `无法从 ${REDEMPTION_STATUS_LABEL[redemption.status]} 转换为 ${REDEMPTION_STATUS_LABEL[newStatus]}` 
      }
    }

    const historyRecord = {
      id: `HIS${Date.now()}`,
      redemptionId,
      fromStatus: redemption.status,
      toStatus: newStatus,
      operator,
      operateTime: new Date().toISOString(),
      remark
    }
    statusHistory.value.push(historyRecord)

    redemption.status = newStatus
    redemption.statusHistory = redemption.statusHistory || []
    redemption.statusHistory.push(historyRecord)

    redemption.anomalies = detectAnomalies(redemption)

    return { success: true, message: '状态更新成功' }
  }

  function submitRedemption(redemptionId, operator) {
    return transitionStatus(redemptionId, REDEMPTION_STATUS.SUBMITTED, operator, '提交红冲申请')
  }

  function confirmByBuyer(redemptionId, operator, confirmTime = null) {
    const redemption = redemptions.value.find(r => r.id === redemptionId)
    if (redemption) {
      redemption.buyerConfirmed = true
      redemption.buyerConfirmTime = confirmTime || new Date().toISOString()
    }
    return transitionStatus(redemptionId, REDEMPTION_STATUS.BUYER_CONFIRMED, operator, '买方确认红冲')
  }

  function startProcessing(redemptionId, operator) {
    return transitionStatus(redemptionId, REDEMPTION_STATUS.PROCESSING, operator, '开始处理红冲')
  }

  function completeRedemption(redemptionId, operator, creditReleaseTime = null) {
    const redemption = redemptions.value.find(r => r.id === redemptionId)
    if (!redemption) return { success: false, message: '红冲申请不存在' }

    const result = transitionStatus(redemptionId, REDEMPTION_STATUS.COMPLETED, operator, '红冲完成，额度已回补')
    if (!result.success) return result

    if (creditReleaseTime) {
      redemption.creditReleaseTime = creditReleaseTime
    } else {
      redemption.creditReleaseTime = new Date().toISOString()
    }
    redemption.completedTime = new Date().toISOString()

    const creditStore = useCreditStore()
    creditStore.releaseCredit(redemptionId, redemption.amount, operator)

    return result
  }

  function rejectRedemption(redemptionId, operator, reason) {
    return transitionStatus(redemptionId, REDEMPTION_STATUS.REJECTED, operator, `拒绝原因: ${reason}`)
  }

  function addRedemption(redemption) {
    redemption.anomalies = detectAnomalies(redemption)
    redemptions.value.push(redemption)
    return redemption
  }

  function getRedemptionById(id) {
    return redemptions.value.find(r => r.id === id)
  }

  function getHistoryByRedemptionId(redemptionId) {
    return statusHistory.value.filter(h => h.redemptionId === redemptionId)
  }

  function initRedemptions(data) {
    redemptions.value = data.map(r => ({
      ...r,
      anomalies: detectAnomalies(r)
    }))
  }

  function initHistory(data) {
    statusHistory.value = data
  }

  return {
    redemptions,
    statusHistory,
    totalRedemptions,
    completedRedemptions,
    pendingRedemptions,
    anomalies,
    duplicateAnomalies,
    earlyReleaseAnomalies,
    unconfirmedAnomalies,
    checkDuplicate,
    checkBuyerConfirmation,
    checkEarlyRelease,
    detectAnomalies,
    transitionStatus,
    submitRedemption,
    confirmByBuyer,
    startProcessing,
    completeRedemption,
    rejectRedemption,
    addRedemption,
    getRedemptionById,
    getHistoryByRedemptionId,
    initRedemptions,
    initHistory
  }
})
