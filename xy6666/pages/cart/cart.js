const app = getApp();

Page({
  data: {
    cart: [],
    totalPrice: 0,
    customerName: '',
    phone: '',
    remark: '',
    showOrderConfirm: false
  },

  onLoad() {
    this.loadCartData();
  },

  onShow() {
    this.loadCartData();
  },

  loadCartData() {
    const cart = app.globalData.cart;
    const totalPrice = app.getCartTotal();
    
    this.setData({
      cart,
      totalPrice
    });
  },

  decreaseQuantity(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.cart[index];
    
    if (item.quantity > 1) {
      app.updateCartItemQuantity(index, item.quantity - 1);
      this.loadCartData();
    }
  },

  increaseQuantity(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.cart[index];
    const drink = app.getDrinkById(item.drinkId);
    
    if (item.quantity < drink.stock) {
      app.updateCartItemQuantity(index, item.quantity + 1);
      this.loadCartData();
    } else {
      wx.showToast({
        title: '库存不足',
        icon: 'none'
      });
    }
  },

  removeItem(e) {
    const index = e.currentTarget.dataset.index;
    
    wx.showModal({
      title: '提示',
      content: '确定要删除这个商品吗？',
      success: (res) => {
        if (res.confirm) {
          app.removeFromCart(index);
          this.loadCartData();
          wx.showToast({
            title: '已删除',
            icon: 'success'
          });
        }
      }
    });
  },

  inputName(e) {
    this.setData({
      customerName: e.detail.value
    });
  },

  inputPhone(e) {
    this.setData({
      phone: e.detail.value
    });
  },

  inputRemark(e) {
    this.setData({
      remark: e.detail.value
    });
  },

  showConfirmModal() {
    if (this.data.cart.length === 0) {
      wx.showToast({
        title: '购物车为空',
        icon: 'none'
      });
      return;
    }

    this.setData({
      showOrderConfirm: true
    });
  },

  hideConfirmModal() {
    this.setData({
      showOrderConfirm: false
    });
  },

  confirmOrder() {
    const { customerName, phone, remark } = this.data;

    if (!customerName.trim()) {
      wx.showToast({
        title: '请输入姓名',
        icon: 'none'
      });
      return;
    }

    if (!phone.trim()) {
      wx.showToast({
        title: '请输入手机号',
        icon: 'none'
      });
      return;
    }

    if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
      wx.showToast({
        title: '手机号格式不正确',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '提交中...'
    });

    setTimeout(() => {
      const order = app.createOrder({
        customerName: customerName.trim(),
        phone: phone.trim(),
        remark: remark.trim()
      });

      wx.hideLoading();
      this.hideConfirmModal();

      wx.showToast({
        title: '下单成功',
        icon: 'success',
        duration: 2000,
        success: () => {
          setTimeout(() => {
            wx.redirectTo({
              url: `/pages/order-status/order-status?orderId=${order.id}`
            });
          }, 1500);
        }
      });
    }, 1000);
  },

  clearCart() {
    if (this.data.cart.length === 0) {
      return;
    }

    wx.showModal({
      title: '提示',
      content: '确定要清空购物车吗？',
      success: (res) => {
        if (res.confirm) {
          app.clearCart();
          this.loadCartData();
          wx.showToast({
            title: '已清空',
            icon: 'success'
          });
        }
      }
    });
  },

  goToIndex() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  onShareAppMessage() {
    return {
      title: '自助饮料机，新鲜饮品随时享',
      path: '/pages/index/index'
    };
  }
});
