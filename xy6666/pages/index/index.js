const app = getApp();

Page({
  data: {
    categories: [],
    drinks: [],
    recommendedDrinks: [],
    currentCategoryId: 1,
    cartCount: 0,
    scrollTop: 0
  },

  onLoad() {
    this.initPageData();
  },

  onShow() {
    this.updateCartCount();
  },

  initPageData() {
    const categories = app.globalData.categories;
    const recommendedDrinks = app.getRecommendedDrinks();
    const drinks = app.getDrinksByCategory(1);

    this.setData({
      categories,
      recommendedDrinks,
      drinks
    });
  },

  updateCartCount() {
    const cart = app.globalData.cart;
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    this.setData({
      cartCount: count
    });
  },

  selectCategory(e) {
    const categoryId = e.currentTarget.dataset.id;
    const drinks = app.getDrinksByCategory(categoryId);
    
    this.setData({
      currentCategoryId: categoryId,
      drinks,
      scrollTop: 0
    });
  },

  goToDrinkDetail(e) {
    const drinkId = e.currentTarget.dataset.id;
    const drink = app.getDrinkById(drinkId);
    
    if (drink.stock <= 0) {
      wx.showToast({
        title: '该饮料已售罄',
        icon: 'none'
      });
      return;
    }
    
    wx.navigateTo({
      url: `/pages/drink-detail/drink-detail?id=${drinkId}`
    });
  },

  goToCart() {
    wx.switchTab({
      url: '/pages/cart/cart'
    });
  },

  onPullDownRefresh() {
    this.initPageData();
    this.updateCartCount();
    wx.stopPullDownRefresh();
    wx.showToast({
      title: '刷新成功',
      icon: 'success'
    });
  },

  onShareAppMessage() {
    return {
      title: '自助饮料机，随时享用美味饮品',
      path: '/pages/index/index'
    };
  }
});
