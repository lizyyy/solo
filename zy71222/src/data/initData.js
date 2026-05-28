import { useInvoiceStore } from '@/stores/invoice'
import { useRedemptionStore } from '@/stores/redemption'
import { useCreditStore } from '@/stores/credit'
import { usePaymentStore } from '@/stores/payment'
import { mockInvoices, mockRedemptions, mockCreditHistory, mockPayments, mockStatusHistory } from './mockData'

export function initMockData() {
  const invoiceStore = useInvoiceStore()
  const redemptionStore = useRedemptionStore()
  const creditStore = useCreditStore()
  const paymentStore = usePaymentStore()

  invoiceStore.initInvoices(mockInvoices)

  const enrichedRedemptions = mockRedemptions.map(r => ({
    ...r,
    statusHistory: mockStatusHistory.filter(h => h.redemptionId === r.id)
  }))
  redemptionStore.initRedemptions(enrichedRedemptions)
  redemptionStore.initHistory(mockStatusHistory)

  creditStore.initCreditHistory(mockCreditHistory)
  paymentStore.initPayments(mockPayments)

  const totalInvoiced = mockInvoices.reduce((sum, inv) => sum + inv.amount, 0)
  const redeemedAmount = mockRedemptions
    .filter(r => r.status === 'completed')
    .reduce((sum, r) => sum + r.amount, 0)
  creditStore.setUsedCredit(totalInvoiced - redeemedAmount)
}
