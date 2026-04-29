const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

Page({
  data: {
    deliveryMode: 'takeout',
    currentDeliveryMode: null,
    deliveryModes: [],
    categories: [],
    currentCategory: 1,
    hotProducts: [],
    newProducts: [],
    products: [],
    searchKeyword: '',
    showDeliveryModal: false,
    cartCount: 0,
    loading: true
  },

  onLoad() {
    this.initPage()
  },

  onShow() {
    this.loadCartCount()
  },

  onPullDownRefresh() {
    this.initPage().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  async initPage() {
    this.setData({ loading: true })
    
    try {
      const [
        deliveryRes,
        categoryRes,
        hotRes,
        newRes,
        productRes
      ] = await Promise.all([
        api.getDeliveryModes(),
        api.getCategories(),
        api.getHotProducts(6),
        api.getNewProducts(6),
        api.getProducts(1)
      ])

      const app = getApp()
      const currentMode = app.globalData.deliveryMode || 'takeout'
      const deliveryModes = deliveryRes.data
      const currentDeliveryMode = deliveryModes.find(m => m.id === currentMode) || deliveryModes[0]

      this.setData({
        deliveryModes,
        categories: categoryRes.data,
        hotProducts: hotRes.data,
        newProducts: newRes.data,
        products: productRes.data,
        deliveryMode: currentMode,
        currentDeliveryMode,
        loading: false
      })
    } catch (error) {
      console.error('初始化首页失败:', error)
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

  onSearchInput(e) {
    const keyword = e.detail.value
    this.setData({ searchKeyword: keyword })
    this.searchProducts(keyword)
  },

  async searchProducts(keyword) {
    try {
      const res = await api.searchProducts(keyword)
      this.setData({
        products: res.data
      })
    } catch (error) {
      console.error('搜索失败:', error)
    }
  },

  onCategoryTap(e) {
    const categoryId = e.currentTarget.dataset.id
    this.setData({ currentCategory: categoryId })
    this.loadProducts(categoryId)
  },

  async loadProducts(categoryId) {
    try {
      const res = await api.getProducts(categoryId)
      this.setData({
        products: res.data
      })
    } catch (error) {
      console.error('加载商品失败:', error)
    }
  },

  onDeliveryModeTap() {
    this.setData({ showDeliveryModal: true })
  },

  onSelectDeliveryMode(e) {
    const mode = e.currentTarget.dataset.mode
    const app = getApp()
    app.globalData.deliveryMode = mode
    app.saveDeliveryMode()
    
    const currentDeliveryMode = this.data.deliveryModes.find(m => m.id === mode)
    
    this.setData({
      deliveryMode: mode,
      currentDeliveryMode,
      showDeliveryModal: false
    })
    
    util.showToast('已切换配送方式')
  },

  onCloseDeliveryModal() {
    this.setData({ showDeliveryModal: false })
  },

  onProductTap(e) {
    const productId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/product/detail?id=${productId}`
    })
  },

  async onAddToCart(e) {
    const productId = e.currentTarget.dataset.id
    const product = this.data.products.find(p => p.id === productId)
    
    if (!product) return
    
    if (product.stock <= 0) {
      util.showToast('该商品已售罄')
      return
    }

    try {
      await api.addToCart(product, 1)
      this.loadCartCount()
      util.showToast('已加入购物车', 'success')
    } catch (error) {
      console.error('加入购物车失败:', error)
      util.showToast('加入购物车失败')
    }
  },

  onCartTap() {
    wx.switchTab({
      url: '/pages/cart/cart'
    })
  },

  onCouponTap() {
    wx.navigateTo({
      url: '/pages/profile/coupons'
    })
  },

  onMemberTap() {
    wx.navigateTo({
      url: '/pages/profile/member'
    })
  }
})
