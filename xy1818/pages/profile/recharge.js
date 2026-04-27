const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

Page({
  data: {
    memberInfo: null,
    rechargeOptions: [],
    selectedOption: null,
    customAmount: '',
    payMethods: [
      { id: 'wechat', name: '微信支付', icon: '💳', selected: true },
      { id: 'balance', name: '余额支付', icon: '💰', selected: false }
    ],
    loading: true,
    submitting: false
  },

  onLoad() {
    this.initPage()
  },

  async initPage() {
    this.setData({ loading: true })
    
    try {
      const [memberRes, optionsRes] = await Promise.all([
        api.getMemberInfo(),
        api.getRechargeOptions()
      ])

      const options = optionsRes.data || []
      const selectedOption = options.length > 0 ? options[0] : null

      this.setData({
        memberInfo: memberRes.data,
        rechargeOptions: options,
        selectedOption,
        loading: false
      })
    } catch (error) {
      console.error('加载充值页面失败:', error)
      util.showToast('加载失败，请重试')
      this.setData({ loading: false })
    }
  },

  onSelectOption(e) {
    const index = e.currentTarget.dataset.index
    const option = this.data.rechargeOptions[index]
    
    this.setData({
      selectedOption: option,
      customAmount: ''
    })
  },

  onCustomAmountInput(e) {
    const value = e.detail.value
    this.setData({
      customAmount: value,
      selectedOption: null
    })
  },

  onSelectPayMethod(e) {
    const id = e.currentTarget.dataset.id
    const payMethods = this.data.payMethods.map(m => ({
      ...m,
      selected: m.id === id
    }))
    
    this.setData({ payMethods })
  },

  getRechargeAmount() {
    const { selectedOption, customAmount } = this.data
    
    if (selectedOption) {
      return {
        amount: selectedOption.amount,
        bonus: selectedOption.bonus
      }
    }
    
    if (customAmount) {
      const amount = parseFloat(customAmount)
      if (amount > 0) {
        return {
          amount: amount,
          bonus: 0
        }
      }
    }
    
    return null
  },

  async onRecharge() {
    const rechargeInfo = this.getRechargeAmount()
    
    if (!rechargeInfo) {
      util.showToast('请选择或输入充值金额')
      return
    }
    
    if (rechargeInfo.amount < 10) {
      util.showToast('最低充值10元')
      return
    }

    try {
      this.setData({ submitting: true })
      util.showLoading('充值中...')
      
      const res = await api.recharge(rechargeInfo.amount, rechargeInfo.bonus)
      
      util.hideLoading()
      
      if (res.code === 0) {
        util.showToast('充值成功', 'success')
        
        this.setData({
          memberInfo: res.data,
          submitting: false
        })
        
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        util.showToast(res.message || '充值失败')
        this.setData({ submitting: false })
      }
    } catch (error) {
      util.hideLoading()
      console.error('充值失败:', error)
      util.showToast('充值失败')
      this.setData({ submitting: false })
    }
  },

  onRuleTap() {
    util.showModal('充值规则', 
      '1. 充值金额即时到账\n2. 赠送金额与充值金额同等使用\n3. 充值金额不可提现\n4. 如有疑问请联系客服', 
      false)
  }
})
