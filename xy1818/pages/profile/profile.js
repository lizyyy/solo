const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

Page({
  data: {
    userInfo: null,
    memberInfo: null,
    coupons: [],
    orderStats: {
      pending: 0,
      paid: 0,
      completed: 0
    },
    menuItems: [
      { id: 'coupons', icon: '🎫', name: '我的优惠券', desc: '查看可用优惠券', path: '/pages/profile/coupons' },
      { id: 'member', icon: '👑', name: '会员中心', desc: '查看会员权益', path: '/pages/profile/member' },
      { id: 'recharge', icon: '💰', name: '立即充值', desc: '充值享优惠', path: '/pages/profile/recharge' },
      { id: 'orders', icon: '📋', name: '全部订单', desc: '查看所有订单', path: '/pages/order/order' },
      { id: 'address', icon: '📍', name: '收货地址', desc: '管理收货地址', path: '' },
      { id: 'service', icon: '💬', name: '客服中心', desc: '联系客服', path: '' },
      { id: 'settings', icon: '⚙️', name: '设置', desc: '账户设置', path: '' }
    ],
    loading: true
  },

  onLoad() {
    this.initPage()
  },

  onShow() {
    this.loadUserData()
  },

  async initPage() {
    this.setData({ loading: true })
    await this.loadUserData()
    this.setData({ loading: false })
  },

  async loadUserData() {
    try {
      const [userRes, memberRes, couponsRes, ordersRes] = await Promise.all([
        api.getUserInfo(),
        api.getMemberInfo(),
        api.getCoupons(),
        api.getOrders()
      ])

      const orders = ordersRes.data
      const orderStats = {
        pending: orders.filter(o => o.status === 'pending').length,
        paid: orders.filter(o => o.status === 'paid').length,
        completed: orders.filter(o => o.status === 'completed').length
      }

      const availableCoupons = couponsRes.data ? couponsRes.data.filter(c => !c.used) : []

      this.setData({
        userInfo: userRes.data,
        memberInfo: memberRes.data,
        coupons: availableCoupons,
        orderStats
      })
    } catch (error) {
      console.error('加载用户数据失败:', error)
    }
  },

  onGetUserInfo(e) {
    if (e.detail.userInfo) {
      const userInfo = e.detail.userInfo
      api.saveUserInfo(userInfo)
      this.setData({ userInfo })
      util.showToast('登录成功', 'success')
    }
  },

  onMenuTap(e) {
    const { id, path } = e.currentTarget.dataset
    if (path) {
      wx.navigateTo({ url: path })
    } else {
      this.handleMenuAction(id)
    }
  },

  handleMenuAction(id) {
    switch (id) {
      case 'address':
        this.chooseAddress()
        break
      case 'service':
        util.showToast('客服功能开发中')
        break
      case 'settings':
        util.showToast('设置功能开发中')
        break
    }
  },

  async chooseAddress() {
    try {
      const res = await new Promise((resolve, reject) => {
        wx.chooseAddress({
          success: resolve,
          fail: reject
        })
      })
      
      const address = {
        name: res.userName,
        phone: res.telNumber,
        province: res.provinceName,
        city: res.cityName,
        district: res.countyName,
        detail: res.detailInfo,
        fullAddress: `${res.provinceName}${res.cityName}${res.countyName}${res.detailInfo}`
      }
      
      await api.saveAddress(address)
      util.showToast('地址保存成功', 'success')
    } catch (error) {
      console.error('选择地址失败:', error)
      if (error.errMsg && error.errMsg.includes('cancel')) {
        return
      }
      util.showToast('获取地址失败')
    }
  },

  onOrderTap(e) {
    const { status } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/order/order?status=${status}`
    })
  },

  onCouponsTap() {
    wx.navigateTo({
      url: '/pages/profile/coupons'
    })
  },

  onMemberTap() {
    wx.navigateTo({
      url: '/pages/profile/member'
    })
  },

  onRechargeTap() {
    wx.navigateTo({
      url: '/pages/profile/recharge'
    })
  }
})
