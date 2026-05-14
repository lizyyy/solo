import { run, get, all } from './database';
import { subDays } from 'date-fns';

export async function seedData() {
  console.log('开始导入样例数据...');

  const existingFamilies = await get('SELECT COUNT(*) as count FROM families') as any;
  if (existingFamilies && existingFamilies.count > 0) {
    console.log('数据已存在，跳过导入');
    return;
  }

  const families = [
    { familyId: 'F001', name: '张三家庭', members: 3, address: '幸福街道1号', phone: '13800138001', status: 'approved' },
    { familyId: 'F002', name: '李四家庭', members: 2, address: '和谐路2号', phone: '13800138002', status: 'approved' },
    { familyId: 'F003', name: '王五家庭', members: 4, address: '友爱巷3号', phone: '13800138003', status: 'approved' },
    { familyId: 'F004', name: '赵六家庭', members: 1, address: '和平路4号', phone: '13800138004', status: 'pending' },
    { familyId: 'F005', name: '钱七家庭', members: 5, address: '团结街5号', phone: '13800138005', status: 'approved' },
    { familyId: 'F006', name: '孙八家庭', members: 2, address: '民主路6号', phone: '13800138006', status: 'approved' },
    { familyId: 'F007', name: '周九家庭', members: 3, address: '文明巷7号', phone: '13800138007', status: 'rejected' },
    { familyId: 'F008', name: '吴十家庭', members: 2, address: '富强路8号', phone: '13800138008', status: 'approved' },
    { familyId: 'F009', name: '郑十一家庭', members: 4, address: '敬业街9号', phone: '13800138009', status: 'pending' },
    { familyId: 'F010', name: '王十二家庭', members: 3, address: '诚信巷10号', phone: '13800138010', status: 'approved' },
  ];

  for (const f of families) {
    await run(`
      INSERT INTO families (familyId, name, members, address, phone, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [f.familyId, f.name, f.members, f.address, f.phone, f.status, new Date().toISOString(), new Date().toISOString()]);
  }
  console.log(`已导入 ${families.length} 个家庭`);

  const materials = [
    { code: 'M001', name: '大米', unit: '袋', description: '10公斤装东北大米' },
    { code: 'M002', name: '面粉', unit: '袋', description: '5公斤装标准面粉' },
    { code: 'M003', name: '食用油', unit: '桶', description: '5升装调和油' },
  ];

  for (const m of materials) {
    await run(`
      INSERT INTO materials (code, name, unit, description, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `, [m.code, m.name, m.unit, m.description, new Date().toISOString()]);
  }
  console.log(`已导入 ${materials.length} 种物资`);

  const batches = [
    {
      code: 'B001',
      name: '2024年春季发放',
      materialId: 1,
      quantity: 100,
      cycleDays: 30,
      startTime: subDays(new Date(), 10).toISOString(),
      endTime: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active'
    },
    {
      code: 'B002',
      name: '2024年春季发放-油',
      materialId: 3,
      quantity: 80,
      cycleDays: 60,
      startTime: subDays(new Date(), 5).toISOString(),
      endTime: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active'
    },
  ];

  for (const b of batches) {
    const result = await run(`
      INSERT INTO batches (code, name, materialId, quantity, cycleDays, startTime, endTime, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [b.code, b.name, b.materialId, b.quantity, b.cycleDays, b.startTime, b.endTime, b.status, new Date().toISOString()]);
    
    await run(`
      INSERT INTO inventory (materialId, batchId, totalQuantity, availableQuantity, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `, [b.materialId, result.lastID, b.quantity, b.quantity, new Date().toISOString()]);
  }
  console.log(`已导入 ${batches.length} 个批次`);

  const now = new Date();
  
  const distributions = [
    { familyId: 1, batchId: 1, quantity: 1, status: 'distributed', distributor: '张志愿者', distributeTime: subDays(now, 5).toISOString(), isProxy: false },
    { familyId: 2, batchId: 1, quantity: 1, status: 'distributed', distributor: '李志愿者', distributeTime: subDays(now, 4).toISOString(), isProxy: false },
    { familyId: 3, batchId: 1, quantity: 2, status: 'distributed', distributor: '王志愿者', distributeTime: subDays(now, 3).toISOString(), isProxy: true, proxyName: '刘代理', proxyIdCard: '110101199001011234', proxyProof: true },
    { familyId: 5, batchId: 1, quantity: 2, status: 'distributed', distributor: '赵志愿者', distributeTime: subDays(now, 2).toISOString(), isProxy: false },
    { familyId: 6, batchId: 1, quantity: 1, status: 'pending', isProxy: true, proxyName: '孙代领', proxyIdCard: '110101199002021234', proxyProof: false, needReview: true },
    { familyId: 8, batchId: 2, quantity: 1, status: 'distributed', distributor: '钱志愿者', distributeTime: subDays(now, 1).toISOString(), isProxy: false },
  ];

  for (const d of distributions) {
    const distributionNo = `DIS${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const result = await run(`
      INSERT INTO distributions (
        distributionNo, familyId, batchId, quantity, status,
        distributor, distributeTime, isProxy, proxyName, proxyIdCard, proxyProof,
        needReview, reviewStatus, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      distributionNo,
      d.familyId, d.batchId, d.quantity, d.status,
      d.distributor || null, d.distributeTime || null,
      d.isProxy ? 1 : 0, d.proxyName || null, d.proxyIdCard || null, d.proxyProof ? 1 : 0,
      d.needReview ? 1 : 0, d.status === 'distributed' ? 'approved' : 'pending',
      new Date().toISOString()
    ]);

    if (d.status === 'distributed') {
      await run(`
        UPDATE inventory 
        SET distributedQuantity = distributedQuantity + ?,
            availableQuantity = availableQuantity - ?,
            updatedAt = ?
        WHERE batchId = ?
      `, [d.quantity, d.quantity, new Date().toISOString(), d.batchId]);

      await run(`
        INSERT INTO distribution_history (distributionId, action, operator, details, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `, [result.lastID, 'create', d.distributor || 'system', '创建发放记录', d.distributeTime]);
      
      await run(`
        INSERT INTO distribution_history (distributionId, action, operator, details, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `, [result.lastID, 'approve', d.distributor || 'system', `审核通过，发放物资`, d.distributeTime]);
    }
  }
  console.log(`已导入 ${distributions.length} 条发放记录`);

  const blockedDistributions = [
    { familyId: 1, batchId: 1, quantity: 1, blockReason: '该家庭已在本批次中领取过物资，不能重复领取' },
  ];

  for (const d of blockedDistributions) {
    const distributionNo = `BLK${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    await run(`
      INSERT INTO distributions (
        distributionNo, familyId, batchId, quantity, status,
        isProxy, blockReason, needReview, reviewStatus, createdAt
      ) VALUES (?, ?, ?, ?, 'blocked', 0, ?, 0, 'pending', ?)
    `, [distributionNo, d.familyId, d.batchId, d.quantity, d.blockReason, new Date().toISOString()]);
  }
  console.log(`已导入 ${blockedDistributions.length} 条拦截记录（重复领取样例）`);

  console.log('样例数据导入完成！');
}
