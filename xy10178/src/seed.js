const { sequelize, Claim, ClaimVersion } = require('./models');

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    await sequelize.sync({ force: true });
    console.log('数据库已重置');
    
    const claimsData = [
      {
        caseNumber: 'CLAIM-2026-001',
        totalAmount: 10000.00,
        description: '商品破损赔付案件 - 客户收到包裹时发现商品破损',
        status: 'REVIEWING',
        currentVersion: 2,
        versions: [
          {
            version: 1,
            merchantRatio: 0.5,
            warehouseRatio: 0.3,
            deliveryRatio: 0.2,
            merchantAmount: 5000.00,
            warehouseAmount: 3000.00,
            deliveryAmount: 2000.00,
            status: 'REVIEWING',
            createdBy: 'user_zhang'
          },
          {
            version: 2,
            merchantRatio: 0.4,
            warehouseRatio: 0.4,
            deliveryRatio: 0.2,
            merchantAmount: 4000.00,
            warehouseAmount: 4000.00,
            deliveryAmount: 2000.00,
            status: 'REVIEWING',
            createdBy: 'user_li'
          }
        ]
      },
      {
        caseNumber: 'CLAIM-2026-002',
        totalAmount: 5500.00,
        description: '延迟配送赔付 - 生鲜商品配送超时导致变质',
        status: 'ALLOCATED',
        currentVersion: 1,
        versions: [
          {
            version: 1,
            merchantRatio: 0.0,
            warehouseRatio: 0.0,
            deliveryRatio: 1.0,
            merchantAmount: 0.00,
            warehouseAmount: 0.00,
            deliveryAmount: 5500.00,
            status: 'ALLOCATED',
            createdBy: 'user_wang'
          }
        ]
      },
      {
        caseNumber: 'CLAIM-2026-003',
        totalAmount: 8000.00,
        description: '商品短缺赔付 - 客户收到的商品数量与订单不符',
        status: 'PENDING',
        currentVersion: 1,
        versions: [
          {
            version: 1,
            merchantRatio: 0.0,
            warehouseRatio: 0.0,
            deliveryRatio: 0.0,
            merchantAmount: 0.00,
            warehouseAmount: 0.00,
            deliveryAmount: 0.00,
            status: 'PENDING',
            createdBy: 'system'
          }
        ]
      },
      {
        caseNumber: 'CLAIM-2026-004',
        totalAmount: 15000.00,
        description: '高额赔付案件 - 电子产品运输损坏',
        status: 'CONFIRMED',
        currentVersion: 3,
        versions: [
          {
            version: 1,
            merchantRatio: 0.6,
            warehouseRatio: 0.2,
            deliveryRatio: 0.2,
            merchantAmount: 9000.00,
            warehouseAmount: 3000.00,
            deliveryAmount: 3000.00,
            status: 'CONFIRMED',
            createdBy: 'user_zhang'
          },
          {
            version: 2,
            merchantRatio: 0.5,
            warehouseRatio: 0.3,
            deliveryRatio: 0.2,
            merchantAmount: 7500.00,
            warehouseAmount: 4500.00,
            deliveryAmount: 3000.00,
            status: 'CONFIRMED',
            createdBy: 'user_li'
          },
          {
            version: 3,
            merchantRatio: 0.4,
            warehouseRatio: 0.35,
            deliveryRatio: 0.25,
            merchantAmount: 6000.00,
            warehouseAmount: 5250.00,
            deliveryAmount: 3750.00,
            status: 'CONFIRMED',
            createdBy: 'user_wang'
          }
        ]
      },
      {
        caseNumber: 'CLAIM-2026-005',
        totalAmount: 3200.00,
        description: '已完成的小额赔付案件',
        status: 'PAID',
        currentVersion: 1,
        versions: [
          {
            version: 1,
            merchantRatio: 0.0,
            warehouseRatio: 1.0,
            deliveryRatio: 0.0,
            merchantAmount: 0.00,
            warehouseAmount: 3200.00,
            deliveryAmount: 0.00,
            status: 'PAID',
            createdBy: 'user_li'
          }
        ]
      },
      {
        caseNumber: 'CLAIM-2026-006',
        totalAmount: 6800.00,
        description: '已取消的案件 - 客户撤销投诉',
        status: 'CANCELLED',
        currentVersion: 1,
        versions: [
          {
            version: 1,
            merchantRatio: 0.5,
            warehouseRatio: 0.5,
            deliveryRatio: 0.0,
            merchantAmount: 3400.00,
            warehouseAmount: 3400.00,
            deliveryAmount: 0.00,
            status: 'CANCELLED',
            createdBy: 'user_zhang'
          }
        ]
      }
    ];
    
    for (const claimData of claimsData) {
      const versions = claimData.versions;
      delete claimData.versions;
      
      const claim = await Claim.create(claimData);
      
      for (const versionData of versions) {
        await ClaimVersion.create({
          claimId: claim.id,
          ...versionData
        });
      }
    }
    
    console.log('种子数据插入完成！');
    console.log(`共创建 ${claimsData.length} 个案件`);
    console.log('\n案件列表：');
    claimsData.forEach(c => {
      console.log(`  - ${c.caseNumber} (状态: ${c.status}, 金额: ¥${c.totalAmount.toFixed(2)})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('种子数据插入失败:', error);
    process.exit(1);
  }
}

seed();
