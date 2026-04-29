const app = getApp();

Page({
  data: {
    drinkId: null,
    drink: null,
    selectedSugar: '',
    selectedIce: '',
    selectedSize: '',
    selectedToppings: [],
    quantity: 1,
    totalPrice: 0,
    showSuccessToast: false
  },

  onLoad(options) {
    if (options.id) {
      this.setData({
        drinkId: parseInt(options.id)
      });
      this.loadDrinkDetail();
    }
  },

  loadDrinkDetail() {
    const drink = app.getDrinkById(this.data.drinkId);
    if (drink) {
      this.setData({
        drink,
        selectedSugar: drink.options.sugar[0],
        selectedIce: drink.options.ice[0],
        selectedSize: drink.options.size[0],
        selectedToppings: []
      });
      this.calculateTotalPrice();
    }
  },

  selectSugar(e) {
    const sugar = e.currentTarget.dataset.sugar;
    this.setData({
      selectedSugar: sugar
    });
  },

  selectIce(e) {
    const ice = e.currentTarget.dataset.ice;
    this.setData({
      selectedIce: ice
    });
  },

  selectSize(e) {
    const size = e.currentTarget.dataset.size;
    this.setData({
      selectedSize: size
    });
  },

  toggleTopping(e) {
    const topping = e.currentTarget.dataset.topping;
    const selectedToppings = [...this.data.selectedToppings];
    const index = selectedToppings.findIndex(t => t.name === topping.name);
    
    if (index > -1) {
      selectedToppings.splice(index, 1);
    } else {
      selectedToppings.push(topping);
    }
    
    this.setData({
      selectedToppings
    });
    this.calculateTotalPrice();
  },

  decreaseQuantity() {
    if (this.data.quantity > 1) {
      this.setData({
        quantity: this.data.quantity - 1
      });
      this.calculateTotalPrice();
    }
  },

  increaseQuantity() {
    if (this.data.quantity < this.data.drink.stock) {
      this.setData({
        quantity: this.data.quantity + 1
      });
      this.calculateTotalPrice();
    } else {
      wx.showToast({
        title: '库存不足',
        icon: 'none'
      });
    }
  },

  calculateTotalPrice() {
    const { drink, selectedToppings, quantity } = this.data;
    if (!drink) return;
    
    const toppingsPrice = selectedToppings.reduce((sum, t) => sum + t.price, 0);
    const totalPrice = (drink.price + toppingsPrice) * quantity;
    
    this.setData({
      totalPrice
    });
  },

  addToCart() {
    const { drink, selectedSugar, selectedIce, selectedSize, selectedToppings, quantity } = this.data;
    
    if (!selectedSugar || !selectedIce || !selectedSize) {
      wx.showToast({
        title: '请选择完整规格',
        icon: 'none'
      });
      return;
    }

    const cartItem = {
      drinkId: drink.id,
      drinkName: drink.name,
      drinkImage: drink.image,
      price: drink.price,
      sugar: selectedSugar,
      ice: selectedIce,
      size: selectedSize,
      selectedToppings: [...selectedToppings],
      quantity: quantity
    };

    app.addToCart(cartItem);

    this.setData({
      showSuccessToast: true
    });

    setTimeout(() => {
      this.setData({
        showSuccessToast: false
      });
    }, 1500);

    wx.showToast({
      title: '已加入购物车',
      icon: 'success'
    });
  },

  goToCart() {
    wx.switchTab({
      url: '/pages/cart/cart'
    });
  },

  onShareAppMessage() {
    const { drink } = this.data;
    return {
      title: `推荐您尝尝${drink ? drink.name : '这款饮料'}`,
      path: `/pages/drink-detail/drink-detail?id=${this.data.drinkId}`
    };
  }
});
