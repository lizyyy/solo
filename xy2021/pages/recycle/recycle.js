const storage = require('../../../utils/storage.js');
const dataUtils = require('../../../utils/data.js');

Page({
  data: {
    selectedTab: 'guide',
    garbageCategories: [],
    confusingGarbage: [],
    selectedCategory: null,
    showCategoryDetail: false,
    recycleTypes: [
      { id: 'paper', name: '纸张', icon: '📄', color: '#2196F3', unit: '公斤', description: '报纸、书本、纸箱等' },
      { id: 'plastic', name: '塑料', icon: '🧴', color: '#4CAF50', unit: '公斤', description: '塑料瓶、塑料盒等' },
      { id: 'glass', name: '玻璃', icon: '🍶', color: '#9C27B0', unit: '公斤', description: '玻璃瓶、玻璃罐等' },
      { id: 'metal', name: '金属', icon: '🥫', color: '#FF9800', unit: '公斤', description: '易拉罐、金属罐等' },
      { id: 'fabric', name: '织物', icon: '👕', color: '#E91E63', unit: '公斤', description: '旧衣服、布料等' },
      { id: 'electronics', name: '电子产品', icon: '📱', color: '#00BCD4', unit: '件', description: '手机、电脑、电池等' }
    ],
    selectedRecycleType: null,
    recycleWeight: '',
    estimatedResult: null,
    showEstimateResult: false,
    recycleOrders: [],
    showOrderModal: false,
    orderForm: {
      name: '',
      phone: '',
      address: '',
      items: [],
      totalWeight: 0,
      estimatedPoints: 0,
      remark: ''
    },
    searchKeyword: '',
    searchResults: [],
    showSearch: false,
    garbageSearchList: [
      { name: '大骨头', category: 'other', color: '#9E9E9E', categoryName: '其他垃圾' },
      { name: '椰子壳', category: 'other', color: '#9E9E9E', categoryName: '其他垃圾' },
      { name: '榴莲壳', category: 'other', color: '#9E9E9E', categoryName: '其他垃圾' },
      { name: '玉米皮', category: 'other', color: '#9E9E9E', categoryName: '其他垃圾' },
      { name: '一次性筷子', category: 'other', color: '#9E9E9E', categoryName: '其他垃圾' },
      { name: '外卖餐盒', category: 'other', color: '#9E9E9E', categoryName: '其他垃圾' },
      { name: '卫生纸', category: 'other', color: '#9E9E9E', categoryName: '其他垃圾' },
      { name: '湿巾', category: 'other', color: '#9E9E9E', categoryName: '其他垃圾' },
      { name: '陶瓷碗', category: 'other', color: '#9E9E9E', categoryName: '其他垃圾' },
      { name: '旧毛巾', category: 'other', color: '#9E9E9E', categoryName: '其他垃圾' },
      { name: '旧牙刷', category: 'other', color: '#9E9E9E', categoryName: '其他垃圾' },
      { name: '染发剂', category: 'harmful', color: '#F44336', categoryName: '有害垃圾' },
      { name: '过期化妆品', category: 'harmful', color: '#F44336', categoryName: '有害垃圾' },
      { name: '废旧灯泡', category: 'harmful', color: '#F44336', categoryName: '有害垃圾' },
      { name: '废电池', category: 'harmful', color: '#F44336', categoryName: '有害垃圾' },
      { name: '过期药品', category: 'harmful', color: '#F44336', categoryName: '有害垃圾' },
      { name: '报纸', category: 'recyclable', color: '#2196F3', categoryName: '可回收物' },
      { name: '纸箱', category: 'recyclable', color: '#2196F3', categoryName: '可回收物' },
      { name: '塑料瓶', category: 'recyclable', color: '#2196F3', categoryName: '可回收物' },
      { name: '玻璃瓶', category: 'recyclable', color: '#2196F3', categoryName: '可回收物' },
      { name: '易拉罐', category: 'recyclable', color: '#2196F3', categoryName: '可回收物' },
      { name: '剩菜剩饭', category: 'kitchen', color: '#4CAF50', categoryName: '厨余垃圾' },
      { name: '果皮', category: 'kitchen', color: '#4CAF50', categoryName: '厨余垃圾' },
      { name: '茶渣', category: 'kitchen', color: '#4CAF50', categoryName: '厨余垃圾' },
      { name: '蛋壳', category: 'kitchen', color: '#4CAF50', categoryName: '厨余垃圾' },
      { name: '蔬菜', category: 'kitchen', color: '#4CAF50', categoryName: '厨余垃圾' },
      { name: '烟蒂', category: 'other', color: '#9E9E9E', categoryName: '其他垃圾' },
      { name: '砖瓦', category: 'other', color: '#9E9E9E', categoryName: '其他垃圾' },
      { name: '渣土', category: 'other', color: '#9E9E9E', categoryName: '其他垃圾' }
    ]
  },

  onLoad: function() {
    this.initData();
  },

  onShow: function() {
    this.loadOrders();
  },

  initData: function() {
    const categories = dataUtils.GARBAGE_CATEGORIES.map(cat => ({
      ...cat,
      expanded: false
    }));
    
    this.setData({
      garbageCategories: categories,
      confusingGarbage: dataUtils.CONFUSING_GARBAGE
    });
    
    this.loadOrders();
  },

  loadOrders: function() {
    const orders = storage.getRecycleOrders();
    this.setData({
      recycleOrders: orders
    });
  },

  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      selectedTab: tab
    });
  },

  toggleCategory: function(e) {
    const id = e.currentTarget.dataset.id;
    const categories = this.data.garbageCategories.map(cat => ({
      ...cat,
      expanded: cat.id === id ? !cat.expanded : false
    }));
    this.setData({
      garbageCategories: categories
    });
  },

  showCategoryDetail: function(e) {
    const id = e.currentTarget.dataset.id;
    const category = this.data.garbageCategories.find(cat => cat.id === id);
    if (category) {
      this.setData({
        selectedCategory: category,
        showCategoryDetail: true
      });
    }
  },

  closeCategoryDetail: function() {
    this.setData({
      showCategoryDetail: false,
      selectedCategory: null
    });
  },

  toggleSearch: function() {
    this.setData({
      showSearch: !this.data.showSearch,
      searchKeyword: '',
      searchResults: []
    });
  },

  onSearchInput: function(e) {
    const keyword = e.detail.value;
    this.setData({
      searchKeyword: keyword
    });
    
    if (keyword.trim()) {
      const results = this.data.garbageSearchList.filter(item => 
        item.name.includes(keyword)
      );
      this.setData({
        searchResults: results
      });
    } else {
      this.setData({
        searchResults: []
      });
    }
  },

  selectRecycleType: function(e) {
    const id = e.currentTarget.dataset.id;
    const type = this.data.recycleTypes.find(t => t.id === id);
    this.setData({
      selectedRecycleType: type,
      recycleWeight: '',
      estimatedResult: null
    });
  },

  inputWeight: function(e) {
    const value = e.detail.value;
    this.setData({
      recycleWeight: value
    });
    
    if (value && this.data.selectedRecycleType) {
      this.calculateEstimate();
    }
  },

  calculateEstimate: function() {
    const { selectedRecycleType, recycleWeight } = this.data;
    if (!selectedRecycleType || !recycleWeight) return;
    
    const weight = parseFloat(recycleWeight);
    if (isNaN(weight) || weight <= 0) return;
    
    const result = dataUtils.calculateRecycleValue(selectedRecycleType.id, weight);
    
    this.setData({
      estimatedResult: {
        ...result,
        typeName: selectedRecycleType.name,
        weight: weight,
        unit: selectedRecycleType.unit
      },
      showEstimateResult: true
    });
  },

  closeEstimateResult: function() {
    this.setData({
      showEstimateResult: false
    });
  },

  addToOrder: function() {
    const { selectedRecycleType, recycleWeight, estimatedResult, orderForm } = this.data;
    
    if (!selectedRecycleType || !recycleWeight || !estimatedResult) {
      wx.showToast({
        title: '请先完成估值',
        icon: 'none'
      });
      return;
    }
    
    const weight = parseFloat(recycleWeight);
    const item = {
      typeId: selectedRecycleType.id,
      typeName: selectedRecycleType.name,
      icon: selectedRecycleType.icon,
      weight: weight,
      unit: selectedRecycleType.unit,
      points: estimatedResult.points,
      carbonSaved: estimatedResult.carbonSaved
    };
    
    const newItems = [...orderForm.items, item];
    const totalWeight = newItems.reduce((sum, i) => sum + i.weight, 0);
    const totalPoints = newItems.reduce((sum, i) => sum + i.points, 0);
    
    this.setData({
      orderForm: {
        ...orderForm,
        items: newItems,
        totalWeight: totalWeight,
        estimatedPoints: totalPoints
      },
      selectedRecycleType: null,
      recycleWeight: '',
      estimatedResult: null,
      showEstimateResult: false
    });
    
    wx.showToast({
      title: '已添加到订单',
      icon: 'success'
    });
  },

  removeOrderItem: function(e) {
    const index = e.currentTarget.dataset.index;
    const { orderForm } = this.data;
    
    const newItems = orderForm.items.filter((_, i) => i !== index);
    const totalWeight = newItems.reduce((sum, i) => sum + i.weight, 0);
    const totalPoints = newItems.reduce((sum, i) => sum + i.points, 0);
    
    this.setData({
      orderForm: {
        ...orderForm,
        items: newItems,
        totalWeight: totalWeight,
        estimatedPoints: totalPoints
      }
    });
  },

  showOrderModal: function() {
    const { orderForm } = this.data;
    if (orderForm.items.length === 0) {
      wx.showToast({
        title: '请先添加回收物品',
        icon: 'none'
      });
      return;
    }
    this.setData({
      showOrderModal: true
    });
  },

  closeOrderModal: function() {
    this.setData({
      showOrderModal: false
    });
  },

  inputOrderForm: function(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      orderForm: {
        ...this.data.orderForm,
        [field]: value
      }
    });
  },

  submitOrder: function() {
    const { orderForm } = this.data;
    
    if (!orderForm.name.trim()) {
      wx.showToast({ title: '请输入联系人', icon: 'none' });
      return;
    }
    if (!orderForm.phone.trim()) {
      wx.showToast({ title: '请输入联系电话', icon: 'none' });
      return;
    }
    if (!orderForm.address.trim()) {
      wx.showToast({ title: '请输入上门地址', icon: 'none' });
      return;
    }
    
    const order = storage.createRecycleOrder({
      ...orderForm,
      status: 'pending'
    });
    
    storage.addPoints(order.estimatedPoints, `回收物品预约`);
    
    this.setData({
      showOrderModal: false,
      orderForm: {
        name: '',
        phone: '',
        address: '',
        items: [],
        totalWeight: 0,
        estimatedPoints: 0,
        remark: ''
      }
    });
    
    this.loadOrders();
    
    wx.showToast({
      title: '预约成功',
      icon: 'success'
    });
    
    wx.vibrateShort();
  },

  getOrderStatusText: function(status) {
    const statusMap = {
      pending: '待接单',
      accepted: '已接单',
      picking: '上门中',
      completed: '已完成',
      cancelled: '已取消'
    };
    return statusMap[status] || status;
  },

  getOrderStatusColor: function(status) {
    const colorMap = {
      pending: '#FF9800',
      accepted: '#2196F3',
      picking: '#9C27B0',
      completed: '#4CAF50',
      cancelled: '#9E9E9E'
    };
    return colorMap[status] || '#666666';
  },

  showOrderDetail: function(e) {
    const id = e.currentTarget.dataset.id;
    const order = this.data.recycleOrders.find(o => o.id === id);
    
    if (order) {
      const itemsText = order.items.map(i => `${i.typeName} ${i.weight}${i.unit}`).join('、');
      wx.showModal({
        title: '订单详情',
        content: `联系人：${order.name}\n电话：${order.phone}\n地址：${order.address}\n物品：${itemsText}\n预计积分：${order.estimatedPoints}积分\n状态：${this.getOrderStatusText(order.status)}`,
        showCancel: false
      });
    }
  }
});
