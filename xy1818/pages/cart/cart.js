const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

Page({
  data: {
    cart: [],
    totalAmount: 0,
    totalCount: 0,
    selectAll: true,
    empty: false,
    loading: true
  },

  onLoad() {
    this.loadCart()
  },

  onShow() {
    this.loadCart()
  },

  async loadCart() {
    this.setData({ loading: true })
    
    try {
      const [cartRes, totalRes] = await Promise.all([
        api.getCart(),
        api.getCartTotal()
      ])

      const cart = cartRes.data
      const selectAll = cart.length > 0 && cart.every(item => item.selected)
      const empty = cart.length === 0

      this.setData({
        cart,
        totalAmount: totalRes.data.total,
        totalCount: totalRes.data.count,
        selectAll,
        empty,
        loading: false
      })
    } catch (error) {
      console.error('加载购物车失败:', error)
      util.showToast('加载失败，请重试')
      this.setData({ loading: false })
    }
  },

  async onSelectItem(e) {
    const productId = e.currentTarget.dataset.id
    const cart = [...this.data.cart]
    const index = cart.findIndex(item => item.productId === productId)
    
    if (index > -1) {
      cart[index].selected = !cart[index].selected
      
      try {
        const app = getApp()
        app.globalData.cart = cart
        app.saveCart()
        
        const selectAll = cart.length > 0 && cart.every(item => item.selected)
        const selectedItems = cart.filter(item => item.selected)
        const totalAmount = selectedItems.reduce((total, item) => {
          return total + (item.product.price * item.quantity)
        }, 0)
        const totalCount = selectedItems.reduce((total, item) => {
          return total + item.quantity
        }, 0)

        this.setData({
          cart,
          selectAll,
          totalAmount,
          totalCount
        })
      } catch (error) {
        console.error('更新购物车失败:', error)
      }
    }
  },

  async onSelectAll() {
    const cart = [...this.data.cart]
    const selectAll = !this.data.selectAll
    
    cart.forEach(item => {
      item.selected = selectAll
    })

    try {
      const app = getApp()
      app.globalData.cart = cart
      app.saveCart()

      const selectedItems = cart.filter(item => item.selected)
      const totalAmount = selectedItems.reduce((total, item) => {
        return total + (item.product.price * item.quantity)
      }, 0)
      const totalCount = selectedItems.reduce((total, item) => {
        return total + item.quantity
      }, 0)

      this.setData({
        cart,
        selectAll,
        totalAmount,
        totalCount
      })
    } catch (error) {
      console.error('更新购物车失败:', error)
    }
  },

  async onQuantityChange(e) {
    const { id, type } = e.currentTarget.dataset
    const cart = [...this.data.cart]
    const index = cart.findIndex(item => item.productId === parseInt(id))
    
    if (index > -1) {
      const item = cart[index]
      let newQuantity = item.quantity
      
      if (type === 'increase') {
        newQuantity += 1
      } else if (type === 'decrease') {
        newQuantity -= 1
      }

      if (newQuantity <= 0) {
        cart.splice(index, 1)
      } else {
        cart[index].quantity = newQuantity
      }

      try {
        const app = getApp()
        app.globalData.cart = cart
        app.saveCart()

        const selectAll = cart.length > 0 && cart.every(item => item.selected)
        const selectedItems = cart.filter(item => item.selected)
        const totalAmount = selectedItems.reduce((total, item) => {
          return total + (item.product.price * item.quantity)
        }, 0)
        const totalCount = selectedItems.reduce((total, item) => {
          return total + item.quantity
        }, 0)
        const empty = cart.length === 0

        this.setData({
          cart,
          selectAll,
          totalAmount,
          totalCount,
          empty
        })
      } catch (error) {
        console.error('更新购物车失败:', error)
      }
    }
  },

  async onRemoveItem(e) {
    const productId = e.currentTarget.dataset.id
    
    const confirmed = await util.showModal('确认删除', '确定要删除该商品吗？')
    
    if (confirmed) {
      try {
        await api.removeFromCart(productId)
        this.loadCart()
        util.showToast('已删除', 'success')
      } catch (error) {
        console.error('删除商品失败:', error)
        util.showToast('删除失败')
      }
    }
  },

  onCheckout() {
    const selectedItems = this.data.cart.filter(item => item.selected)
    
    if (selectedItems.length === 0) {
      util.showToast('请选择商品')
      return
    }

    wx.navigateTo({
      url: '/pages/order/checkout'
    })
  },

  onGoShopping() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  onProductTap(e) {
    const productId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/product/detail?id=${productId}`
    })
  }
})
