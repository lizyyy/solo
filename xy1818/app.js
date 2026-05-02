App({
  globalData: {
    userInfo: null,
    cart: [],
    orders: [],
    coupons: [],
    memberInfo: null,
    deliveryMode: 'takeout',
    address: null
  },

  onLaunch() {
    this.initApp()
    this.loadLocalData()
  },

  initApp() {
    console.log('甜蜜烘焙小程序启动')
  },

  loadLocalData() {
    try {
      const cart = wx.getStorageSync('cart')
      const orders = wx.getStorageSync('orders')
      const coupons = wx.getStorageSync('coupons')
      const memberInfo = wx.getStorageSync('memberInfo')
      const userInfo = wx.getStorageSync('userInfo')
      const deliveryMode = wx.getStorageSync('deliveryMode')
      const address = wx.getStorageSync('address')

      if (cart) this.globalData.cart = cart
      if (orders) this.globalData.orders = orders
      if (coupons) this.globalData.coupons = coupons
      if (memberInfo) this.globalData.memberInfo = memberInfo
      if (userInfo) this.globalData.userInfo = userInfo
      if (deliveryMode) this.globalData.deliveryMode = deliveryMode
      if (address) this.globalData.address = address
    } catch (e) {
      console.error('加载本地数据失败:', e)
    }
  },

  saveCart() {
    try {
      wx.setStorageSync('cart', this.globalData.cart)
    } catch (e) {
      console.error('保存购物车失败:', e)
    }
  },

  saveOrders() {
    try {
      wx.setStorageSync('orders', this.globalData.orders)
    } catch (e) {
      console.error('保存订单失败:', e)
    }
  },

  saveCoupons() {
    try {
      wx.setStorageSync('coupons', this.globalData.coupons)
    } catch (e) {
      console.error('保存优惠券失败:', e)
    }
  },

  saveMemberInfo() {
    try {
      wx.setStorageSync('memberInfo', this.globalData.memberInfo)
    } catch (e) {
      console.error('保存会员信息失败:', e)
    }
  },

  saveUserInfo() {
    try {
      wx.setStorageSync('userInfo', this.globalData.userInfo)
    } catch (e) {
      console.error('保存用户信息失败:', e)
    }
  },

  saveDeliveryMode() {
    try {
      wx.setStorageSync('deliveryMode', this.globalData.deliveryMode)
    } catch (e) {
      console.error('保存配送方式失败:', e)
    }
  },

  saveAddress() {
    try {
      wx.setStorageSync('address', this.globalData.address)
    } catch (e) {
      console.error('保存地址失败:', e)
    }
  },

  addToCart(product, quantity = 1) {
    const cart = this.globalData.cart
    const existIndex = cart.findIndex(item => item.productId === product.id)
    
    if (existIndex > -1) {
      cart[existIndex].quantity += quantity
    } else {
      cart.push({
        productId: product.id,
        product: product,
        quantity: quantity,
        selected: true
      })
    }
    
    this.saveCart()
    return cart
  },

  updateCartItem(productId, quantity) {
    const cart = this.globalData.cart
    const index = cart.findIndex(item => item.productId === productId)
    
    if (index > -1) {
      if (quantity <= 0) {
        cart.splice(index, 1)
      } else {
        cart[index].quantity = quantity
      }
      this.saveCart()
    }
    return cart
  },

  removeFromCart(productId) {
    const cart = this.globalData.cart
    const index = cart.findIndex(item => item.productId === productId)
    
    if (index > -1) {
      cart.splice(index, 1)
      this.saveCart()
    }
    return cart
  },

  clearCart() {
    this.globalData.cart = []
    this.saveCart()
  },

  getCartTotal() {
    const cart = this.globalData.cart.filter(item => item.selected)
    return cart.reduce((total, item) => {
      return total + (item.product.price * item.quantity)
    }, 0)
  },

  getCartCount() {
    return this.globalData.cart.reduce((total, item) => {
      return total + item.quantity
    }, 0)
  },

  createOrder(orderData) {
    const order = {
      id: 'ORD' + Date.now(),
      orderNo: 'BH' + Date.now() + Math.floor(Math.random() * 10000),
      items: orderData.items,
      totalAmount: orderData.totalAmount,
      discountAmount: orderData.discountAmount || 0,
      deliveryFee: orderData.deliveryFee || 0,
      packFee: orderData.packFee || 0,
      payAmount: orderData.payAmount,
      deliveryMode: orderData.deliveryMode,
      address: orderData.address,
      couponId: orderData.couponId,
      status: 'pending',
      statusText: '待支付',
      createTime: new Date().toISOString(),
      payTime: null,
      deliveryTime: null,
      completeTime: null,
      remark: orderData.remark || ''
    }
    
    this.globalData.orders.unshift(order)
    this.saveOrders()
    return order
  },

  payOrder(orderId) {
    const orders = this.globalData.orders
    const index = orders.findIndex(item => item.id === orderId)
    
    if (index > -1) {
      orders[index].status = 'paid'
      orders[index].statusText = '已支付'
      orders[index].payTime = new Date().toISOString()
      this.saveOrders()
      return orders[index]
    }
    return null
  },

  cancelOrder(orderId) {
    const orders = this.globalData.orders
    const index = orders.findIndex(item => item.id === orderId)
    
    if (index > -1) {
      orders[index].status = 'cancelled'
      orders[index].statusText = '已取消'
      this.saveOrders()
      return orders[index]
    }
    return null
  },

  confirmOrder(orderId) {
    const orders = this.globalData.orders
    const index = orders.findIndex(item => item.id === orderId)
    
    if (index > -1) {
      orders[index].status = 'completed'
      orders[index].statusText = '已完成'
      orders[index].completeTime = new Date().toISOString()
      this.saveOrders()
      return orders[index]
    }
    return null
  },

  claimCoupon(coupon) {
    const coupons = this.globalData.coupons
    const exist = coupons.find(item => item.id === coupon.id)
    
    if (!exist) {
      coupons.push({
        ...coupon,
        claimed: true,
        claimedTime: new Date().toISOString(),
        used: false
      })
      this.saveCoupons()
      return true
    }
    return false
  },

  useCoupon(couponId) {
    const coupons = this.globalData.coupons
    const index = coupons.findIndex(item => item.id === couponId)
    
    if (index > -1 && !coupons[index].used) {
      coupons[index].used = true
      coupons[index].usedTime = new Date().toISOString()
      this.saveCoupons()
      return true
    }
    return false
  },

  recharge(amount, bonus = 0) {
    let memberInfo = this.globalData.memberInfo
    
    if (!memberInfo) {
      memberInfo = {
        balance: 0,
        totalRecharge: 0,
        level: 1,
        levelName: '普通会员',
        points: 0,
        createTime: new Date().toISOString()
      }
    }
    
    memberInfo.balance += amount + bonus
    memberInfo.totalRecharge += amount
    memberInfo.points += Math.floor(amount / 10)
    
    if (memberInfo.totalRecharge >= 1000) {
      memberInfo.level = 3
      memberInfo.levelName = '钻石会员'
    } else if (memberInfo.totalRecharge >= 500) {
      memberInfo.level = 2
      memberInfo.levelName = '黄金会员'
    }
    
    this.globalData.memberInfo = memberInfo
    this.saveMemberInfo()
    return memberInfo
  }
})
