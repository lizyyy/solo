import { materialService } from './MaterialService';
import { db } from '../models/database';
import { v4 as uuidv4 } from 'uuid';

const admin = { id: 'test-admin', name: '测试管理员', role: 'admin' as const };
const manager = { id: 'test-manager', name: '测试经理', role: 'manager' as const };
const operator = { id: 'test-operator', name: '测试操作员', role: 'operator' as const };

describe('MaterialService - 幂等性测试', () => {
  beforeEach(async () => {
    await db.run('DELETE FROM materials');
    await db.run('DELETE FROM booths');
    await db.run('DELETE FROM borrow_records');
    await db.run('DELETE FROM audit_logs');
    await db.run('DELETE FROM idempotent_requests');
    await db.run('DELETE FROM damage_reports');
  });

  test('重复导入请求应返回相同结果，不重复增加库存', async () => {
    const csvContent = 'code,type,name,specs,totalQuantity\nTRUSS001,truss,桁架,4米,10\nLIGHT001,light,帕灯,LED,20';
    const requestId = uuidv4();

    const result1 = await materialService.importMaterials(csvContent, admin, requestId);
    expect(result1.success).toBe(true);
    expect(result1.data).toHaveLength(2);

    const result2 = await materialService.importMaterials(csvContent, admin, requestId);
    expect(result2.success).toBe(true);
    expect(result2.isDuplicate).toBe(true);
    expect(result2.data).toEqual(result1.data);

    const materials = await materialService.getMaterials();
    const truss = materials.find(m => m.code === 'TRUSS001');
    expect(truss?.totalQuantity).toBe(10);
    expect(truss?.availableQuantity).toBe(10);
  });

  test('重复借用请求应返回相同结果，不会多扣库存', async () => {
    await db.run(
      `INSERT INTO materials (id, code, type, name, specs, totalQuantity, availableQuantity, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), 'TRUSS001', 'truss', '桁架', '4米', 10, 10, 'normal', Date.now(), Date.now()]
    );
    
    const boothResult = await materialService.createBooth('B001', '展位1', '展商A');
    const boothId = boothResult.data!.id;
    const requestId = uuidv4();

    const result1 = await materialService.occupy('TRUSS001', boothId, 2, operator, requestId);
    expect(result1.success).toBe(true);

    const result2 = await materialService.occupy('TRUSS001', boothId, 2, operator, requestId);
    expect(result2.success).toBe(true);
    expect(result2.isDuplicate).toBe(true);

    const materials = await materialService.getMaterials();
    const truss = materials.find(m => m.code === 'TRUSS001');
    expect(truss?.availableQuantity).toBe(8);
  });
});

describe('MaterialService - 业务规则测试', () => {
  beforeEach(async () => {
    await db.run('DELETE FROM materials');
    await db.run('DELETE FROM booths');
    await db.run('DELETE FROM borrow_records');
    await db.run('DELETE FROM audit_logs');
    await db.run('DELETE FROM idempotent_requests');
    await db.run('DELETE FROM damage_reports');
  });

  test('角色权限校验 - operator不能执行import操作', async () => {
    const csvContent = 'code,type,name,specs,totalQuantity\nTRUSS001,truss,桁架,4米,10';
    const requestId = uuidv4();

    const result = await materialService.importMaterials(csvContent, operator, requestId);
    expect(result.success).toBe(false);
    expect(result.code).toBe('IMPORT_PERMISSION_DENIED');
  });

  test('库存不足时借用应被拒绝', async () => {
    await db.run(
      `INSERT INTO materials (id, code, type, name, specs, totalQuantity, availableQuantity, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), 'TRUSS001', 'truss', '桁架', '4米', 5, 5, 'normal', Date.now(), Date.now()]
    );
    
    const boothResult = await materialService.createBooth('B001', '展位1', '展商A');
    const boothId = boothResult.data!.id;

    const result = await materialService.occupy('TRUSS001', boothId, 10, operator, uuidv4());
    expect(result.success).toBe(false);
    expect(result.code).toBe('INSUFFICIENT_STOCK');
  });

  test('归还数量不能超过借用数量', async () => {
    await db.run(
      `INSERT INTO materials (id, code, type, name, specs, totalQuantity, availableQuantity, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), 'TRUSS001', 'truss', '桁架', '4米', 10, 10, 'normal', Date.now(), Date.now()]
    );
    
    const boothResult = await materialService.createBooth('B001', '展位1', '展商A');
    const boothId = boothResult.data!.id;

    const occupyResult = await materialService.occupy('TRUSS001', boothId, 2, operator, uuidv4());
    const recordId = occupyResult.data!.id;

    const returnResult = await materialService.return(recordId, 5, operator, uuidv4());
    expect(returnResult.success).toBe(false);
    expect(returnResult.code).toBe('EXCESS_RETURN_QUANTITY');
  });

  test('损坏物资应正确扣减总库存和可用库存', async () => {
    await db.run(
      `INSERT INTO materials (id, code, type, name, specs, totalQuantity, availableQuantity, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), 'TRUSS001', 'truss', '桁架', '4米', 10, 10, 'normal', Date.now(), Date.now()]
    );
    
    const boothResult = await materialService.createBooth('B001', '展位1', '展商A');
    const boothId = boothResult.data!.id;

    const occupyResult = await materialService.occupy('TRUSS001', boothId, 3, operator, uuidv4());
    const recordId = occupyResult.data!.id;

    const damageResult = await materialService.reportDamage(
      recordId, 1, 'broken', '桁架断裂', 500, manager, uuidv4()
    );
    expect(damageResult.success).toBe(true);

    const materials = await materialService.getMaterials();
    const truss = materials.find(m => m.code === 'TRUSS001');
    expect(truss?.totalQuantity).toBe(9);
    expect(truss?.availableQuantity).toBe(7);
  });

  test('回滚操作应恢复库存', async () => {
    await db.run(
      `INSERT INTO materials (id, code, type, name, specs, totalQuantity, availableQuantity, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), 'TRUSS001', 'truss', '桁架', '4米', 10, 10, 'normal', Date.now(), Date.now()]
    );
    
    const boothResult = await materialService.createBooth('B001', '展位1', '展商A');
    const boothId = boothResult.data!.id;

    const occupyResult = await materialService.occupy('TRUSS001', boothId, 2, operator, uuidv4());
    const recordId = occupyResult.data!.id;

    const materialsAfterOccupy = await materialService.getMaterials();
    expect(materialsAfterOccupy.find(m => m.code === 'TRUSS001')?.availableQuantity).toBe(8);

    const rollbackResult = await materialService.rollback(recordId, admin, uuidv4());
    expect(rollbackResult.success).toBe(true);

    const materialsAfterRollback = await materialService.getMaterials();
    expect(materialsAfterRollback.find(m => m.code === 'TRUSS001')?.availableQuantity).toBe(10);
  });

  test('审计日志应正确记录所有操作', async () => {
    await db.run(
      `INSERT INTO materials (id, code, type, name, specs, totalQuantity, availableQuantity, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), 'TRUSS001', 'truss', '桁架', '4米', 10, 10, 'normal', Date.now(), Date.now()]
    );
    
    const boothResult = await materialService.createBooth('B001', '展位1', '展商A');
    const boothId = boothResult.data!.id;

    await materialService.occupy('TRUSS001', boothId, 2, operator, uuidv4());

    const logs = await db.all('SELECT * FROM audit_logs');
    expect(logs).toHaveLength(1);
    expect(logs[0].operationType).toBe('occupy');
    expect(logs[0].operatorId).toBe('test-operator');
    expect(logs[0].result).toBe('approved');
  });
});
