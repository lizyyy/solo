const { v4: uuidv4 } = require('uuid');

const products = [
  {
    id: 'prod_001',
    name: '经典圆领T恤',
    category: 'T恤',
    basePrice: 99,
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: ['白色', '黑色', '灰色']
  },
  {
    id: 'prod_002',
    name: '运动休闲鞋',
    category: '鞋子',
    basePrice: 299,
    sizes: ['38', '39', '40', '41', '42', '43', '44'],
    colors: ['白色', '黑色', '蓝色']
  },
  {
    id: 'prod_003',
    name: '商务休闲外套',
    category: '外套',
    basePrice: 599,
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: ['藏青', '卡其', '黑色']
  }
];

const inventory = [
  { id: 'inv_001', productId: 'prod_001', size: 'S', color: '白色', quantity: 10, price: 99 },
  { id: 'inv_002', productId: 'prod_001', size: 'M', color: '白色', quantity: 15, price: 99 },
  { id: 'inv_003', productId: 'prod_001', size: 'L', color: '白色', quantity: 12, price: 99 },
  { id: 'inv_004', productId: 'prod_001', size: 'XL', color: '白色', quantity: 5, price: 99 },
  { id: 'inv_005', productId: 'prod_001', size: 'XXL', color: '白色', quantity: 0, price: 99 },
  { id: 'inv_006', productId: 'prod_001', size: 'M', color: '黑色', quantity: 8, price: 109 },
  { id: 'inv_007', productId: 'prod_001', size: 'L', color: '黑色', quantity: 6, price: 109 },
  { id: 'inv_008', productId: 'prod_002', size: '39', color: '白色', quantity: 3, price: 299 },
  { id: 'inv_009', productId: 'prod_002', size: '40', color: '白色', quantity: 5, price: 299 },
  { id: 'inv_010', productId: 'prod_002', size: '41', color: '白色', quantity: 0, price: 299 },
  { id: 'inv_011', productId: 'prod_002', size: '42', color: '白色', quantity: 4, price: 299 },
  { id: 'inv_012', productId: 'prod_002', size: '43', color: '黑色', quantity: 7, price: 319 },
  { id: 'inv_013', productId: 'prod_003', size: 'M', color: '藏青', quantity: 4, price: 599 },
  { id: 'inv_014', productId: 'prod_003', size: 'L', color: '藏青', quantity: 6, price: 599 },
  { id: 'inv_015', productId: 'prod_003', size: 'XL', color: '藏青', quantity: 2, price: 599 },
  { id: 'inv_016', productId: 'prod_003', size: 'XXL', color: '卡其', quantity: 3, price: 649 }
];

const orders = [
  {
    id: 'ORD20260501001',
    orderDate: '2026-05-01T10:30:00Z',
    customerName: '张三',
    customerPhone: '13800138001',
    status: 'completed',
    items: [
      {
        id: 'item_001',
        productId: 'prod_001',
        productName: '经典圆领T恤',
        size: 'M',
        color: '白色',
        quantity: 1,
        price: 99
      }
    ],
    totalAmount: 99,
    shippingAddress: '北京市朝阳区建国路88号'
  },
  {
    id: 'ORD20260502002',
    orderDate: '2026-05-02T14:20:00Z',
    customerName: '李四',
    customerPhone: '13800138002',
    status: 'completed',
    items: [
      {
        id: 'item_002',
        productId: 'prod_002',
        productName: '运动休闲鞋',
        size: '40',
        color: '白色',
        quantity: 1,
        price: 299
      }
    ],
    totalAmount: 299,
    shippingAddress: '上海市浦东新区陆家嘴金融中心'
  },
  {
    id: 'ORD20260503003',
    orderDate: '2026-05-03T09:15:00Z',
    customerName: '王五',
    customerPhone: '13800138003',
    status: 'completed',
    items: [
      {
        id: 'item_003',
        productId: 'prod_003',
        productName: '商务休闲外套',
        size: 'L',
        color: '藏青',
        quantity: 1,
        price: 599
      }
    ],
    totalAmount: 599,
    shippingAddress: '广州市天河区珠江新城'
  }
];

const exchanges = [];

const exchangeTimelines = [];

const inventoryLogs = [];

module.exports = {
  products,
  inventory,
  orders,
  exchanges,
  exchangeTimelines,
  inventoryLogs
};
