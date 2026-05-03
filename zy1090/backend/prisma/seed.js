import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始种子数据...');

  // 1. 创建供应商
  const suppliers = await Promise.all([
    prisma.supplier.create({
      data: {
        name: '天然蜡业有限公司',
        contact: '张经理',
        phone: '13800138001',
        email: 'zhang@natural-wax.com',
        address: '广东省广州市白云区工业区A区',
        note: '主营大豆蜡、蜂蜡'
      }
    }),
    prisma.supplier.create({
      data: {
        name: '香氛世界',
        contact: '李女士',
        phone: '13900139002',
        email: 'li@fragrance-world.com',
        address: '上海市浦东新区张江高科技园区',
        note: '进口香精供应商'
      }
    }),
    prisma.supplier.create({
      data: {
        name: '包装精品厂',
        contact: '王工',
        phone: '13700137003',
        email: 'wang@packaging.com',
        address: '浙江省义乌市包装工业园',
        note: '包装盒、容器供应商'
      }
    })
  ]);

  console.log('✅ 供应商创建完成');

  // 2. 创建材料分类
  const categories = await Promise.all([
    prisma.materialCategory.create({ data: { name: '蜡类', description: '各种蜡材料' } }),
    prisma.materialCategory.create({ data: { name: '香精', description: '香氛香料' } }),
    prisma.materialCategory.create({ data: { name: '包装', description: '包装材料' } }),
    prisma.materialCategory.create({ data: { name: '其他', description: '其他材料' } })
  ]);

  console.log('✅ 材料分类创建完成');

  // 3. 创建材料
  const materials = await Promise.all([
    prisma.material.create({
      data: {
        name: '大豆蜡',
        unit: 'g',
        allergens: '',
        categoryId: categories[0].id,
        description: '纯天然大豆蜡，熔点适中'
      }
    }),
    prisma.material.create({
      data: {
        name: '蜂蜡',
        unit: 'g',
        allergens: '蜂产品',
        categoryId: categories[0].id,
        description: '天然蜂蜡，增加硬度'
      }
    }),
    prisma.material.create({
      data: {
        name: '薰衣草香精',
        unit: 'ml',
        allergens: '香精',
        categoryId: categories[1].id,
        description: '法国进口薰衣草香精'
      }
    }),
    prisma.material.create({
      data: {
        name: '柠檬香精',
        unit: 'ml',
        allergens: '柑橘类',
        categoryId: categories[1].id,
        description: '天然柠檬香氛'
      }
    }),
    prisma.material.create({
      data: {
        name: '玻璃杯（小）',
        unit: '个',
        allergens: '',
        categoryId: categories[2].id,
        description: '50ml 透明玻璃杯'
      }
    }),
    prisma.material.create({
      data: {
        name: '玻璃杯（中）',
        unit: '个',
        allergens: '',
        categoryId: categories[2].id,
        description: '100ml 透明玻璃杯'
      }
    }),
    prisma.material.create({
      data: {
        name: '蜡烛芯',
        unit: '根',
        allergens: '',
        categoryId: categories[3].id,
        description: '纯棉烛芯，适用于50-100ml容器'
      }
    }),
    prisma.material.create({
      data: {
        name: '礼品盒',
        unit: '个',
        allergens: '',
        categoryId: categories[2].id,
        description: '精美礼品包装盒'
      }
    })
  ]);

  console.log('✅ 材料创建完成');

  // 4. 创建材料批次
  const materialBatches = await Promise.all([
    // 大豆蜡批次1 - 近期批次
    prisma.materialBatch.create({
      data: {
        materialId: materials[0].id,
        supplierId: suppliers[0].id,
        batchNumber: 'WAX-2026-001',
        quantity: 5000,
        remainingQuantity: 5000,
        unitPrice: 0.05,
        totalPrice: 250,
        unit: 'g',
        receivedDate: new Date('2026-04-01'),
        expiryDate: new Date('2028-04-01'),
        note: '优质大豆蜡，纯白'
      }
    }),
    // 大豆蜡批次2 - 临期批次（3个月内过期）
    prisma.materialBatch.create({
      data: {
        materialId: materials[0].id,
        supplierId: suppliers[0].id,
        batchNumber: 'WAX-2025-099',
        quantity: 2000,
        remainingQuantity: 500,
        unitPrice: 0.045,
        totalPrice: 90,
        unit: 'g',
        receivedDate: new Date('2025-06-01'),
        expiryDate: new Date('2026-06-15'),
        note: '旧批次，促销价'
      }
    }),
    // 蜂蜡
    prisma.materialBatch.create({
      data: {
        materialId: materials[1].id,
        supplierId: suppliers[0].id,
        batchNumber: 'BEES-2026-001',
        quantity: 1000,
        remainingQuantity: 1000,
        unitPrice: 0.15,
        totalPrice: 150,
        unit: 'g',
        receivedDate: new Date('2026-03-15'),
        expiryDate: new Date('2027-03-15'),
        allergens: '蜂产品',
        note: '注意：含蜂产品过敏原'
      }
    }),
    // 薰衣草香精
    prisma.materialBatch.create({
      data: {
        materialId: materials[2].id,
        supplierId: suppliers[1].id,
        batchNumber: 'LAV-2026-010',
        quantity: 500,
        remainingQuantity: 500,
        unitPrice: 0.8,
        totalPrice: 400,
        unit: 'ml',
        receivedDate: new Date('2026-04-10'),
        expiryDate: new Date('2028-04-10'),
        allergens: '香精',
        note: '高浓度香精，用量约3-5%'
      }
    }),
    // 柠檬香精 - 低库存
    prisma.materialBatch.create({
      data: {
        materialId: materials[3].id,
        supplierId: suppliers[1].id,
        batchNumber: 'LEM-2026-005',
        quantity: 100,
        remainingQuantity: 30,
        unitPrice: 0.75,
        totalPrice: 75,
        unit: 'ml',
        receivedDate: new Date('2026-02-01'),
        expiryDate: new Date('2028-02-01'),
        allergens: '柑橘类',
        note: '库存不足，需补货'
      }
    }),
    // 小玻璃杯
    prisma.materialBatch.create({
      data: {
        materialId: materials[4].id,
        supplierId: suppliers[2].id,
        batchNumber: 'GLASS-S-2026-001',
        quantity: 200,
        remainingQuantity: 200,
        unitPrice: 2.5,
        totalPrice: 500,
        unit: '个',
        receivedDate: new Date('2026-03-20'),
        note: '50ml圆柱玻璃杯'
      }
    }),
    // 中玻璃杯
    prisma.materialBatch.create({
      data: {
        materialId: materials[5].id,
        supplierId: suppliers[2].id,
        batchNumber: 'GLASS-M-2026-001',
        quantity: 150,
        remainingQuantity: 150,
        unitPrice: 3.8,
        totalPrice: 570,
        unit: '个',
        receivedDate: new Date('2026-03-20'),
        note: '100ml圆柱玻璃杯'
      }
    }),
    // 蜡烛芯
    prisma.materialBatch.create({
      data: {
        materialId: materials[6].id,
        supplierId: suppliers[2].id,
        batchNumber: 'WICK-2026-001',
        quantity: 500,
        remainingQuantity: 500,
        unitPrice: 0.2,
        totalPrice: 100,
        unit: '根',
        receivedDate: new Date('2026-03-10'),
        note: '纯棉烛芯带底座'
      }
    }),
    // 礼品盒
    prisma.materialBatch.create({
      data: {
        materialId: materials[7].id,
        supplierId: suppliers[2].id,
        batchNumber: 'BOX-2026-001',
        quantity: 100,
        remainingQuantity: 100,
        unitPrice: 5,
        totalPrice: 500,
        unit: '个',
        receivedDate: new Date('2026-04-01'),
        note: '精美礼品盒，可装2个中号蜡烛'
      }
    })
  ]);

  console.log('✅ 材料批次创建完成');

  // 5. 创建产品
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: '薰衣草香薰蜡烛（小）',
        sku: 'CANDLE-LAV-S',
        description: '50ml 薰衣草香氛蜡烛，燃烧约10小时',
        basePrice: 39
      }
    }),
    prisma.product.create({
      data: {
        name: '柠檬香薰蜡烛（中）',
        sku: 'CANDLE-LEM-M',
        description: '100ml 清新柠檬香氛蜡烛，燃烧约20小时',
        basePrice: 69
      }
    }),
    prisma.product.create({
      data: {
        name: '混合香薰礼盒套装',
        sku: 'CANDLE-GIFT-SET',
        description: '含2个中号蜡烛的精美礼盒',
        basePrice: 128
      }
    })
  ]);

  console.log('✅ 产品创建完成');

  // 6. 创建配方
  const recipes = await Promise.all([
    // 薰衣草小蜡烛配方
    prisma.recipe.create({
      data: {
        productId: products[0].id,
        name: '薰衣草小蜡烛标准配方',
        version: 'v1.0',
        yield: 1,
        yieldUnit: '个',
        isDefault: true,
        description: '标准50ml薰衣草蜡烛配方',
        ingredients: {
          create: [
            {
              materialId: materials[0].id, // 大豆蜡
              quantity: 40,
              unit: 'g',
              lossRate: 5,
              sortOrder: 1
            },
            {
              materialId: materials[2].id, // 薰衣草香精
              quantity: 2,
              unit: 'ml',
              lossRate: 0,
              sortOrder: 2
            },
            {
              materialId: materials[4].id, // 小玻璃杯
              quantity: 1,
              unit: '个',
              lossRate: 2,
              sortOrder: 3
            },
            {
              materialId: materials[6].id, // 蜡烛芯
              quantity: 1,
              unit: '根',
              lossRate: 1,
              sortOrder: 4
            }
          ]
        }
      },
      include: { ingredients: true }
    }),
    // 柠檬中蜡烛配方
    prisma.recipe.create({
      data: {
        productId: products[1].id,
        name: '柠檬中蜡烛标准配方',
        version: 'v1.0',
        yield: 1,
        yieldUnit: '个',
        isDefault: true,
        description: '标准100ml柠檬蜡烛配方',
        ingredients: {
          create: [
            {
              materialId: materials[0].id, // 大豆蜡
              quantity: 85,
              unit: 'g',
              lossRate: 5,
              sortOrder: 1
            },
            {
              materialId: materials[1].id, // 蜂蜡
              quantity: 15,
              unit: 'g',
              lossRate: 3,
              sortOrder: 2,
              note: '增加硬度，注意蜂产品过敏原'
            },
            {
              materialId: materials[3].id, // 柠檬香精
              quantity: 4,
              unit: 'ml',
              lossRate: 0,
              sortOrder: 3
            },
            {
              materialId: materials[5].id, // 中玻璃杯
              quantity: 1,
              unit: '个',
              lossRate: 2,
              sortOrder: 4
            },
            {
              materialId: materials[6].id, // 蜡烛芯
              quantity: 1,
              unit: '根',
              lossRate: 1,
              sortOrder: 5
            }
          ]
        }
      },
      include: { ingredients: true }
    })
  ]);

  console.log('✅ 配方创建完成');

  // 7. 创建客户
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        name: '张小姐',
        contact: '张小姐',
        phone: '13600136001',
        email: 'zhang@example.com',
        address: '北京市朝阳区xxx小区',
        note: '老客户，喜欢薰衣草香型'
      }
    }),
    prisma.customer.create({
      data: {
        name: '李女士（企业采购）',
        contact: '李经理',
        phone: '13500135002',
        email: 'li@company.com',
        address: '上海市黄浦区xxx大厦',
        note: '企业客户，定期采购伴手礼'
      }
    })
  ]);

  console.log('✅ 客户创建完成');

  // 8. 创建一些生产批次和订单示例
  // 先生产一批
  const production1 = await prisma.productionBatch.create({
    data: {
      productId: products[0].id,
      batchNumber: 'PROD-LAV-2026-001',
      quantity: 10,
      unit: '个',
      recipeId: recipes[0].id,
      status: 'completed',
      startDate: new Date('2026-04-15'),
      endDate: new Date('2026-04-15'),
      note: '测试生产批次'
    }
  });

  console.log('✅ 生产批次创建完成');

  // 9. 创建订单示例
  const order1 = await prisma.order.create({
    data: {
      orderNumber: 'ORD-2026-001',
      customerId: customers[0].id,
      status: 'completed',
      totalCost: 35,
      totalPrice: 78,
      profit: 43,
      profitMargin: 55.13,
      note: '张小姐的首单，2个薰衣草小蜡烛',
      quotedAt: new Date('2026-04-20'),
      confirmedAt: new Date('2026-04-20'),
      completedAt: new Date('2026-04-22'),
      items: {
        create: [
          {
            productName: '薰衣草香薰蜡烛（小）',
            quantity: 2,
            unit: '个',
            unitCost: 17.5,
            unitPrice: 39,
            totalCost: 35,
            totalPrice: 78,
            profit: 43,
            productionBatchId: production1.id
          }
        ]
      }
    }
  });

  // 创建一个亏损订单示例
  const order2 = await prisma.order.create({
    data: {
      orderNumber: 'ORD-2026-002',
      customerId: customers[1].id,
      status: 'quoted',
      totalCost: 150,
      totalPrice: 120,
      profit: -30,
      profitMargin: -25,
      note: '企业批量报价测试 - 价格过低导致亏损',
      quotedAt: new Date('2026-04-28')
    }
  });

  console.log('✅ 订单创建完成');

  console.log('\n========================================');
  console.log('🎉 种子数据创建完成！');
  console.log('========================================');
  console.log('\n创建的数据统计：');
  console.log(`  - 供应商: ${suppliers.length} 个`);
  console.log(`  - 材料分类: ${categories.length} 个`);
  console.log(`  - 材料: ${materials.length} 个`);
  console.log(`  - 材料批次: ${materialBatches.length} 个`);
  console.log(`  - 产品: ${products.length} 个`);
  console.log(`  - 配方: ${recipes.length} 个`);
  console.log(`  - 客户: ${customers.length} 个`);
  console.log(`  - 订单: 2 个`);
  console.log('\n风险提示数据：');
  console.log('  - 临期材料: 大豆蜡 WAX-2025-099 (2026-06-15过期)');
  console.log('  - 低库存材料: 柠檬香精 LEM-2026-005 (剩余30ml)');
  console.log('  - 亏损订单: ORD-2026-002 (亏损30元)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
