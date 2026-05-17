const mongoose = require('mongoose');
const { PreparedMeal } = require('../models/PreparedMeal');
const { Store } = require('../models/Store');
const Inventory = require('../models/Inventory');

const connectDB = async () => {
  await mongoose.connect('mongodb://localhost:27017/food_prepared_meals');
  console.log('MongoDB connected for seeding');
};

const preparedMealsData = [
  {
    sku: 'PMC001',
    name: '红烧狮子头',
    category: '热菜',
    price: 38.00,
    originalPrice: 48.00,
    cost: 18.50,
    weight: 350,
    shelfLife: 180,
    storageCondition: '冷冻-18℃以下',
    ingredients: ['猪肉', '马蹄', '鸡蛋', '生姜', '大葱', '淀粉'],
    allergens: ['鸡蛋', '大豆'],
    nutritionInfo: {
      calories: 450,
      protein: 28,
      fat: 35,
      carbs: 15
    },
    status: 'available',
    imageUrl: 'https://example.com/images/hongshaoshizitou.jpg',
    description: '经典淮扬菜，选用优质五花肉，手工制作，口感鲜嫩多汁',
    supplier: {
      name: '苏州味道中央厨房',
      contact: '张经理 13800138001',
      address: '江苏省苏州市工业园区食品加工区10号'
    },
    createdBy: 'admin001'
  },
  {
    sku: 'PMC002',
    name: '梅菜扣肉',
    category: '热菜',
    price: 45.00,
    originalPrice: 58.00,
    cost: 22.00,
    weight: 400,
    shelfLife: 180,
    storageCondition: '冷冻-18℃以下',
    ingredients: ['五花肉', '梅干菜', '生姜', '大蒜', '料酒', '酱油'],
    allergens: ['大豆'],
    nutritionInfo: {
      calories: 580,
      protein: 25,
      fat: 50,
      carbs: 12
    },
    status: 'available',
    imageUrl: 'https://example.com/images/meicaikourou.jpg',
    description: '客家传统名菜，肉烂味香，咸中带甜，肥而不腻',
    supplier: {
      name: '客家风味食品有限公司',
      contact: '李总 13900139002',
      address: '广东省梅州市梅县区食品工业园'
    },
    createdBy: 'admin001'
  },
  {
    sku: 'PMC003',
    name: '酸菜鱼',
    category: '热菜',
    price: 52.00,
    originalPrice: 68.00,
    cost: 26.00,
    weight: 500,
    shelfLife: 90,
    storageCondition: '冷冻-18℃以下',
    ingredients: ['草鱼', '酸菜', '泡椒', '生姜', '大蒜', '辣椒'],
    allergens: ['鱼类'],
    nutritionInfo: {
      calories: 320,
      protein: 35,
      fat: 18,
      carbs: 8
    },
    status: 'available',
    imageUrl: 'https://example.com/images/suancaiyu.jpg',
    description: '四川经典名菜，酸辣开胃，鱼肉嫩滑',
    supplier: {
      name: '川味食品加工基地',
      contact: '王厂长 13700137003',
      address: '四川省成都市郫都区中国川菜产业化园区'
    },
    createdBy: 'admin001'
  },
  {
    sku: 'PMC004',
    name: '宫保鸡丁',
    category: '热菜',
    price: 32.00,
    originalPrice: 42.00,
    cost: 15.00,
    weight: 280,
    shelfLife: 180,
    storageCondition: '冷冻-18℃以下',
    ingredients: ['鸡胸肉', '花生', '干辣椒', '花椒', '大葱', '生姜'],
    allergens: ['花生'],
    nutritionInfo: {
      calories: 380,
      protein: 32,
      fat: 22,
      carbs: 10
    },
    status: 'available',
    imageUrl: 'https://example.com/images/gongbaojiding.jpg',
    description: '川菜代表菜品，麻辣鲜香，鸡肉嫩滑，花生酥脆',
    supplier: {
      name: '川味食品加工基地',
      contact: '王厂长 13700137003',
      address: '四川省成都市郫都区中国川菜产业化园区'
    },
    createdBy: 'admin001'
  },
  {
    sku: 'PMC005',
    name: '糖醋排骨',
    category: '热菜',
    price: 42.00,
    originalPrice: 55.00,
    cost: 20.00,
    weight: 320,
    shelfLife: 180,
    storageCondition: '冷冻-18℃以下',
    ingredients: ['猪排骨', '白糖', '醋', '番茄酱', '生姜', '料酒'],
    allergens: [],
    nutritionInfo: {
      calories: 420,
      protein: 26,
      fat: 28,
      carbs: 22
    },
    status: 'available',
    imageUrl: 'https://example.com/images/tangcupaigu.jpg',
    description: '酸甜可口，外酥里嫩，老少皆宜',
    supplier: {
      name: '江南味道中央厨房',
      contact: '张经理 13800138001',
      address: '江苏省苏州市工业园区食品加工区10号'
    },
    createdBy: 'admin001'
  },
  {
    sku: 'PMC006',
    name: '水煮牛肉',
    category: '热菜',
    price: 48.00,
    originalPrice: 62.00,
    cost: 24.00,
    weight: 350,
    shelfLife: 90,
    storageCondition: '冷冻-18℃以下',
    ingredients: ['牛肉', '豆芽', '干辣椒', '花椒', '郫县豆瓣酱', '生姜'],
    allergens: [],
    nutritionInfo: {
      calories: 400,
      protein: 38,
      fat: 25,
      carbs: 8
    },
    status: 'available',
    imageUrl: 'https://example.com/images/shuizhuniurou.jpg',
    description: '麻辣鲜香，牛肉嫩滑，豆芽爽脆',
    supplier: {
      name: '川味食品加工基地',
      contact: '王厂长 13700137003',
      address: '四川省成都市郫都区中国川菜产业化园区'
    },
    createdBy: 'admin001'
  },
  {
    sku: 'PMC007',
    name: '香菇滑鸡',
    category: '热菜',
    price: 35.00,
    originalPrice: 45.00,
    cost: 17.00,
    weight: 300,
    shelfLife: 180,
    storageCondition: '冷冻-18℃以下',
    ingredients: ['鸡肉', '香菇', '生姜', '大蒜', '酱油', '淀粉'],
    allergens: ['大豆'],
    nutritionInfo: {
      calories: 350,
      protein: 30,
      fat: 20,
      carbs: 12
    },
    status: 'off_shelves_processing',
    imageUrl: 'https://example.com/images/xiangguhuaji.jpg',
    description: '粤式经典，香菇滑嫩，香菇香浓入味',
    supplier: {
      name: '粤式美味食品有限公司',
      contact: '陈经理 13600136004',
      address: '广东省佛山市顺德区食品工业园'
    },
    createdBy: 'admin001'
  },
  {
    sku: 'PMC008',
    name: '土豆炖牛腩',
    category: '热菜',
    price: 58.00,
    originalPrice: 78.00,
    cost: 29.00,
    weight: 450,
    shelfLife: 180,
    storageCondition: '冷冻-18℃以下',
    ingredients: ['牛腩', '土豆', '胡萝卜', '生姜', '大蒜', '八角'],
    allergens: [],
    nutritionInfo: {
      calories: 480,
      protein: 35,
      fat: 32,
      carbs: 18
    },
    status: 'available',
    imageUrl: 'https://example.com/images/tudoudouniunan.jpg',
    description: '家常美味，牛腩软烂入味，土豆软糯',
    supplier: {
      name: '北方味道食品厂',
      contact: '刘厂长 13500135005',
      address: '山东省济南市历城区食品加工区'
    },
    createdBy: 'admin001'
  }
];

const storesData = [
  {
    storeCode: 'SH001',
    name: '上海南京东路店',
    address: {
      province: '上海市',
      city: '上海市',
      district: '黄浦区',
      detail: '南京东路100号',
      full: '上海市黄浦区南京东路100号'
    },
    phone: '021-63210001',
    manager: {
      name: '张伟',
      phone: '13800000001',
      email: 'zhangwei@example.com'
    },
    businessHours: [
      { day: '周一', openTime: '10:00', closeTime: '22:00' },
      { day: '周二', openTime: '10:00', closeTime: '22:00' },
      { day: '周三', openTime: '10:00', closeTime: '22:00' },
      { day: '周四', openTime: '10:00', closeTime: '22:00' },
      { day: '周五', openTime: '10:00', closeTime: '22:00' },
      { day: '周六', openTime: '09:30', closeTime: '22:30' },
      { day: '周日', openTime: '09:30', closeTime: '22:30' }
    ],
    area: 150,
    seatingCapacity: 80,
    kitchenCapacity: 200,
    status: 'open',
    openDate: new Date('2023-01-15'),
    region: '华东',
    franchiseType: '直营',
    createdBy: 'admin001'
  },
  {
    storeCode: 'SH002',
    name: '上海徐家汇店',
    address: {
      province: '上海市',
      city: '上海市',
      district: '徐汇区',
      detail: '漕溪北路88号',
      full: '上海市徐汇区漕溪北路88号'
    },
    phone: '021-64270002',
    manager: {
      name: '李娜',
      phone: '13800000002',
      email: 'lina@example.com'
    },
    businessHours: [
      { day: '周一', openTime: '10:00', closeTime: '22:00' },
      { day: '周二', openTime: '10:00', closeTime: '22:00' },
      { day: '周三', openTime: '10:00', closeTime: '22:00' },
      { day: '周四', openTime: '10:00', closeTime: '22:00' },
      { day: '周五', openTime: '10:00', closeTime: '22:00' },
      { day: '周六', openTime: '09:30', closeTime: '22:30' },
      { day: '周日', openTime: '09:30', closeTime: '22:30' }
    ],
    area: 120,
    seatingCapacity: 60,
    kitchenCapacity: 150,
    status: 'open',
    openDate: new Date('2023-03-20'),
    region: '华东',
    franchiseType: '直营',
    createdBy: 'admin001'
  },
  {
    storeCode: 'BJ001',
    name: '北京王府井店',
    address: {
      province: '北京市',
      city: '北京市',
      district: '东城区',
      detail: '王府井大街200号',
      full: '北京市东城区王府井大街200号'
    },
    phone: '010-65280003',
    manager: {
      name: '王强',
      phone: '13900000003',
      email: 'wangqiang@example.com'
    },
    businessHours: [
      { day: '周一', openTime: '10:00', closeTime: '22:00' },
      { day: '周二', openTime: '10:00', closeTime: '22:00' },
      { day: '周三', openTime: '10:00', closeTime: '22:00' },
      { day: '周四', openTime: '10:00', closeTime: '22:00' },
      { day: '周五', openTime: '10:00', closeTime: '22:00' },
      { day: '周六', openTime: '09:30', closeTime: '22:30' },
      { day: '周日', openTime: '09:30', closeTime: '22:30' }
    ],
    area: 180,
    seatingCapacity: 100,
    kitchenCapacity: 250,
    status: 'open',
    openDate: new Date('2023-02-10'),
    region: '华北',
    franchiseType: '直营',
    createdBy: 'admin001'
  },
  {
    storeCode: 'GZ001',
    name: '广州天河城店',
    address: {
      province: '广东省',
      city: '广州市',
      district: '天河区',
      detail: '天河路208号',
      full: '广东省广州市天河区天河路208号'
    },
    phone: '020-85590004',
    manager: {
      name: '陈敏',
      phone: '13700000004',
      email: 'chenmin@example.com'
    },
    businessHours: [
      { day: '周一', openTime: '10:00', closeTime: '22:00' },
      { day: '周二', openTime: '10:00', closeTime: '22:00' },
      { day: '周三', openTime: '10:00', closeTime: '22:00' },
      { day: '周四', openTime: '10:00', closeTime: '22:00' },
      { day: '周五', openTime: '10:00', closeTime: '22:00' },
      { day: '周六', openTime: '09:30', closeTime: '22:30' },
      { day: '周日', openTime: '09:30', closeTime: '22:30' }
    ],
    area: 140,
    seatingCapacity: 70,
    kitchenCapacity: 180,
    status: 'open',
    openDate: new Date('2023-04-05'),
    region: '华南',
    franchiseType: '直营',
    createdBy: 'admin001'
  },
  {
    storeCode: 'SZ001',
    name: '深圳华强北店',
    address: {
      province: '广东省',
      city: '深圳市',
      district: '福田区',
      detail: '华强北路1000号',
      full: '广东省深圳市福田区华强北路1000号'
    },
    phone: '0755-83210005',
    manager: {
      name: '刘洋',
      phone: '13600000005',
      email: 'liuyang@example.com'
    },
    businessHours: [
      { day: '周一', openTime: '10:00', closeTime: '22:00' },
      { day: '周二', openTime: '10:00', closeTime: '22:00' },
      { day: '周三', openTime: '10:00', closeTime: '22:00' },
      { day: '周四', openTime: '10:00', closeTime: '22:00' },
      { day: '周五', openTime: '10:00', closeTime: '22:00' },
      { day: '周六', openTime: '09:30', closeTime: '22:30' },
      { day: '周日', openTime: '09:30', closeTime: '22:30' }
    ],
    area: 100,
    seatingCapacity: 50,
    kitchenCapacity: 120,
    status: 'temporarily_closed',
    openDate: new Date('2023-05-15'),
    region: '华南',
    franchiseType: '加盟',
    createdBy: 'admin001'
  }
];

const generateInventoryData = (meals, stores) => {
  const inventoryData = [];
  const stockLevels = [
    { available: 150, reserved: 20, safety: 50 },
    { available: 0, reserved: 0, safety: 30 },
    { available: 85, reserved: 15, safety: 40 },
    { available: 200, reserved: 30, safety: 60 },
    { available: 45, reserved: 5, safety: 35 }
  ];

  meals.forEach((meal, mealIndex) => {
    stores.forEach((store, storeIndex) => {
      const stock = stockLevels[(mealIndex + storeIndex) % stockLevels.length];
      inventoryData.push({
        preparedMealId: meal._id,
        storeId: store._id,
        sku: meal.sku,
        storeCode: store.storeCode,
        quantity: stock.available + stock.reserved,
        availableQuantity: stock.available,
        reservedQuantity: stock.reserved,
        safetyStock: stock.safety,
        costPrice: meal.cost,
        lastStockDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        nextRestockDate: new Date(Date.now() + Math.random() * 3 * 24 * 60 * 60 * 1000),
        batchNo: `BATCH${String(new Date().getFullYear())}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
        productionDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        location: `货架${String(storeIndex + 1)}-${String(mealIndex + 1).padStart(2, '0')}`,
        createdBy: 'admin001'
      });
    });
  });

  return inventoryData;
};

const seedDatabase = async () => {
  try {
    await connectDB();

    console.log('Clearing existing data...');
    await PreparedMeal.deleteMany({});
    await Store.deleteMany({});
    await Inventory.deleteMany({});

    console.log('Seeding prepared meals...');
    const preparedMeals = await PreparedMeal.insertMany(preparedMealsData);
    console.log(`Created ${preparedMeals.length} prepared meals`);

    console.log('Seeding stores...');
    const stores = await Store.insertMany(storesData);
    console.log(`Created ${stores.length} stores`);

    console.log('Seeding inventory...');
    const inventoryData = generateInventoryData(preparedMeals, stores);
    const inventories = await Inventory.insertMany(inventoryData);
    console.log(`Created ${inventories.length} inventory records`);

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedDatabase();
