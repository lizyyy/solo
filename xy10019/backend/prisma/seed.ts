import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('开始初始化数据库...');

  const adminPassword = await bcrypt.hash('admin123', 10);
  const managerPassword = await bcrypt.hash('manager123', 10);
  const operatorPassword = await bcrypt.hash('operator123', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      name: '系统管理员',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
    },
  });
  console.log(`管理员账号已创建: admin / admin123`);

  const store1 = await prisma.store.upsert({
    where: { code: 'STORE001' },
    update: {},
    create: {
      code: 'STORE001',
      name: '总部旗舰店',
      address: '北京市朝阳区建国路88号',
      phone: '010-12345678',
      manager: '张经理',
    },
  });

  const store2 = await prisma.store.upsert({
    where: { code: 'STORE002' },
    update: {},
    create: {
      code: 'STORE002',
      name: '上海分行',
      address: '上海市浦东新区陆家嘴环路1000号',
      phone: '021-87654321',
      manager: '李经理',
    },
  });

  console.log(`示例门店已创建: ${store1.name}, ${store2.name}`);

  const manager = await prisma.user.upsert({
    where: { username: 'manager' },
    update: {},
    create: {
      username: 'manager',
      password: managerPassword,
      name: '门店经理',
      email: 'manager@example.com',
      phone: '13800138001',
      role: UserRole.MANAGER,
      storeId: store1.id,
    },
  });
  console.log(`经理账号已创建: manager / manager123`);

  const operator = await prisma.user.upsert({
    where: { username: 'operator' },
    update: {},
    create: {
      username: 'operator',
      password: operatorPassword,
      name: '库存操作员',
      email: 'operator@example.com',
      phone: '13800138002',
      role: UserRole.OPERATOR,
      storeId: store1.id,
    },
  });
  console.log(`操作员账号已创建: operator / operator123`);

  const products = [
    { sku: 'P001', name: '经典白T恤', barcode: '6900000000001', category: '服装', unit: '件', basePrice: 99, spec: 'M码 白色' },
    { sku: 'P002', name: '休闲牛仔裤', barcode: '6900000000002', category: '服装', unit: '条', basePrice: 199, spec: '30码 蓝色' },
    { sku: 'P003', name: '运动鞋', barcode: '6900000000003', category: '鞋类', unit: '双', basePrice: 299, spec: '42码 黑色' },
    { sku: 'P004', name: '时尚双肩包', barcode: '6900000000004', category: '箱包', unit: '个', basePrice: 159, spec: '黑色 25L' },
    { sku: 'P005', name: '智能手表', barcode: '6900000000005', category: '电子', unit: '只', basePrice: 1299, spec: '黑色 44mm' },
    { sku: 'P006', name: '无线耳机', barcode: '6900000000006', category: '电子', unit: '副', basePrice: 599, spec: '白色' },
    { sku: 'P007', name: '保温杯', barcode: '6900000000007', category: '家居', unit: '个', basePrice: 89, spec: '500ml 黑色' },
    { sku: 'P008', name: '雨伞', barcode: '6900000000008', category: '家居', unit: '把', basePrice: 49, spec: '黑色 三折' },
    { sku: 'P009', name: '笔记本', barcode: '6900000000009', category: '文具', unit: '本', basePrice: 25, spec: 'A5 100页' },
    { sku: 'P010', name: '钢笔', barcode: '6900000000010', category: '文具', unit: '支', basePrice: 35, spec: '黑色 0.5mm' },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: product,
    });
  }
  console.log(`示例商品已创建: ${products.length} 个`);

  const createdProducts = await prisma.product.findMany();

  for (const product of createdProducts) {
    const qty1 = Math.floor(Math.random() * 100) + 10;
    const qty2 = Math.floor(Math.random() * 50) + 5;
    const price1 = Number(product.basePrice) * (0.9 + Math.random() * 0.2);
    const price2 = Number(product.basePrice) * (0.9 + Math.random() * 0.2);

    await prisma.inventory.upsert({
      where: { storeId_productId: { storeId: store1.id, productId: product.id } },
      update: {},
      create: {
        storeId: store1.id,
        productId: product.id,
        quantity: qty1,
        availableQty: qty1,
        lockedQty: 0,
        price: price1.toFixed(2),
      },
    });

    await prisma.inventory.upsert({
      where: { storeId_productId: { storeId: store2.id, productId: product.id } },
      update: {},
      create: {
        storeId: store2.id,
        productId: product.id,
        quantity: qty2,
        availableQty: qty2,
        lockedQty: 0,
        price: price2.toFixed(2),
      },
    });
  }
  console.log(`示例库存数据已创建`);

  console.log('\n==============================');
  console.log('数据库初始化完成！');
  console.log('==============================');
  console.log('');
  console.log('默认账号:');
  console.log('  管理员: admin / admin123');
  console.log('  经理:   manager / manager123');
  console.log('  操作员: operator / operator123');
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
