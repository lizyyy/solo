const app = getApp();

Page({
  data: {
    orderId: null,
    order: null,
    statusSteps: [
      { key: 'pending', name: '等待接单', icon: '⏳', description: '订单已提交，等待商家确认' },
      { key: 'preparing', name: '准备中', icon: '👨‍🍳', description: '商家已接单，正在准备原料' },
      { key: 'making', name: '制作中', icon: '🍵', description: '正在精心制作您的饮品' },
      { key: 'ready', name: '可取餐', icon: '✅', description: '饮品已制作完成，请前往取餐' }
    ],
    currentStep: 0,
    countdown: 0,
    timer: null
  },

  onLoad(options) {
    if (options.orderId) {
      this.setData({
        orderId: options.orderId
      });
      this.loadOrderDetail();
    }
  },

  onUnload() {
    if (this.data.timer) {
      clearInterval(this.data.timer);
    }
  },

  loadOrderDetail() {
    const order = app.getOrderById(this.data.orderId);
    if (order) {
      this.setData({
        order,
        countdown: order.estimatedTime
      });
      this.updateCurrentStep();
      this.startStatusPolling();
      this.startCountdown();
    }
  },

  updateCurrentStep() {
    const { order, statusSteps } = this.data;
    if (!order) return;

    const statusIndex = statusSteps.findIndex(step => step.key === order.status);
    if (statusIndex !== -1) {
      this.setData({
        currentStep: statusIndex
      });
    }
  },

  startStatusPolling() {
    const timer = setInterval(() => {
      const order = app.getOrderById(this.data.orderId);
      if (order) {
        this.setData({
          order
        });
        this.updateCurrentStep();

        if (order.status === 'ready') {
          clearInterval(timer);
          wx.showToast({
            title: '饮品已做好啦！',
            icon: 'success',
            duration: 2000
          });
        }
      }
    }, 1000);

    this.setData({
      timer
    });
  },

  startCountdown() {
    const timer = setInterval(() => {
      if (this.data.countdown > 0) {
        this.setData({
          countdown: this.data.countdown - 1
        });
      } else {
        clearInterval(timer);
      }
    }, 1000);
  },

  getStatusText(status) {
    const statusMap = {
      'pending': '等待接单',
      'preparing': '准备中',
      'making': '制作中',
      'ready': '可取餐'
    };
    return statusMap[status] || '未知';
  },

  goToIndex() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  contactMerchant() {
    wx.makePhoneCall({
      phoneNumber: '13800138000',
      fail: () => {
        wx.showToast({
          title: '拨打电话失败',
          icon: 'none'
        });
      }
    });
  },

  refreshStatus() {
    const order = app.getOrderById(this.data.orderId);
    if (order) {
      this.setData({
        order
      });
      this.updateCurrentStep();
      wx.showToast({
        title: '已刷新',
        icon: 'success'
      });
    }
  },

  onShareAppMessage() {
    const { order } = this.data;
    return {
      title: order ? `我的订单 ${order.id}` : '自助饮料机',
      path: '/pages/index/index'
    };
  }
});
