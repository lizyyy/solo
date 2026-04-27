const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

Page({
  data: {
    tabs: [
      { id: 'available', name: '可领取' },
      { id: 'my', name: '我的优惠券' }
    ],
    activeTab: 0,
    availableCoupons: [],
    myCoupons: [],
    loading: true
  },

  onLoad() {
    this.initPage()
  },

  async initPage() {
    this.setData({ loading: true })
    
    try {
      const [availableRes, myRes] = await Promise.all([
        api.getAvailableCoupons(),
        api.getCoupons()
      ])

      const availableCoupons = availableRes.data || []
      const myCoupons = myRes.data || []

      const claimedIds = myCoupons.map(c => c.id)
      const filteredAvailable = availableCoupons.filter(c => !claimedIds.includes(c.id))

      const myCouponsWithStatus = myCoupons.map(c => ({
        ...c,
        statusText: c.used ? '已使用' : '可使用',
        isValid: !c.used
      }))

      this.setData({
        availableCoupons: filteredAvailable,
        myCoupons: myCouponsWithStatus,
        loading: false
      })
    } catch (error) {
      console.error('加载优惠券失败:', error)
      util.showToast('加载失败，请重试')
      this.setData({ loading: false })
    }
  },

  onTabChange(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ activeTab: index })
  },

  formatCouponValue(coupon) {
    if (coupon.type === 'cash') {
      return `¥${coupon.amount}`
    } else if (coupon.type === 'discount') {
      return `${coupon.discount * 10}折`
    }
    return ''
  },

  formatCondition(coupon) {
    if (coupon.minAmount > 0) {
      return `满${coupon.minAmount}可用`
    }
    return '无门槛'
  },

  async onClaimCoupon(e) {
    const coupon = e.currentTarget.dataset.coupon
    
    try {
      util.showLoading('领取中...')
      
      const res = await api.claimCoupon(coupon)
      
      util.hideLoading()
      
      if (res.code === 0) {
        util.showToast('领取成功', 'success')
        
        const availableCoupons = this.data.availableCoupons.filter(c => c.id !== coupon.id)
        const claimedCoupon = {
          ...coupon,
          claimed: true,
          claimedTime: new Date().toISOString(),
          used: false,
          statusText: '可使用',
          isValid: true
        }
        const myCoupons = [...this.data.myCoupons, claimedCoupon]
        
        this.setData({
          availableCoupons,
          myCoupons
        })
      } else {
        util.showToast(res.message || '领取失败')
      }
    } catch (error) {
      util.hideLoading()
      console.error('领取优惠券失败:', error)
      util.showToast('领取失败')
    }
  },

  onCouponDetail(e) {
    const coupon = e.currentTarget.dataset.coupon
    const type = e.currentTarget.dataset.type
    
    let content = coupon.description
    if (coupon.validDays) {
      content += `\n有效期：领取后${coupon.validDays}天内有效`
    }
    if (coupon.categoryId) {
      content += '\n适用范围：蛋糕类商品'
    }
    
    util.showModal('优惠券详情', content, false)
  },

  onUseCoupon(e) {
    const coupon = e.currentTarget.dataset.coupon
    
    if (coupon.used) {
      util.showToast('该优惠券已使用')
      return
    }
    
    wx.switchTab({
      url: '/pages/index/index'
    })
  }
})
