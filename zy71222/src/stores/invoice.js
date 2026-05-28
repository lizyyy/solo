import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import dayjs from 'dayjs'

export const useInvoiceStore = defineStore('invoice', () => {
  const invoices = ref([])

  const totalInvoices = computed(() => invoices.value.length)
  const invoicedAmount = computed(() => invoices.value.reduce((sum, inv) => sum + inv.amount, 0))
  const usedCredit = computed(() => invoices.value
    .filter(inv => inv.status !== 'cancelled')
    .reduce((sum, inv) => sum + inv.amount, 0))

  function getInvoiceById(id) {
    return invoices.value.find(inv => inv.id === id)
  }

  function getInvoiceByNumber(invoiceNo) {
    return invoices.value.find(inv => inv.invoiceNo === invoiceNo)
  }

  function initInvoices(data) {
    invoices.value = data
  }

  return {
    invoices,
    totalInvoices,
    invoicedAmount,
    usedCredit,
    getInvoiceById,
    getInvoiceByNumber,
    initInvoices
  }
})
