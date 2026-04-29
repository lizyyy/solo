const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

Page({
  data: {
    orderId: null,
    order: null,
    loading: true
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ orderId: options.id })
      this.loadOrder(options.id)
    }
  },

  async loadOrder(orderId) {
    this.setData({ loading: true })
    
    try {
      const res = await api.getOrderById(orderId)
      
      if (res.code === 0 && res.data) {
        const order = {
          ...res.data,
          statusText: util.getOrderStatusText(res.data.status),
          statusColor: util.getOrderStatusColor(res.data.status),
          createTimeText: util.formatTime(new Date(res.data.createTime))
        }
        
        this.setData({
          order,
          loading: false
        })
      } else {
        util.showToast('订单不存在')
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      }
    } catch (error) {
      console.error('加载订单详情失败:', error)
      util.showToast('加载失败，请重试')
      this.setData({ loading: false })
    }
  },

  async onPayOrder() {
    const { orderId } = this.data
    
    try {
      util.showLoading('支付中...')
      
      const res = await api.payOrder(orderId)
      
      util.hideLoading()
      
      if (res.code === 0) {
        util.showToast('支付成功', 'success')
        this.loadOrder(orderId)
      } else {
        util.showToast(res.message || '支付失败')
      }
    } catch (error) {
      util.hideLoading()
      console.error('支付失败:', error)
      util.showToast('支付失败')
    }
  },

  async onCancelOrder() {
    const { orderId } = this.data
    
    const confirmed = await util.showModal('确认取消', '确定要取消该订单吗？')
    
    if (confirmed) {
      try {
        const res = await api.cancelOrder(orderId)
        
        if (res.code === 0) {
          util.showToast('订单已取消', 'success')
          this.loadOrder(orderId)
        } else {
          util.showToast(res.message || '取消失败')
        }
      } catch (error) {
        console.error('取消订单失败:', error)
        util.showToast('取消失败')
      }
    }
  },

  async onConfirmOrder() {
    const { orderId } = this.data
    
    const confirmed = await util.showModal('确认收货', '确认已收到商品吗？')
    
    if (confirmed) {
      try {
        const res = await api.confirmOrder(orderId)
        
        if (res.code === 0) {
          util.showToast('确认成功', 'success')
          this.loadOrder(orderId)
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
  },

  onContactService() {
    util.showToast('客服功能开发中')
  }
})
