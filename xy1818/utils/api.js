const data = require('./data.js')
const util = require('./util.js')

const api = {
  getCategories() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          code: 0,
          data: data.categories,
          message: 'success'
        })
      }, 300)
    })
  },

  getProducts(categoryId = 1) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const products = data.getProductsByCategory(categoryId)
        resolve({
          code: 0,
          data: products,
          message: 'success'
        })
      }, 300)
    })
  },

  getProductDetail(productId) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const product = data.getProductById(productId)
        if (product) {
          resolve({
            code: 0,
            data: product,
            message: 'success'
          })
        } else {
          resolve({
            code: -1,
            data: null,
            message: '商品不存在'
          })
        }
      }, 300)
    })
  },

  searchProducts(keyword) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const products = data.searchProducts(keyword)
        resolve({
          code: 0,
          data: products,
          message: 'success'
        })
      }, 300)
    })
  },

  getHotProducts(limit = 6) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const products = data.getHotProducts(limit)
        resolve({
          code: 0,
          data: products,
          message: 'success'
        })
      }, 300)
    })
  },

  getNewProducts(limit = 6) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const products = data.getNewProducts(limit)
        resolve({
          code: 0,
          data: products,
          message: 'success'
        })
      }, 300)
    })
  },

  getAvailableCoupons() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          code: 0,
          data: data.availableCoupons,
          message: 'success'
        })
      }, 300)
    })
  },

  getRechargeOptions() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          code: 0,
          data: data.rechargeOptions,
          message: 'success'
        })
      }, 300)
    })
  },

  getDeliveryModes() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          code: 0,
          data: data.deliveryModes,
          message: 'success'
        })
      }, 100)
    })
  },

  submitOrder(orderData) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const app = getApp()
        const order = app.createOrder(orderData)
        
        resolve({
          code: 0,
          data: order,
          message: '订单创建成功'
        })
      }, 500)
    })
  },

  payOrder(orderId, payMethod = 'wechat') {
    return new Promise((resolve) => {
      setTimeout(() => {
        const app = getApp()
        const order = app.payOrder(orderId)
        
        if (order) {
          app.clearCart()
          resolve({
            code: 0,
            data: order,
            message: '支付成功'
          })
        } else {
          resolve({
            code: -1,
            data: null,
            message: '订单不存在'
          })
        }
      }, 1000)
    })
  },

  cancelOrder(orderId, reason = '') {
    return new Promise((resolve) => {
      setTimeout(() => {
        const app = getApp()
        const order = app.cancelOrder(orderId)
        
        if (order) {
          resolve({
            code: 0,
            data: order,
            message: '订单已取消'
          })
        } else {
          resolve({
            code: -1,
            data: null,
            message: '订单不存在'
          })
        }
      }, 300)
    })
  },

  confirmOrder(orderId) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const app = getApp()
        const order = app.confirmOrder(orderId)
        
        if (order) {
          resolve({
            code: 0,
            data: order,
            message: '订单已确认'
          })
        } else {
          resolve({
            code: -1,
            data: null,
            message: '订单不存在'
          })
        }
      }, 300)
    })
  },

  claimCoupon(coupon) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const app = getApp()
        const success = app.claimCoupon(coupon)
        
        if (success) {
          resolve({
            code: 0,
            data: null,
            message: '领取成功'
          })
        } else {
          resolve({
            code: -1,
            data: null,
            message: '已领取过该优惠券'
          })
        }
      }, 300)
    })
  },

  recharge(amount, bonus = 0) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const app = getApp()
        const memberInfo = app.recharge(amount, bonus)
        
        resolve({
          code: 0,
          data: memberInfo,
          message: '充值成功'
        })
      }, 1000)
    })
  },

  getAddress() {
    return new Promise((resolve) => {
      setTimeout(() => {
        const app = getApp()
        resolve({
          code: 0,
          data: app.globalData.address,
          message: 'success'
        })
      }, 100)
    })
  },

  saveAddress(address) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const app = getApp()
        app.globalData.address = address
        app.saveAddress()
        
        resolve({
          code: 0,
          data: address,
          message: '地址保存成功'
        })
      }, 300)
    })
  },

  getUserInfo() {
    return new Promise((resolve) => {
      setTimeout(() => {
        const app = getApp()
        resolve({
          code: 0,
          data: app.globalData.userInfo,
          message: 'success'
        })
      }, 100)
    })
  },

  saveUserInfo(userInfo) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const app = getApp()
        app.globalData.userInfo = userInfo
        app.saveUserInfo()
        
        resolve({
          code: 0,
          data: userInfo,
          message: '保存成功'
        })
      }, 300)
    })
  },

  getMemberInfo() {
    return new Promise((resolve) => {
      setTimeout(() => {
        const app = getApp()
        resolve({
          code: 0,
          data: app.globalData.memberInfo,
          message: 'success'
        })
      }, 100)
    })
  },

  getCoupons() {
    return new Promise((resolve) => {
      setTimeout(() => {
        const app = getApp()
        resolve({
          code: 0,
          data: app.globalData.coupons,
          message: 'success'
        })
      }, 100)
    })
  },

  getOrders(status = null) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const app = getApp()
        let orders = app.globalData.orders
        
        if (status) {
          orders = orders.filter(o => o.status === status)
        }
        
        resolve({
          code: 0,
          data: orders,
          message: 'success'
        })
      }, 300)
    })
  },

  getOrderById(orderId) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const app = getApp()
        const order = app.globalData.orders.find(o => o.id === orderId)
        
        resolve({
          code: order ? 0 : -1,
          data: order,
          message: order ? 'success' : '订单不存在'
        })
      }, 100)
    })
  },

  getCart() {
    return new Promise((resolve) => {
      setTimeout(() => {
        const app = getApp()
        resolve({
          code: 0,
          data: app.globalData.cart,
          message: 'success'
        })
      }, 100)
    })
  },

  addToCart(product, quantity = 1) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const app = getApp()
        const cart = app.addToCart(product, quantity)
        
        resolve({
          code: 0,
          data: cart,
          message: '已加入购物车'
        })
      }, 100)
    })
  },

  updateCartItem(productId, quantity) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const app = getApp()
        const cart = app.updateCartItem(productId, quantity)
        
        resolve({
          code: 0,
          data: cart,
          message: 'success'
        })
      }, 100)
    })
  },

  removeFromCart(productId) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const app = getApp()
        const cart = app.removeFromCart(productId)
        
        resolve({
          code: 0,
          data: cart,
          message: 'success'
        })
      }, 100)
    })
  },

  clearCart() {
    return new Promise((resolve) => {
      setTimeout(() => {
        const app = getApp()
        app.clearCart()
        
        resolve({
          code: 0,
          data: null,
          message: 'success'
        })
      }, 100)
    })
  },

  getCartTotal() {
    return new Promise((resolve) => {
      setTimeout(() => {
        const app = getApp()
        const total = app.getCartTotal()
        const count = app.getCartCount()
        
        resolve({
          code: 0,
          data: {
            total,
            count
          },
          message: 'success'
        })
      }, 100)
    })
  },

  calculateDiscount(coupon, totalAmount) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const discount = data.calculateDiscount(coupon, totalAmount)
        
        resolve({
          code: 0,
          data: discount,
          message: 'success'
        })
      }, 50)
    })
  }
}

module.exports = api
