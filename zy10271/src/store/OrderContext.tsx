import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Order, OrderStatus, HistoryEntry, FilterOptions } from '../types'

interface OrderContextType {
  orders: Order[]
  filters: FilterOptions
  addOrder: (order: Omit<Order, 'id' | 'createdAt' | 'history' | 'reworkCount' | 'status'>) => void
  updateOrderStatus: (orderId: string, newStatus: OrderStatus, operator: string, remarks?: string) => void
  updateOrder: (orderId: string, updates: Partial<Order>) => void
  deleteOrder: (orderId: string) => void
  setFilters: (filters: Partial<FilterOptions>) => void
  getFilteredOrders: () => Order[]
  getOrderById: (id: string) => Order | undefined
  validateEyeParams: (left: any, right: any) => { valid: boolean; errors: string[] }
  canPickup: (order: Order) => boolean
  importOrders: (orders: Omit<Order, 'id' | 'createdAt' | 'history' | 'reworkCount' | 'status'>[]) => void
}

const OrderContext = createContext<OrderContextType | undefined>(undefined)

const STATUS_FLOW: OrderStatus[] = [
  'pending',
  'measuring',
  'cutting',
  'polishing',
  'edging',
  'quality-check',
  'ready',
  'picked-up'
]

const createHistoryEntry = (status: OrderStatus, operator: string, remarks?: string): HistoryEntry => ({
  id: uuidv4(),
  status,
  timestamp: new Date().toISOString(),
  operator,
  remarks
})

export const OrderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [orders, setOrders] = useState<Order[]>([])
  const [filters, setFiltersState] = useState<FilterOptions>({})

  const validateEyeParams = useCallback((left: any, right: any) => {
    const errors: string[] = []

    if (left.axis < 0 || left.axis > 180) {
      errors.push('左眼轴位必须在0-180之间')
    }
    if (right.axis < 0 || right.axis > 180) {
      errors.push('右眼轴位必须在0-180之间')
    }

    if (Math.abs(left.sphere - right.sphere) > 6) {
      errors.push('左右眼球镜度数差异过大，请确认')
    }

    return { valid: errors.length === 0, errors }
  }, [])

  const canPickup = useCallback((order: Order) => {
    if (!order.qualityCheck) return false
    if (!order.qualityCheck.passed) return false
    if (order.status !== 'ready') return false
    return true
  }, [])

  const addOrder = useCallback((orderData: Omit<Order, 'id' | 'createdAt' | 'history' | 'reworkCount' | 'status'>) => {
    const exists = orders.some(o => 
      o.orderNo === orderData.orderNo ||
      (o.customerName === orderData.customerName && o.phone === orderData.phone && 
       o.status !== 'picked-up')
    )
    
    if (exists) {
      throw new Error('订单已存在或该客户有未完成订单')
    }

    const validation = validateEyeParams(orderData.leftEye, orderData.rightEye)
    if (!validation.valid) {
      throw new Error(`验光参数有误: ${validation.errors.join(', ')}`)
    }

    const newOrder: Order = {
      ...orderData,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      status: 'pending',
      reworkCount: 0,
      history: [createHistoryEntry('pending', 'system', '订单创建')]
    }

    setOrders(prev => [...prev, newOrder])
  }, [orders, validateEyeParams])

  const updateOrderStatus = useCallback((orderId: string, newStatus: OrderStatus, operator: string, remarks?: string) => {
    const order = orders.find(o => o.id === orderId)
    if (!order) return

    if (newStatus === 'picked-up' && !canPickup(order)) {
      throw new Error('未通过质检的订单不能取镜')
    }

    if (newStatus === 'rework' && order.status !== 'quality-check') {
      throw new Error('只有质检未通过的订单才能返工')
    }

    if (newStatus !== 'rework' && newStatus !== 'picked-up' && order.status === 'rework') {
      const currentIndex = STATUS_FLOW.indexOf(newStatus)
      if (currentIndex <= STATUS_FLOW.indexOf('quality-check')) {
        setOrders(prev => prev.map(o => 
          o.id === orderId 
            ? {
                ...o,
                status: newStatus,
                reworkCount: o.reworkCount + 1,
                history: [...o.history, createHistoryEntry(newStatus, operator, remarks)]
              }
            : o
        ))
        return
      }
    }

    const currentIndex = STATUS_FLOW.indexOf(order.status)
    const newIndex = STATUS_FLOW.indexOf(newStatus)
    
    if (newStatus !== 'rework' && newIndex <= currentIndex && order.status !== 'rework') {
      throw new Error('不能回退到已完成的状态')
    }

    setOrders(prev => prev.map(o => 
      o.id === orderId 
        ? {
            ...o,
            status: newStatus,
            history: [...o.history, createHistoryEntry(newStatus, operator, remarks)],
            pickedUpAt: newStatus === 'picked-up' ? new Date().toISOString() : o.pickedUpAt
          }
        : o
    ))
  }, [orders, canPickup])

  const updateOrder = useCallback((orderId: string, updates: Partial<Order>) => {
    setOrders(prev => prev.map(o => 
      o.id === orderId ? { ...o, ...updates } : o
    ))
  }, [])

  const deleteOrder = useCallback((orderId: string) => {
    setOrders(prev => prev.filter(o => o.id !== orderId))
  }, [])

  const setFilters = useCallback((newFilters: Partial<FilterOptions>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }))
  }, [])

  const getFilteredOrders = useCallback(() => {
    return orders.filter(order => {
      if (filters.status && filters.status.length > 0) {
        if (filters.status.includes('rework') && order.reworkCount > 0) {
        } else if (!filters.status.includes(order.status)) {
          return false
        }
      }
      if (filters.search) {
        const search = filters.search.toLowerCase()
        if (!order.orderNo.toLowerCase().includes(search) &&
            !order.customerName.toLowerCase().includes(search) &&
            !order.phone.includes(search)) {
          return false
        }
      }
      if (filters.hasRework && order.reworkCount === 0) {
        return false
      }
      return true
    })
  }, [orders, filters])

  const getOrderById = useCallback((id: string) => {
    return orders.find(o => o.id === id)
  }, [orders])

  const importOrders = useCallback((ordersData: Omit<Order, 'id' | 'createdAt' | 'history' | 'reworkCount' | 'status'>[]) => {
    const existingOrderNos = new Set(orders.map(o => o.orderNo))
    
    const validOrders = ordersData.filter(orderData => {
      if (existingOrderNos.has(orderData.orderNo)) return false
      const validation = validateEyeParams(orderData.leftEye, orderData.rightEye)
      return validation.valid
    }).map(orderData => ({
      ...orderData,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      status: 'pending' as OrderStatus,
      reworkCount: 0,
      history: [createHistoryEntry('pending', 'system', '订单创建')]
    }))

    setOrders(prev => [...prev, ...validOrders])
  }, [orders, validateEyeParams])

  const value: OrderContextType = {
    orders,
    filters,
    addOrder,
    updateOrderStatus,
    updateOrder,
    deleteOrder,
    setFilters,
    getFilteredOrders,
    getOrderById,
    validateEyeParams,
    canPickup,
    importOrders
  }

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>
}

export const useOrderContext = () => {
  const context = useContext(OrderContext)
  if (context === undefined) {
    throw new Error('useOrderContext must be used within an OrderProvider')
  }
  return context
}
