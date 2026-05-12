import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import { Order, OrderStatus, FilterOptions, EyeParams } from '../types'

const API_BASE = '/api'

interface OrderContextType {
  orders: Order[]
  filters: FilterOptions
  loading: boolean
  addOrder: (order: Omit<Order, 'id' | 'createdAt' | 'history' | 'reworkCount' | 'status'>) => Promise<void>
  updateOrderStatus: (orderId: string, newStatus: OrderStatus, operator: string, remarks?: string) => Promise<void>
  updateOrder: (orderId: string, updates: Partial<Order>) => void
  deleteOrder: (orderId: string) => Promise<void>
  setFilters: (filters: Partial<FilterOptions>) => void
  getFilteredOrders: () => Order[]
  getOrderById: (id: string) => Order | undefined
  validateEyeParams: (left: EyeParams, right: any) => { valid: boolean; errors: string[] }
  canPickup: (order: Order) => boolean
  importOrders: (orders: Omit<Order, 'id' | 'createdAt' | 'history' | 'reworkCount' | 'status'>[]) => Promise<void>
  refreshOrders: () => Promise<void>
}

const OrderContext = createContext<OrderContextType | undefined>(undefined)

export const OrderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [orders, setOrders] = useState<Order[]>([])
  const [filters, setFiltersState] = useState<FilterOptions>({})
  const [loading, setLoading] = useState(false)

  const refreshOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/orders`)
      if (res.ok) {
        const data = await res.json()
        setOrders(data)
      }
    } catch (e) {
      console.error('Failed to fetch orders:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshOrders()
  }, [refreshOrders])

  const validateEyeParams = useCallback((left: EyeParams, right: EyeParams) => {
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

  const addOrder = useCallback(async (orderData: Omit<Order, 'id' | 'createdAt' | 'history' | 'reworkCount' | 'status'>) => {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || '创建订单失败')
    }

    await refreshOrders()
  }, [refreshOrders])

  const updateOrderStatus = useCallback(async (orderId: string, newStatus: OrderStatus, operator: string, remarks?: string) => {
    const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newStatus, operator, remarks })
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || '更新状态失败')
    }

    await refreshOrders()
  }, [refreshOrders])

  const updateOrder = useCallback((orderId: string, updates: Partial<Order>) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o))
  }, [])

  const deleteOrder = useCallback(async (orderId: string) => {
    const res = await fetch(`${API_BASE}/orders/${orderId}`, {
      method: 'DELETE'
    })

    if (!res.ok) {
      throw new Error('删除订单失败')
    }

    await refreshOrders()
  }, [refreshOrders])

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

  const importOrders = useCallback(async (ordersData: Omit<Order, 'id' | 'createdAt' | 'history' | 'reworkCount' | 'status'>[]) => {
    for (const orderData of ordersData) {
      try {
        await addOrder(orderData)
      } catch (e) {
        console.log('Skipping duplicate order:', orderData.orderNo)
      }
    }
  }, [addOrder])

  const value: OrderContextType = {
    orders,
    filters,
    loading,
    addOrder,
    updateOrderStatus,
    updateOrder,
    deleteOrder,
    setFilters,
    getFilteredOrders,
    getOrderById,
    validateEyeParams,
    canPickup,
    importOrders,
    refreshOrders
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
