const { store, saveData, resetData } = require('../services/store');
const { v4: uuidv4 } = require('uuid');

function now() {
  return new Date().toISOString();
}

console.log('开始初始化样例数据...');

resetData();

const warehouses = [
  {
    id: `wh_${uuidv4()}`,
    code: 'WH-SH',
    name: '上海仓',
    province: '上海市',
    city: '上海市',
    created_at: now()
  },
  {
    id: `wh_${uuidv4()}`,
    code: 'WH-BJ',
    name: '北京仓',
    province: '北京市',
    city: '北京市',
    created_at: now()
  },
  {
    id: `wh_${uuidv4()}`,
    code: 'WH-GZ',
    name: '广州仓',
    province: '广东省',
    city: '广州市',
    created_at: now()
  }
];

const skus = [
  { id: `sku_${uuidv4()}`, code: 'SKU-001', name: 'iPhone 15 Pro 256G', unit: '台', created_at: now() },
  { id: `sku_${uuidv4()}`, code: 'SKU-002', name: 'AirPods Pro 2', unit: '副', created_at: now() },
  { id: `sku_${uuidv4()}`, code: 'SKU-003', name: 'MacBook Air M2', unit: '台', created_at: now() },
  { id: `sku_${uuidv4()}`, code: 'SKU-004', name: 'iPad Air 5', unit: '台', created_at: now() },
  { id: `sku_${uuidv4()}`, code: 'SKU-005', name: 'Apple Watch Series 9', unit: '只', created_at: now() }
];

store.warehouses = warehouses;
store.skus = skus;

const whSh = warehouses.find(w => w.code === 'WH-SH');
const whBj = warehouses.find(w => w.code === 'WH-BJ');
const whGz = warehouses.find(w => w.code === 'WH-GZ');

const sku1 = skus.find(s => s.code === 'SKU-001');
const sku2 = skus.find(s => s.code === 'SKU-002');
const sku3 = skus.find(s => s.code === 'SKU-003');
const sku4 = skus.find(s => s.code === 'SKU-004');
const sku5 = skus.find(s => s.code === 'SKU-005');

store.inventory = [
  { id: `inv_${uuidv4()}`, warehouse_id: whSh.id, sku_id: sku1.id, available_qty: 50, locked_qty: 0 },
  { id: `inv_${uuidv4()}`, warehouse_id: whSh.id, sku_id: sku2.id, available_qty: 100, locked_qty: 0 },
  { id: `inv_${uuidv4()}`, warehouse_id: whSh.id, sku_id: sku3.id, available_qty: 5, locked_qty: 0 },
  { id: `inv_${uuidv4()}`, warehouse_id: whSh.id, sku_id: sku4.id, available_qty: 0, locked_qty: 0 },
  { id: `inv_${uuidv4()}`, warehouse_id: whSh.id, sku_id: sku5.id, available_qty: 30, locked_qty: 0 },
  { id: `inv_${uuidv4()}`, warehouse_id: whBj.id, sku_id: sku1.id, available_qty: 100, locked_qty: 0 },
  { id: `inv_${uuidv4()}`, warehouse_id: whBj.id, sku_id: sku2.id, available_qty: 50, locked_qty: 0 },
  { id: `inv_${uuidv4()}`, warehouse_id: whBj.id, sku_id: sku3.id, available_qty: 20, locked_qty: 0 },
  { id: `inv_${uuidv4()}`, warehouse_id: whBj.id, sku_id: sku4.id, available_qty: 50, locked_qty: 0 },
  { id: `inv_${uuidv4()}`, warehouse_id: whBj.id, sku_id: sku5.id, available_qty: 10, locked_qty: 0 },
  { id: `inv_${uuidv4()}`, warehouse_id: whGz.id, sku_id: sku1.id, available_qty: 80, locked_qty: 0 },
  { id: `inv_${uuidv4()}`, warehouse_id: whGz.id, sku_id: sku2.id, available_qty: 60, locked_qty: 0 },
  { id: `inv_${uuidv4()}`, warehouse_id: whGz.id, sku_id: sku3.id, available_qty: 15, locked_qty: 0 },
  { id: `inv_${uuidv4()}`, warehouse_id: whGz.id, sku_id: sku4.id, available_qty: 0, locked_qty: 0 },
  { id: `inv_${uuidv4()}`, warehouse_id: whGz.id, sku_id: sku5.id, available_qty: 0, locked_qty: 0 }
];

console.log('初始化库存数据完成');

const ordersData = [
  {
    order_no: 'SO20250512001',
    customer_name: '张三',
    customer_phone: '13800000001',
    province: '上海市',
    city: '上海市',
    address: '浦东新区张江高科技园区1号',
    shipping_fee: 12,
    lines: [
      { sku_code: 'SKU-001', qty: 2, price: 7999 },
      { sku_code: 'SKU-002', qty: 1, price: 1899 }
    ]
  },
  {
    order_no: 'SO20250512002',
    customer_name: '李四',
    customer_phone: '13800000002',
    province: '江苏省',
    city: '南京市',
    address: '鼓楼区中山路100号',
    shipping_fee: 15,
    lines: [
      { sku_code: 'SKU-003', qty: 1, price: 9499 },
      { sku_code: 'SKU-004', qty: 1, price: 4799 }
    ]
  },
  {
    order_no: 'SO20250512003',
    customer_name: '王五',
    customer_phone: '13800000003',
    province: '浙江省',
    city: '杭州市',
    address: '西湖区文三路388号',
    shipping_fee: 10,
    lines: [
      { sku_code: 'SKU-001', qty: 1, price: 7999 },
      { sku_code: 'SKU-004', qty: 2, price: 4799 },
      { sku_code: 'SKU-005', qty: 1, price: 3199 }
    ]
  },
  {
    order_no: 'SO20250512004',
    customer_name: '赵六',
    customer_phone: '13800000004',
    province: '安徽省',
    city: '合肥市',
    address: '蜀山区长江西路200号',
    shipping_fee: 18,
    lines: [
      { sku_code: 'SKU-002', qty: 3, price: 1899 },
      { sku_code: 'SKU-005', qty: 2, price: 3199 }
    ]
  }
];

for (const orderData of ordersData) {
  const orderId = `ord_${uuidv4()}`;
  let totalAmount = 0;
  const lines = [];

  for (const lineData of orderData.lines) {
    const sku = skus.find(s => s.code === lineData.sku_code);
    const amount = lineData.qty * lineData.price;
    totalAmount += amount;

    lines.push({
      id: `line_${uuidv4()}`,
      order_id: orderId,
      sku_id: sku.id,
      sku_code: sku.code,
      sku_name: sku.name,
      qty: lineData.qty,
      price: lineData.price,
      amount: amount,
      picked_qty: 0,
      shipped_qty: 0,
      status: 'pending',
      created_at: now(),
      updated_at: now()
    });
  }

  store.orders.push({
    id: orderId,
    order_no: orderData.order_no,
    customer_name: orderData.customer_name,
    customer_phone: orderData.customer_phone,
    province: orderData.province,
    city: orderData.city,
    address: orderData.address,
    total_amount: totalAmount,
    shipping_fee: orderData.shipping_fee,
    status: 'pending',
    parent_order_id: null,
    split_count: 0,
    created_at: now(),
    updated_at: now()
  });

  store.order_lines.push(...lines);
  console.log(`创建订单: ${orderData.order_no}, 金额: ${totalAmount}`);
}

saveData();

console.log('\n样例数据初始化完成!\n');

console.log('=== 仓库列表 ===');
store.warehouses.forEach(w => {
  console.log(`  ${w.code}: ${w.name} (${w.province}/${w.city})`);
});

console.log('\n=== SKU 列表 ===');
store.skus.forEach(s => {
  console.log(`  ${s.code}: ${s.name}`);
});

function printInventory(warehouseCode) {
  const wh = store.warehouses.find(w => w.code === warehouseCode);
  console.log(`\n=== ${warehouseCode} 库存 ===`);
  store.inventory
    .filter(inv => inv.warehouse_id === wh.id)
    .forEach(inv => {
      const sku = store.skus.find(s => s.id === inv.sku_id);
      console.log(`  ${sku.code}: 可用${inv.available_qty}, 锁定${inv.locked_qty}`);
    });
}

printInventory('WH-SH');
printInventory('WH-BJ');
printInventory('WH-GZ');

console.log('\n=== 订单列表 ===');
store.orders.forEach(o => {
  console.log(`  ${o.order_no}: ${o.customer_name}, 金额${o.total_amount}, 运费${o.shipping_fee}, 状态${o.status}`);
});
