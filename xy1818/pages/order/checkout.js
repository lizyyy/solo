const api = require('../../utils/api.js')
const util = require('../../utils/util.js')
const data = require('../../utils/data.js')

Page({
  data: {
    cart: [],
    totalAmount: 0,
    deliveryMode: 'takeout',
    deliveryModes: [],
    deliveryFee: 0,
    address: null,
    coupons: [],
    selectedCoupon: null,
    discountAmount: 0,
    packFee: 2,
    payAmount: 0,
    remark: '',
    loading: true
  },

  onLoad() {
    this.initPage()
  },

  async initPage() {
    this.setData({ loading: true })
    
    try {
      const app = getApp()
      const [cartRes, totalRes, deliveryRes, couponsRes, addressRes] = await Promise.all([
        api.getCart(),
        api.getCartTotal(),
        api.getDeliveryModes(),
        api.getCoupons(),
        api.getAddress()
      ])

      const cart = cartRes.data.filter(item => item.selected)
      const totalAmount = totalRes.data.total
      const deliveryMode = app.globalData.deliveryMode || 'takeout'
      const deliveryFee = this.calculateDeliveryFee(totalAmount, deliveryMode, deliveryRes.data)
      const availableCoupons = couponsRes.data.filter(c => {
        if (c.used) return false
        const isCouponValid = data.isCouponValid(c, totalAmount)
        return isCouponValid
      })

      this.setData({
        cart,
        totalAmount,
        deliveryMode,
        deliveryModes: deliveryRes.data,
        deliveryFee,
        address: addressRes.data,
        coupons: availableCoupons,
        loading: false
      })

      this.calculatePayAmount()
    } catch (error) {
      console.error('初始化结算页失败:', error)
      util.showToast('加载失败，请重试')
      this.setData({ loading: false })
    }
  },

  calculateDeliveryFee(totalAmount, deliveryMode, deliveryModes) {
    const mode = deliveryModes.find(m => m.id === deliveryMode)
    if (!mode) return 0
    
    if (mode.freeThreshold && totalAmount >= mode.freeThreshold) {
      return 0
    }
    return mode.fee || 0
  },

  calculatePayAmount() {
    const { totalAmount, deliveryFee, packFee, discountAmount } = this.data
    const payAmount = Math.max(0, totalAmount + deliveryFee + packFee - discountAmount)
    
    this.setData({ payAmount })
  },

  onDeliveryModeChange(e) {
    const deliveryMode = e.detail.value
    const { totalAmount, deliveryModes } = this.data
    const deliveryFee = this.calculateDeliveryFee(totalAmount, deliveryMode, deliveryModes)
    
    const app = getApp()
    app.globalData.deliveryMode = deliveryMode
    app.saveDeliveryMode()
    
    this.setData({ deliveryMode, deliveryFee })
    this.calculatePayAmount()
  },

  onCouponChange(e) {
    const index = e.detail.value
    const { coupons, totalAmount } = this.data
    
    if (index === '-1') {
      this.setData({
        selectedCoupon: null,
        discountAmount: 0
      })
    } else {
      const coupon = coupons[parseInt(index)]
      const discountAmount = data.calculateDiscount(coupon, totalAmount)
      
      this.setData({
        selectedCoupon: coupon,
        discountAmount
      })
    }
    
    this.calculatePayAmount()
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value })
  },

  async onChooseAddress() {
    try {
      const res = await wx.chooseAddress()
      const address = {
        name: res.userName,
        phone: res.telNumber,
        province: res.provinceName,
        city: res.cityName,
        district: res.countyName,
        detail: res.detailInfo,
        fullAddress: `${res.provinceName}${res.cityName}${res.countyName}${res.detailInfo}`
      }
      
      this.setData({ address })
      await api.saveAddress(address)
    } catch (error) {
      console.log('取消选择地址')
    }
  },

  async onSubmitOrder() {
    const { 
      cart, 
      totalAmount, 
      deliveryMode, 
      address, 
      selectedCoupon, 
      discountAmount, 
      deliveryFee, 
      packFee, 
      payAmount,
      remark
    } = this.data

    if (cart.length === 0) {
      util.showToast('购物车为空')
      return
    }

    if (deliveryMode === 'takeout' && !address) {
      util.showToast('请选择收货地址')
      return
    }

    if (payAmount <= 0) {
      util.showToast('支付金额无效')
      return
    }

    try {
      util.showLoading('提交订单中...')
      
      const orderData = {
        items: cart,
        totalAmount,
        discountAmount,
        deliveryFee,
        packFee,
        payAmount,
        deliveryMode,
        address: deliveryMode === 'takeout' ? address : null,
        couponId: selectedCoupon ? selectedCoupon.id : null,
        remark
      }

      const res = await api.submitOrder(orderData)
      
      util.hideLoading()
      
      if (res.code === 0) {
        const order = res.data
        
        if (selectedCoupon) {
          await api.useCoupon(selectedCoupon.id)
        }

        wx.redirectTo({
          url: `/pages/order/detail?id=${order.id}`
        })
      } else {
        util.showToast(res.message || '提交失败')
      }
    } catch (error) {
      util.hideLoading()
      console.error('提交订单失败:', error)
      util.showToast('提交失败，请重试')
    }
  }
})
