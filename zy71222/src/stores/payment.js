import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const usePaymentStore = defineStore('payment', () => {
  const payments = ref([])

  const totalPayments = computed(() => payments.value.length)
  const totalPaymentAmount = computed(() => payments.value.reduce((sum, p) => sum + p.amount, 0))

  function getPaymentsByRedemptionId(redemptionId) {
    return payments.value.filter(p => p.redemptionId === redemptionId)
  }

  function getPaymentsByInvoiceId(invoiceId) {
    return payments.value.filter(p => p.invoiceId === invoiceId)
  }

  function addPayment(payment) {
    payments.value.push(payment)
    return payment
  }

  function initPayments(data) {
    payments.value = data
  }

  return {
    payments,
    totalPayments,
    totalPaymentAmount,
    getPaymentsByRedemptionId,
    getPaymentsByInvoiceId,
    addPayment,
    initPayments
  }
})
