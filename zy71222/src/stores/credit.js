import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import dayjs from 'dayjs'

export const useCreditStore = defineStore('credit', () => {
  const creditRecords = ref([])
  const creditHistory = ref([])

  const totalCreditLimit = ref(50000000)
  const usedCredit = ref(0)
  const availableCredit = computed(() => totalCreditLimit.value - usedCredit.value)

  const creditUtilizationRate = computed(() => {
    if (totalCreditLimit.value === 0) return 0
    return ((usedCredit.value / totalCreditLimit.value) * 100).toFixed(2)
  })

  function calculateUsedCredit() {
    const redemptionStore = useRedemptionStore()
    const invoiceStore = useInvoiceStore()
    
    const totalInvoiced = invoiceStore.invoicedAmount
    const redeemedAmount = redemptionStore.redemptions
      .filter(r => r.status === 'completed')
      .reduce((sum, r) => sum + r.amount, 0)
    
    usedCredit.value = totalInvoiced - redeemedAmount
  }

  function releaseCredit(redemptionId, amount, operator) {
    const record = {
      id: `CR${Date.now()}`,
      redemptionId,
      amount,
      type: 'release',
      operator,
      operateTime: new Date().toISOString(),
      remark: '红冲额度回补'
    }
    creditRecords.value.push(record)
    creditHistory.value.push(record)
    
    usedCredit.value = Math.max(0, usedCredit.value - amount)
    
    return record
  }

  function occupyCredit(invoiceId, amount, operator) {
    const record = {
      id: `CR${Date.now()}`,
      invoiceId,
      amount,
      type: 'occupy',
      operator,
      operateTime: new Date().toISOString(),
      remark: '开票额度占用'
    }
    creditRecords.value.push(record)
    creditHistory.value.push(record)
    
    usedCredit.value += amount
    
    return record
  }

  function getCreditHistoryByRedemptionId(redemptionId) {
    return creditHistory.value.filter(h => h.redemptionId === redemptionId)
  }

  function initCreditRecords(data) {
    creditRecords.value = data
  }

  function initCreditHistory(data) {
    creditHistory.value = data
  }

  function setUsedCredit(amount) {
    usedCredit.value = amount
  }

  return {
    creditRecords,
    creditHistory,
    totalCreditLimit,
    usedCredit,
    availableCredit,
    creditUtilizationRate,
    calculateUsedCredit,
    releaseCredit,
    occupyCredit,
    getCreditHistoryByRedemptionId,
    initCreditRecords,
    initCreditHistory,
    setUsedCredit
  }
})

import { useRedemptionStore } from './redemption'
import { useInvoiceStore } from './invoice'
