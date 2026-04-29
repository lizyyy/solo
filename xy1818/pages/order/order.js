const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

Page({
  data: {
    tabs: [
      { id: 'all', name: '全部', status: null },
      { id: 'pending', name: '待支付', status: 'pending' },
      { id: 'paid', name: '待收货', status: 'paid' },
      { id: 'completed', name: '已完成', status: 'completed' }
    ],
    activeTab: 0,
    orders: [],
    loading: true,
    empty: false
  },

  onLoad() {
    this.loadOrders()
  },

  onShow() {
    this.loadOrders()
  },

  async loadOrders() {
    this.setData({ loading: true })
    
    try {
      const { tabs, activeTab } = this.data
      const status = tabs[activeTab].status
      
      const res = await api.getOrders(status)
      
      const orders = res.data.map(order => ({
        ...order,
        statusText: util.getOrderStatusText(order.status),
        statusColor: util.getOrderStatusColor(order.status),
        createTimeText: util.formatOrderTime(order.createTime)
      }))

      this.setData({
        orders,
        empty: orders.length === 0,
        loading: false
      })
    } catch (error) {
      console.error('加载订单失败:', error)
      util.showToast('加载失败，请重试')
      this.setData({ loading: false })
    }
  },

  onTabChange(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ activeTab: index })
    this.loadOrders()
  },

  onOrderTap(e) {
    const orderId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/order/detail?id=${orderId}`
    })
  },

  async onPayOrder(e) {
    const orderId = e.currentTarget.dataset.id
    
    try {
      util.showLoading('支付中...')
      
      const res = await api.payOrder(orderId)
      
      util.hideLoading()
      
      if (res.code === 0) {
        util.showToast('支付成功', 'success')
        this.loadOrders()
      } else {
        util.showToast(res.message || '支付失败')
      }
    } catch (error) {
      util.hideLoading()
      console.error('支付失败:', error)
      util.showToast('支付失败')
    }
  },

  async onCancelOrder(e) {
    const orderId = e.currentTarget.dataset.id
    
    const confirmed = await util.showModal('确认取消', '确定要取消该订单吗？')
    
    if (confirmed) {
      try {
        const res = await api.cancelOrder(orderId)
        
        if (res.code === 0) {
          util.showToast('订单已取消', 'success')
          this.loadOrders()
        } else {
          util.showToast(res.message || '取消失败')
        }
      } catch (error) {
        console.error('取消订单失败:', error)
        util.showToast('取消失败')
      }
    }
  },

  async onConfirmOrder(e) {
    const orderId = e.currentTarget.dataset.id
    
    const confirmed = await util.showModal('确认收货', '确认已收到商品吗？')
    
    if (confirmed) {
      try {
        const res = await api.confirmOrder(orderId)
        
        if (res.code === 0) {
          util.showToast('确认成功', 'success')
          this.loadOrders()
        } else {
          util.showToast(res.message || '操作失败')
        }
      } catch (error) {
        console.error('确认收货失败:', error)
        util.showToast('操作失败')
      }
    }
  },

  onGoShopping() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  }
})
