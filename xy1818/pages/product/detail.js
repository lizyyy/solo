const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

Page({
  data: {
    productId: null,
    product: null,
    quantity: 1,
    currentSpec: 0,
    cartCount: 0,
    loading: true
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ productId: parseInt(options.id) })
      this.loadProduct(parseInt(options.id))
    }
  },

  onShow() {
    this.loadCartCount()
  },

  async loadProduct(productId) {
    this.setData({ loading: true })
    
    try {
      const res = await api.getProductDetail(productId)
      
      if (res.code === 0 && res.data) {
        this.setData({
          product: res.data,
          loading: false
        })
      } else {
        util.showToast('商品不存在')
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      }
    } catch (error) {
      console.error('加载商品详情失败:', error)
      util.showToast('加载失败，请重试')
      this.setData({ loading: false })
    }
  },

  async loadCartCount() {
    try {
      const res = await api.getCartTotal()
      this.setData({
        cartCount: res.data.count
      })
    } catch (error) {
      console.error('获取购物车数量失败:', error)
    }
  },

  onQuantityChange(e) {
    const type = e.currentTarget.dataset.type
    let quantity = this.data.quantity
    
    if (type === 'increase') {
      quantity += 1
    } else if (type === 'decrease') {
      if (quantity > 1) {
        quantity -= 1
      }
    }
    
    this.setData({ quantity })
  },

  onSpecChange(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ currentSpec: index })
  },

  async onAddToCart() {
    const { product, quantity } = this.data
    
    if (!product) return
    
    if (product.stock < quantity) {
      util.showToast('库存不足')
      return
    }

    try {
      await api.addToCart(product, quantity)
      this.loadCartCount()
      util.showToast('已加入购物车', 'success')
    } catch (error) {
      console.error('加入购物车失败:', error)
      util.showToast('加入购物车失败')
    }
  },

  async onBuyNow() {
    const { product, quantity } = this.data
    
    if (!product) return
    
    if (product.stock < quantity) {
      util.showToast('库存不足')
      return
    }

    try {
      await api.addToCart(product, quantity)
      wx.navigateTo({
        url: '/pages/order/checkout'
      })
    } catch (error) {
      console.error('加入购物车失败:', error)
      util.showToast('操作失败')
    }
  },

  onCartTap() {
    wx.switchTab({
      url: '/pages/cart/cart'
    })
  },

  onShareAppMessage() {
    const { product } = this.data
    return {
      title: product ? `我在甜蜜烘焙发现了${product.name}，快来看看吧~` : '甜蜜烘焙 - 美味面包店',
      path: `/pages/product/detail?id=${this.data.productId}`
    }
  }
})
