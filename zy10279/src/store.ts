import { create } from 'zustand'
import {
  Pallet,
  OutboundRecord,
  Customer,
  DamageRecord,
  SettlementRecord,
  ProcessRecord,
  DashboardStats,
} from './types'
import { addDays, differenceInDays, isAfter } from 'date-fns'
import * as XLSX from 'xlsx'

interface PalletStore {
  pallets: Pallet[]
  outboundRecords: OutboundRecord[]
  customers: Customer[]
  damageRecords: DamageRecord[]
  settlementRecords: SettlementRecord[]
  processRecords: ProcessRecord[]

  addPallet: (pallet: Omit<Pallet, 'id' | 'createdAt' | 'updatedAt'>) => { success: boolean; message?: string }
  addOutbound: (outbound: Omit<OutboundRecord, 'id' | 'status' | 'createdAt'>) => { success: boolean; message?: string; blocked?: boolean }
  signForDelivery: (outboundId: string, signDate: string) => { success: boolean; message?: string }
  returnPallet: (outboundId: string, returnDate: string, damageCheck: { palletId: string; damaged: boolean; level?: string; description?: string }[]) => { success: boolean; message?: string }
  processDamage: (damageId: string, deduct: boolean) => { success: boolean; message?: string }
  addSettlement: (settlement: Omit<SettlementRecord, 'id' | 'createdAt'>) => { success: boolean; message?: string }
  addCustomer: (customer: Omit<Customer, 'id' | 'totalDeposit' | 'usedDeposit' | 'createdAt'>) => { success: boolean; message?: string }
  getDashboardStats: () => DashboardStats
  getPendingRecords: () => ProcessRecord[]
  getCompletedRecords: () => ProcessRecord[]
  getBlockedRecords: () => ProcessRecord[]
  exportCustomerDetails: (customerId?: string) => void
  checkOverdue: () => void
  initSampleData: () => void
}

const generateId = () => Math.random().toString(36).substr(2, 9)

export const usePalletStore = create<PalletStore>((set, get) => ({
  pallets: [],
  outboundRecords: [],
  customers: [],
  damageRecords: [],
  settlementRecords: [],
  processRecords: [],

  addPallet: (palletData) => {
    const { pallets } = get()
    if (pallets.some(p => p.code === palletData.code)) {
      return { success: false, message: '托盘编号已存在' }
    }
    const now = new Date().toISOString()
    const newPallet: Pallet = {
      ...palletData,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    }
    set(state => ({ pallets: [...state.pallets, newPallet] }))
    return { success: true }
  },

  addCustomer: (customerData) => {
    const { customers } = get()
    if (customers.some(c => c.name === customerData.name)) {
      return { success: false, message: '客户已存在' }
    }
    const now = new Date().toISOString()
    const newCustomer: Customer = {
      ...customerData,
      id: generateId(),
      totalDeposit: 0,
      usedDeposit: 0,
      createdAt: now,
    }
    set(state => ({ customers: [...state.customers, newCustomer] }))
    return { success: true }
  },

  addOutbound: (outboundData) => {
    const { pallets, customers, outboundRecords } = get()

    const duplicateCheck = outboundRecords.some(
      o => o.customerId === outboundData.customerId &&
        o.outboundDate === outboundData.outboundDate &&
        o.palletIds.length === outboundData.palletIds.length &&
        o.palletIds.every(id => outboundData.palletIds.includes(id))
    )
    if (duplicateCheck) {
      return { success: false, message: '重复出库申请，该批次托盘已在同一日期出库给该客户' }
    }

    const issues: string[] = []
    const invalidPallets = outboundData.palletIds.filter(id => {
      const pallet = pallets.find(p => p.id === id)
      return !pallet || pallet.status !== 'in_stock'
    })
    if (invalidPallets.length > 0) {
      issues.push(`${invalidPallets.length}个托盘不在库中或状态异常`)
    }

    const crossCustomerPallets = outboundData.palletIds.filter(id => {
      const pallet = pallets.find(p => p.id === id)
      return pallet && pallet.currentCustomer && pallet.currentCustomer !== outboundData.customerId
    })
    if (crossCustomerPallets.length > 0) {
      issues.push(`${crossCustomerPallets.length}个托盘属于其他客户，存在串号风险`)
    }

    const customer = customers.find(c => c.id === outboundData.customerId)
    const requiredDeposit = outboundData.palletIds.length * 50
    if (!customer || customer.totalDeposit - customer.usedDeposit < requiredDeposit) {
      issues.push(`客户押金不足，需要${requiredDeposit}元押金`)
    }

    const now = new Date().toISOString()
    const newOutbound: OutboundRecord = {
      ...outboundData,
      id: generateId(),
      status: 'pending_signature',
      createdAt: now,
    }

    const processRecord: ProcessRecord = {
      id: generateId(),
      type: 'outbound',
      refId: newOutbound.id,
      title: `出库 - ${outboundData.customerName}`,
      description: `${outboundData.palletIds.length}个托盘`,
      status: issues.length > 0 ? 'blocked' : 'pending',
      blockReason: issues.length > 0 ? issues.join('；') : undefined,
      createdAt: now,
    }

    if (issues.length === 0) {
      set(state => ({
        outboundRecords: [...state.outboundRecords, newOutbound],
        processRecords: [...state.processRecords, processRecord],
        pallets: state.pallets.map(p =>
          outboundData.palletIds.includes(p.id)
            ? { ...p, status: 'in_transit' as const, currentCustomer: outboundData.customerId, lastOutboundId: newOutbound.id, updatedAt: now }
            : p
        ),
      }))
      return { success: true }
    } else {
      set(state => ({
        outboundRecords: [...state.outboundRecords, newOutbound],
        processRecords: [...state.processRecords, processRecord],
      }))
      return { success: false, message: issues.join('；'), blocked: true }
    }
  },

  signForDelivery: (outboundId: string, signDate: string) => {
    const { outboundRecords } = get()
    const outbound = outboundRecords.find(o => o.id === outboundId)
    if (!outbound || outbound.status !== 'pending_signature') {
      return { success: false, message: '出库记录不存在或状态异常' }
    }

    const now = new Date().toISOString()
    set(state => ({
      outboundRecords: state.outboundRecords.map(o =>
        o.id === outboundId ? { ...o, status: 'signed' as const, signedDate: signDate } : o
      ),
      pallets: state.pallets.map(p =>
        outbound.palletIds.includes(p.id)
          ? { ...p, status: 'with_customer' as const, updatedAt: now }
          : p
      ),
      processRecords: state.processRecords.map(pr =>
        pr.type === 'outbound' && pr.refId === outboundId
          ? { ...pr, status: 'completed' as const, handledAt: now }
          : pr
      ),
    }))

    const processRecord: ProcessRecord = {
      id: generateId(),
      type: 'signature',
      refId: outboundId,
      title: `签收 - ${outbound.customerName}`,
      description: `${outbound.palletIds.length}个托盘已签收`,
      status: 'completed',
      createdAt: now,
      handledAt: now,
    }
    set(state => ({ processRecords: [...state.processRecords, processRecord] }))

    return { success: true }
  },

  returnPallet: (outboundId: string, returnDate: string, damageCheck) => {
    const { outboundRecords, customers } = get()
    const outbound = outboundRecords.find(o => o.id === outboundId)
    if (!outbound || (outbound.status !== 'signed' && outbound.status !== 'overdue')) {
      return { success: false, message: '出库记录不存在或状态异常' }
    }

    const now = new Date().toISOString()
    const newDamages: DamageRecord[] = []

    for (const check of damageCheck) {
      if (check.damaged && check.level) {
        const description = check.description || '未填写破损描述'
        const deductionAmount = check.level === 'minor' ? 20 : check.level === 'medium' ? 50 : 100
        const damage: DamageRecord = {
          id: generateId(),
          palletId: check.palletId,
          outboundId,
          customerId: outbound.customerId,
          customerName: outbound.customerName,
          damageLevel: check.level as 'minor' | 'medium' | 'severe',
          damageDescription: description,
          deductionAmount,
          deducted: false,
          detectedDate: returnDate,
          createdAt: now,
        }
        newDamages.push(damage)
      }
    }

    const hasUnpaidDamages = newDamages.length > 0
    const customer = customers.find(c => c.id === outbound.customerId)
    const totalDeduction = newDamages.reduce((sum, d) => sum + d.deductionAmount, 0)
    const canCoverDeduction = customer && customer.totalDeposit - customer.usedDeposit >= totalDeduction

    set(state => ({
      outboundRecords: state.outboundRecords.map(o =>
        o.id === outboundId ? { ...o, status: 'returned' as const, returnedDate: returnDate } : o
      ),
      pallets: state.pallets.map(p => {
        if (outbound.palletIds.includes(p.id)) {
          const damage = newDamages.find(d => d.palletId === p.id)
          if (damage) {
            return { ...p, status: 'pending_compensation' as const, updatedAt: now }
          }
          return { ...p, status: 'in_stock' as const, currentCustomer: undefined, lastOutboundId: undefined, updatedAt: now }
        }
        return p
      }),
      damageRecords: [...state.damageRecords, ...newDamages],
      processRecords: state.processRecords.map(pr =>
        pr.type === 'signature' && pr.refId === outboundId
          ? { ...pr, status: 'completed' as const, handledAt: now }
          : pr
      ),
    }))

    for (const damage of newDamages) {
      const processRecord: ProcessRecord = {
        id: generateId(),
        type: 'damage',
        refId: damage.id,
        title: `破损待处理 - ${outbound.customerName}`,
        description: `托盘破损等级: ${damage.damageLevel === 'minor' ? '轻微' : damage.damageLevel === 'medium' ? '中等' : '严重'}, 扣款${damage.deductionAmount}元`,
        status: 'pending',
        createdAt: now,
      }
      set(state => ({ processRecords: [...state.processRecords, processRecord] }))
    }

    const returnProcessRecord: ProcessRecord = {
      id: generateId(),
      type: 'return',
      refId: outboundId,
      title: `回收 - ${outbound.customerName}`,
      description: `${outbound.palletIds.length}个托盘已回收${newDamages.length > 0 ? `，发现${newDamages.length}个破损` : ''}`,
      status: hasUnpaidDamages && !canCoverDeduction ? 'blocked' : 'completed',
      blockReason: hasUnpaidDamages && !canCoverDeduction ? `客户押金不足以支付${totalDeduction}元破损扣款，请先充值或进行扣款结算` : undefined,
      createdAt: now,
      handledAt: now,
    }
    set(state => ({ processRecords: [...state.processRecords, returnProcessRecord] }))

    return { success: true }
  },

  processDamage: (damageId: string, deduct: boolean) => {
    const { damageRecords } = get()
    const damage = damageRecords.find(d => d.id === damageId)
    if (!damage || damage.deducted) {
      return { success: false, message: '破损记录不存在或已处理' }
    }

    const now = new Date().toISOString()

    if (deduct) {
      const settlement: SettlementRecord = {
        id: generateId(),
        customerId: damage.customerId,
        customerName: damage.customerName,
        type: 'deduction',
        amount: damage.deductionAmount,
        relatedDamageIds: [damageId],
        remark: `托盘破损扣款: ${damage.damageDescription}`,
        settlementDate: now,
        createdAt: now,
      }

      set(state => ({
        damageRecords: state.damageRecords.map(d =>
          d.id === damageId ? { ...d, deducted: true, deductedDate: now } : d
        ),
        pallets: state.pallets.map(p =>
          p.id === damage.palletId ? { ...p, status: 'in_stock' as const, updatedAt: now } : p
        ),
        customers: state.customers.map(c =>
          c.id === damage.customerId ? { ...c, usedDeposit: c.usedDeposit + damage.deductionAmount } : c
        ),
        settlementRecords: [...state.settlementRecords, settlement],
        processRecords: state.processRecords.map(pr =>
          pr.type === 'damage' && pr.refId === damageId
            ? { ...pr, status: 'completed' as const, handledAt: now }
            : pr
        ),
      }))

      const settlementProcessRecord: ProcessRecord = {
        id: generateId(),
        type: 'settlement',
        refId: settlement.id,
        title: `破损扣款结算 - ${damage.customerName}`,
        description: `扣款${damage.deductionAmount}元`,
        status: 'completed',
        createdAt: now,
        handledAt: now,
      }
      set(state => ({ processRecords: [...state.processRecords, settlementProcessRecord] }))
    } else {
      set(state => ({
        damageRecords: state.damageRecords.map(d =>
          d.id === damageId ? { ...d, deducted: true, deductedDate: now } : d
        ),
        pallets: state.pallets.map(p =>
          p.id === damage.palletId ? { ...p, status: 'in_stock' as const, updatedAt: now } : p
        ),
        processRecords: state.processRecords.map(pr =>
          pr.type === 'damage' && pr.refId === damageId
            ? { ...pr, status: 'completed' as const, handledAt: now }
            : pr
        ),
      }))
    }

    return { success: true }
  },

  addSettlement: (settlementData) => {
    const { settlementRecords } = get()

    const duplicateCheck = settlementRecords.some(
      s => s.customerId === settlementData.customerId &&
        s.type === settlementData.type &&
        s.amount === settlementData.amount &&
        Math.abs(new Date(s.settlementDate).getTime() - new Date(settlementData.settlementDate).getTime()) < 60000
    )
    if (duplicateCheck) {
      return { success: false, message: '重复结算记录' }
    }

    const now = new Date().toISOString()
    const settlement: SettlementRecord = {
      ...settlementData,
      id: generateId(),
      createdAt: now,
    }

    set(state => ({
      settlementRecords: [...state.settlementRecords, settlement],
      customers: state.customers.map(c => {
        if (c.id === settlementData.customerId) {
          if (settlementData.type === 'deposit_payment') {
            return { ...c, totalDeposit: c.totalDeposit + settlementData.amount }
          } else if (settlementData.type === 'refund') {
            return { ...c, totalDeposit: c.totalDeposit - settlementData.amount }
          }
        }
        return c
      }),
    }))

    const processRecord: ProcessRecord = {
      id: generateId(),
      type: 'settlement',
      refId: settlement.id,
      title: `结算 - ${settlementData.customerName}`,
      description: `${settlementData.type === 'deposit_payment' ? '押金充值' : settlementData.type === 'deduction' ? '扣款' : '退款'} ${settlementData.amount}元`,
      status: 'completed',
      createdAt: now,
      handledAt: now,
    }
    set(state => ({ processRecords: [...state.processRecords, processRecord] }))

    return { success: true }
  },

  getDashboardStats: () => {
    const { pallets } = get()
    return {
      inStock: pallets.filter(p => p.status === 'in_stock').length,
      inTransit: pallets.filter(p => p.status === 'in_transit').length,
      withCustomer: pallets.filter(p => p.status === 'with_customer').length,
      pendingCompensation: pallets.filter(p => p.status === 'pending_compensation').length,
      totalPallets: pallets.length,
    }
  },

  getPendingRecords: () => get().processRecords.filter(pr => pr.status === 'pending').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  getCompletedRecords: () => get().processRecords.filter(pr => pr.status === 'completed').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  getBlockedRecords: () => get().processRecords.filter(pr => pr.status === 'blocked').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),

  checkOverdue: () => {
    const { outboundRecords, processRecords } = get()
    const now = new Date()

    for (const outbound of outboundRecords) {
      if ((outbound.status === 'signed' || outbound.status === 'pending_signature') &&
        isAfter(now, new Date(outbound.expectedReturnDate))) {
        const daysOverdue = differenceInDays(now, new Date(outbound.expectedReturnDate))
        const existingBlock = processRecords.find(
          pr => pr.type === 'outbound' && pr.refId === outbound.id && pr.status === 'blocked'
        )
        if (!existingBlock) {
          const processRecord: ProcessRecord = {
            id: generateId(),
            type: 'outbound',
            refId: outbound.id,
            title: `逾期预警 - ${outbound.customerName}`,
            description: `已逾期${daysOverdue}天，共${outbound.palletIds.length}个托盘`,
            status: 'blocked',
            blockReason: `托盘超期${daysOverdue}天未归还，请及时跟进`,
            createdAt: now.toISOString(),
          }
          set(state => ({ processRecords: [...state.processRecords, processRecord] }))
        }
      }
    }
  },

  exportCustomerDetails: (customerId) => {
    const { pallets, outboundRecords, damageRecords, settlementRecords, customers } = get()

    const targetCustomers = customerId ? customers.filter(c => c.id === customerId) : customers
    const data: any[] = []

    for (const customer of targetCustomers) {
      const customerPallets = pallets.filter(p => p.currentCustomer === customer.id)
      const customerOutbounds = outboundRecords.filter(o => o.customerId === customer.id)
      const customerDamages = damageRecords.filter(d => d.customerId === customer.id)
      const customerSettlements = settlementRecords.filter(s => s.customerId === customer.id)

      data.push({
        '客户名称': customer.name,
        '联系人': customer.contact,
        '电话': customer.phone,
        '总押金': customer.totalDeposit,
        '已用押金': customer.usedDeposit,
        '可用押金': customer.totalDeposit - customer.usedDeposit,
        '持有托盘数': customerPallets.length,
        '出库次数': customerOutbounds.length,
        '破损次数': customerDamages.length,
        '累计破损扣款': customerDamages.filter(d => d.deducted).reduce((sum, d) => sum + d.deductionAmount, 0),
        '结算次数': customerSettlements.length,
      })
    }

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '客户明细')
    XLSX.writeFile(wb, `客户明细_${new Date().toISOString().split('T')[0]}.xlsx`)
  },

  initSampleData: () => {
    const now = new Date()

    const sampleCustomers: Customer[] = [
      { id: 'c1', name: '旺旺食品', contact: '张经理', phone: '13800138001', address: '上海市浦东新区', totalDeposit: 5000, usedDeposit: 1200, createdAt: addDays(now, -30).toISOString() },
      { id: 'c2', name: '农夫山泉', contact: '李总', phone: '13800138002', address: '杭州市西湖区', totalDeposit: 8000, usedDeposit: 2500, createdAt: addDays(now, -25).toISOString() },
      { id: 'c3', name: '顺丰物流', contact: '王主管', phone: '13800138003', address: '深圳市南山区', totalDeposit: 3000, usedDeposit: 800, createdAt: addDays(now, -20).toISOString() },
    ]

    const samplePallets: Pallet[] = []
    for (let i = 1; i <= 50; i++) {
      const status = i <= 20 ? 'in_stock' : i <= 35 ? 'with_customer' : i <= 45 ? 'in_transit' : 'pending_compensation'
      samplePallets.push({
        id: `p${i}`,
        code: `PLT-${String(i).padStart(4, '0')}`,
        type: i <= 25 ? '标准木托盘' : '塑料托盘',
        deposit: 50,
        status,
        currentCustomer: status === 'with_customer' ? (i <= 30 ? 'c1' : 'c2') : status === 'pending_compensation' ? 'c3' : undefined,
        createdAt: addDays(now, -40).toISOString(),
        updatedAt: addDays(now, -5).toISOString(),
      })
    }

    const sampleOutbounds: OutboundRecord[] = [
      {
        id: 'o1',
        palletIds: ['p21', 'p22', 'p23', 'p24', 'p25'],
        customerId: 'c1',
        customerName: '旺旺食品',
        driverName: '刘师傅',
        plateNumber: '沪A12345',
        outboundDate: addDays(now, -10).toISOString().split('T')[0],
        expectedReturnDate: addDays(now, 5).toISOString().split('T')[0],
        status: 'signed',
        signedDate: addDays(now, -9).toISOString().split('T')[0],
        createdAt: addDays(now, -10).toISOString(),
      },
      {
        id: 'o2',
        palletIds: ['p26', 'p27', 'p28', 'p29', 'p30'],
        customerId: 'c1',
        customerName: '旺旺食品',
        driverName: '陈师傅',
        plateNumber: '沪B67890',
        outboundDate: addDays(now, -7).toISOString().split('T')[0],
        expectedReturnDate: addDays(now, 8).toISOString().split('T')[0],
        status: 'signed',
        signedDate: addDays(now, -6).toISOString().split('T')[0],
        createdAt: addDays(now, -7).toISOString(),
      },
      {
        id: 'o3',
        palletIds: ['p31', 'p32', 'p33', 'p34', 'p35'],
        customerId: 'c2',
        customerName: '农夫山泉',
        driverName: '赵师傅',
        plateNumber: '浙A11111',
        outboundDate: addDays(now, -5).toISOString().split('T')[0],
        expectedReturnDate: addDays(now, 10).toISOString().split('T')[0],
        status: 'signed',
        signedDate: addDays(now, -4).toISOString().split('T')[0],
        createdAt: addDays(now, -5).toISOString(),
      },
      {
        id: 'o4',
        palletIds: ['p36', 'p37', 'p38', 'p39', 'p40', 'p41', 'p42', 'p43', 'p44', 'p45'],
        customerId: 'c2',
        customerName: '农夫山泉',
        driverName: '孙师傅',
        plateNumber: '浙B22222',
        outboundDate: addDays(now, -1).toISOString().split('T')[0],
        expectedReturnDate: addDays(now, 14).toISOString().split('T')[0],
        status: 'pending_signature',
        createdAt: addDays(now, -1).toISOString(),
      },
      {
        id: 'o5',
        palletIds: ['p1', 'p2', 'p3'],
        customerId: 'c3',
        customerName: '顺丰物流',
        driverName: '周师傅',
        plateNumber: '粤A33333',
        outboundDate: addDays(now, -15).toISOString().split('T')[0],
        expectedReturnDate: addDays(now, -1).toISOString().split('T')[0],
        status: 'overdue',
        signedDate: addDays(now, -14).toISOString().split('T')[0],
        createdAt: addDays(now, -15).toISOString(),
      },
    ]

    const sampleDamages: DamageRecord[] = [
      {
        id: 'd1',
        palletId: 'p46',
        outboundId: 'o5',
        customerId: 'c3',
        customerName: '顺丰物流',
        damageLevel: 'minor',
        damageDescription: '边角轻微磨损',
        deductionAmount: 20,
        deducted: true,
        detectedDate: addDays(now, -3).toISOString().split('T')[0],
        deductedDate: addDays(now, -2).toISOString().split('T')[0],
        createdAt: addDays(now, -3).toISOString(),
      },
      {
        id: 'd2',
        palletId: 'p47',
        outboundId: 'o5',
        customerId: 'c3',
        customerName: '顺丰物流',
        damageLevel: 'medium',
        damageDescription: '面板断裂一根',
        deductionAmount: 50,
        deducted: false,
        detectedDate: addDays(now, -2).toISOString().split('T')[0],
        createdAt: addDays(now, -2).toISOString(),
      },
      {
        id: 'd3',
        palletId: 'p48',
        outboundId: 'o5',
        customerId: 'c3',
        customerName: '顺丰物流',
        damageLevel: 'severe',
        damageDescription: '整体变形无法使用',
        deductionAmount: 100,
        deducted: false,
        detectedDate: addDays(now, -2).toISOString().split('T')[0],
        createdAt: addDays(now, -2).toISOString(),
      },
    ]

    const sampleSettlements: SettlementRecord[] = [
      {
        id: 's1',
        customerId: 'c1',
        customerName: '旺旺食品',
        type: 'deposit_payment',
        amount: 5000,
        remark: '初始押金充值',
        settlementDate: addDays(now, -30).toISOString().split('T')[0],
        createdAt: addDays(now, -30).toISOString(),
      },
      {
        id: 's2',
        customerId: 'c2',
        customerName: '农夫山泉',
        type: 'deposit_payment',
        amount: 8000,
        remark: '初始押金充值',
        settlementDate: addDays(now, -25).toISOString().split('T')[0],
        createdAt: addDays(now, -25).toISOString(),
      },
      {
        id: 's3',
        customerId: 'c3',
        customerName: '顺丰物流',
        type: 'deposit_payment',
        amount: 3000,
        remark: '初始押金充值',
        settlementDate: addDays(now, -20).toISOString().split('T')[0],
        createdAt: addDays(now, -20).toISOString(),
      },
      {
        id: 's4',
        customerId: 'c3',
        customerName: '顺丰物流',
        type: 'deduction',
        amount: 20,
        relatedDamageIds: ['d1'],
        remark: '托盘边角磨损扣款',
        settlementDate: addDays(now, -2).toISOString().split('T')[0],
        createdAt: addDays(now, -2).toISOString(),
      },
    ]

    const sampleProcessRecords: ProcessRecord[] = [
      { id: 'pr1', type: 'outbound', refId: 'o1', title: '出库 - 旺旺食品', description: '5个托盘', status: 'completed', createdAt: addDays(now, -10).toISOString(), handledAt: addDays(now, -9).toISOString() },
      { id: 'pr2', type: 'signature', refId: 'o1', title: '签收 - 旺旺食品', description: '5个托盘已签收', status: 'completed', createdAt: addDays(now, -9).toISOString(), handledAt: addDays(now, -9).toISOString() },
      { id: 'pr3', type: 'outbound', refId: 'o2', title: '出库 - 旺旺食品', description: '5个托盘', status: 'completed', createdAt: addDays(now, -7).toISOString(), handledAt: addDays(now, -6).toISOString() },
      { id: 'pr4', type: 'signature', refId: 'o2', title: '签收 - 旺旺食品', description: '5个托盘已签收', status: 'completed', createdAt: addDays(now, -6).toISOString(), handledAt: addDays(now, -6).toISOString() },
      { id: 'pr5', type: 'outbound', refId: 'o3', title: '出库 - 农夫山泉', description: '5个托盘', status: 'completed', createdAt: addDays(now, -5).toISOString(), handledAt: addDays(now, -4).toISOString() },
      { id: 'pr6', type: 'signature', refId: 'o3', title: '签收 - 农夫山泉', description: '5个托盘已签收', status: 'completed', createdAt: addDays(now, -4).toISOString(), handledAt: addDays(now, -4).toISOString() },
      { id: 'pr7', type: 'outbound', refId: 'o4', title: '出库 - 农夫山泉', description: '10个托盘', status: 'pending', createdAt: addDays(now, -1).toISOString() },
      { id: 'pr8', type: 'outbound', refId: 'o5', title: '逾期预警 - 顺丰物流', description: '已逾期1天，共3个托盘', status: 'blocked', blockReason: '托盘超期1天未归还，请及时跟进', createdAt: now.toISOString() },
      { id: 'pr9', type: 'damage', refId: 'd2', title: '破损待处理 - 顺丰物流', description: '托盘破损等级: 中等, 扣款50元', status: 'pending', createdAt: addDays(now, -2).toISOString() },
      { id: 'pr10', type: 'damage', refId: 'd3', title: '破损待处理 - 顺丰物流', description: '托盘破损等级: 严重, 扣款100元', status: 'pending', createdAt: addDays(now, -2).toISOString() },
    ]

    set({
      pallets: samplePallets,
      customers: sampleCustomers,
      outboundRecords: sampleOutbounds,
      damageRecords: sampleDamages,
      settlementRecords: sampleSettlements,
      processRecords: sampleProcessRecords,
    })
  },
}))
