App({
  globalData: {
    userInfo: null,
    cart: [],
    orders: [],
    drinks: [],
    categories: []
  },

  onLaunch() {
    this.initData();
  },

  initData() {
    const categories = [
      { id: 1, name: '人气推荐', icon: '🔥' },
      { id: 2, name: '奶茶系列', icon: '🥤' },
      { id: 3, name: '果茶系列', icon: '🍹' },
      { id: 4, name: '纯茶系列', icon: '🍵' },
      { id: 5, name: '咖啡系列', icon: '☕' },
      { id: 6, name: '特调系列', icon: '✨' }
    ];

    const drinks = [
      {
        id: 1,
        name: '招牌珍珠奶茶',
        categoryId: 2,
        price: 15,
        stock: 5,
        sales: 128,
        description: '经典珍珠奶茶，Q弹珍珠配香浓奶茶',
        image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=delicious%20bubble%20tea%20with%20tapioca%20pearls%20in%20a%20plastic%20cup%20with%20straw%20on%20white%20background&image_size=square_hd',
        isRecommended: true,
        options: {
          sugar: ['正常糖', '七分糖', '五分糖', '三分糖', '无糖'],
          ice: ['正常冰', '少冰', '去冰', '热饮'],
          size: ['中杯', '大杯'],
          toppings: [
            { name: '珍珠', price: 2 },
            { name: '椰果', price: 2 },
            { name: '芋圆', price: 3 },
            { name: '奶盖', price: 4 },
            { name: '奥利奥碎', price: 3 }
          ]
        }
      },
      {
        id: 2,
        name: '多肉葡萄',
        categoryId: 3,
        price: 18,
        stock: 3,
        sales: 256,
        description: '新鲜葡萄果肉搭配绿茶底，清爽解腻',
        image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=refreshing%20grape%20fruit%20tea%20with%20fresh%20grapes%20in%20a%20clear%20plastic%20cup%20on%20white%20background&image_size=square_hd',
        isRecommended: true,
        options: {
          sugar: ['正常糖', '七分糖', '五分糖', '三分糖', '无糖'],
          ice: ['正常冰', '少冰', '去冰'],
          size: ['中杯', '大杯'],
          toppings: [
            { name: '脆啵啵', price: 2 },
            { name: '椰果', price: 2 },
            { name: '多肉', price: 3 },
            { name: '奶盖', price: 4 }
          ]
        }
      },
      {
        id: 3,
        name: '杨枝甘露',
        categoryId: 3,
        price: 22,
        stock: 8,
        sales: 189,
        description: '芒果、西柚、椰奶的完美融合',
        image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=mango%20pomelo%20sago%20dessert%20drink%20in%20a%20clear%20glass%20with%20mango%20slices%20on%20white%20background&image_size=square_hd',
        isRecommended: true,
        options: {
          sugar: ['正常糖', '七分糖', '五分糖', '三分糖', '无糖'],
          ice: ['正常冰', '少冰', '去冰'],
          size: ['中杯', '大杯'],
          toppings: [
            { name: '西柚粒', price: 2 },
            { name: '芒果粒', price: 3 },
            { name: '椰果', price: 2 }
          ]
        }
      },
      {
        id: 4,
        name: '茉莉绿茶',
        categoryId: 4,
        price: 8,
        stock: 10,
        sales: 78,
        description: '清香茉莉花茶，回甘悠长',
        image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=clear%20jasmine%20green%20tea%20in%20a%20transparent%20cup%20with%20tea%20leaves%20on%20white%20background&image_size=square_hd',
        isRecommended: false,
        options: {
          sugar: ['无糖', '三分糖', '五分糖', '七分糖', '正常糖'],
          ice: ['正常冰', '少冰', '去冰', '热饮'],
          size: ['中杯', '大杯'],
          toppings: [
            { name: '珍珠', price: 2 },
            { name: '椰果', price: 2 }
          ]
        }
      },
      {
        id: 5,
        name: '生椰拿铁',
        categoryId: 5,
        price: 20,
        stock: 6,
        sales: 145,
        description: '浓郁椰香搭配意式浓缩，醇厚丝滑',
        image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=coconut%20milk%20latte%20coffee%20in%20a%20clear%20plastic%20cup%20showing%20layers%20on%20white%20background&image_size=square_hd',
        isRecommended: true,
        options: {
          sugar: ['无糖', '三分糖', '五分糖', '七分糖'],
          ice: ['正常冰', '少冰', '去冰', '热饮'],
          size: ['中杯', '大杯'],
          toppings: [
            { name: '奶盖', price: 4 },
            { name: '椰果', price: 2 }
          ]
        }
      },
      {
        id: 6,
        name: '芋泥啵啵奶绿',
        categoryId: 2,
        price: 16,
        stock: 0,
        sales: 98,
        description: '绵密芋泥搭配Q弹啵啵，奶香浓郁',
        image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=taro%20milk%20tea%20with%20taro%20balls%20and%20creamy%20texture%20in%20a%20plastic%20cup%20on%20white%20background&image_size=square_hd',
        isRecommended: false,
        options: {
          sugar: ['正常糖', '七分糖', '五分糖', '三分糖', '无糖'],
          ice: ['正常冰', '少冰', '去冰', '热饮'],
          size: ['中杯', '大杯'],
          toppings: [
            { name: '芋圆', price: 3 },
            { name: '珍珠', price: 2 },
            { name: '奶盖', price: 4 }
          ]
        }
      },
      {
        id: 7,
        name: '芝芝莓莓',
        categoryId: 3,
        price: 20,
        stock: 4,
        sales: 167,
        description: '新鲜草莓搭配浓郁奶盖，酸甜可口',
        image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=strawberry%20fruit%20tea%20with%20cheese%20foam%20topping%20and%20fresh%20strawberries%20in%20a%20clear%20cup%20on%20white%20background&image_size=square_hd',
        isRecommended: true,
        options: {
          sugar: ['正常糖', '七分糖', '五分糖', '三分糖', '无糖'],
          ice: ['正常冰', '少冰', '去冰'],
          size: ['中杯', '大杯'],
          toppings: [
            { name: '脆啵啵', price: 2 },
            { name: '椰果', price: 2 },
            { name: '奶盖', price: 4 }
          ]
        }
      },
      {
        id: 8,
        name: '美式咖啡',
        categoryId: 5,
        price: 12,
        stock: 12,
        sales: 56,
        description: '经典美式，醇香浓郁，提神醒脑',
        image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=classic%20americano%20coffee%20in%20a%20clear%20plastic%20cup%20with%20coffee%20beans%20on%20white%20background&image_size=square_hd',
        isRecommended: false,
        options: {
          sugar: ['无糖', '少量糖'],
          ice: ['正常冰', '少冰', '去冰', '热饮'],
          size: ['中杯', '大杯'],
          toppings: [
            { name: '奶盖', price: 4 }
          ]
        }
      },
      {
        id: 9,
        name: '泰式手打柠檬茶',
        categoryId: 6,
        price: 16,
        stock: 7,
        sales: 203,
        description: '手打泰国香水柠檬，清爽解腻',
        image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=thai%20style%20hand%20crushed%20lemon%20tea%20with%20lime%20slices%20in%20a%20clear%20plastic%20cup%20on%20white%20background&image_size=square_hd',
        isRecommended: true,
        options: {
          sugar: ['正常糖', '七分糖', '五分糖', '三分糖', '无糖'],
          ice: ['正常冰', '少冰', '去冰'],
          size: ['中杯', '大杯'],
          toppings: [
            { name: '脆啵啵', price: 2 },
            { name: '椰果', price: 2 }
          ]
        }
      },
      {
        id: 10,
        name: '大红袍奶茶',
        categoryId: 2,
        price: 14,
        stock: 9,
        sales: 87,
        description: '武夷山大红袍茶底，茶香浓郁',
        image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=premium%20oolong%20milk%20tea%20with%20rich%20tea%20aroma%20in%20a%20plastic%20cup%20on%20white%20background&image_size=square_hd',
        isRecommended: false,
        options: {
          sugar: ['正常糖', '七分糖', '五分糖', '三分糖', '无糖'],
          ice: ['正常冰', '少冰', '去冰', '热饮'],
          size: ['中杯', '大杯'],
          toppings: [
            { name: '珍珠', price: 2 },
            { name: '椰果', price: 2 },
            { name: '芋圆', price: 3 },
            { name: '奶盖', price: 4 }
          ]
        }
      }
    ];

    this.globalData.categories = categories;
    this.globalData.drinks = drinks;
  },

  addToCart(cartItem) {
    const cart = this.globalData.cart;
    const existingItem = cart.find(item => 
      item.drinkId === cartItem.drinkId &&
      item.sugar === cartItem.sugar &&
      item.ice === cartItem.ice &&
      item.size === cartItem.size &&
      JSON.stringify(item.selectedToppings) === JSON.stringify(cartItem.selectedToppings)
    );

    if (existingItem) {
      existingItem.quantity += cartItem.quantity;
    } else {
      cart.push(cartItem);
    }
  },

  removeFromCart(index) {
    this.globalData.cart.splice(index, 1);
  },

  updateCartItemQuantity(index, quantity) {
    if (quantity <= 0) {
      this.removeFromCart(index);
    } else {
      this.globalData.cart[index].quantity = quantity;
    }
  },

  clearCart() {
    this.globalData.cart = [];
  },

  getCartTotal() {
    return this.globalData.cart.reduce((total, item) => {
      const toppingsPrice = item.selectedToppings.reduce((sum, t) => sum + t.price, 0);
      return total + (item.price + toppingsPrice) * item.quantity;
    }, 0);
  },

  getDrinkById(id) {
    return this.globalData.drinks.find(drink => drink.id === id);
  },

  getDrinksByCategory(categoryId) {
    return this.globalData.drinks.filter(drink => drink.categoryId === categoryId);
  },

  getRecommendedDrinks() {
    return this.globalData.drinks.filter(drink => drink.isRecommended);
  },

  createOrder(orderData) {
    const order = {
      id: 'ORD' + Date.now(),
      items: [...this.globalData.cart],
      total: this.getCartTotal(),
      status: 'pending',
      createTime: new Date().toLocaleString(),
      estimatedTime: 5 + Math.floor(Math.random() * 5),
      customerName: orderData.customerName || '顾客',
      phone: orderData.phone || '',
      remark: orderData.remark || ''
    };
    
    this.globalData.orders.unshift(order);
    this.clearCart();
    
    this.startOrderProcessing(order.id);
    
    return order;
  },

  startOrderProcessing(orderId) {
    const order = this.globalData.orders.find(o => o.id === orderId);
    if (!order) return;

    setTimeout(() => {
      order.status = 'preparing';
    }, 2000);

    setTimeout(() => {
      order.status = 'making';
    }, 5000);

    setTimeout(() => {
      order.status = 'ready';
    }, 8000);
  },

  getOrderById(orderId) {
    return this.globalData.orders.find(o => o.id === orderId);
  }
});
