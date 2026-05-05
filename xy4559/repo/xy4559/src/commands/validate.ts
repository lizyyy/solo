import { getDb, ValidationIssue } from '../db';
import { generateBatchId } from '../utils/csvReader';

export interface ValidateOptions {
  batch?: string;
  checks?: string[];
}

export interface ValidationResult {
  batchId: string;
  totalIssues: number;
  highSeverity: number;
  mediumSeverity: number;
  lowSeverity: number;
  issues: ValidationIssue[];
}

interface InventoryRecord {
  id: number;
  item_id: string;
  item_name: string;
  item_type: string;
  box_number: string;
  status: string;
  is_fragile: number;
  description: string;
}

interface MaintenanceRecord {
  id: number;
  maintenance_id: string;
  item_id: string;
  item_name: string;
  issue_description: string;
  report_date: string;
  repair_status: string;
  repair_person: string;
  repair_date: string;
  notes: string;
}

interface PackingRecord {
  id: number;
  scan_id: string;
  scan_time: string;
  item_id: string;
  item_name: string;
  box_number: string;
  scanner: string;
  status: string;
}

interface ShowRecord {
  id: number;
  show_id: string;
  show_date: string;
  show_time: string;
  venue: string;
  play_title: string;
  required_items: string;
  required_puppets: string;
  status: string;
}

interface VehicleRecord {
  id: number;
  plan_id: string;
  vehicle_number: string;
  vehicle_type: string;
  driver_name: string;
  departure_time: string;
  arrival_time: string;
  origin: string;
  destination: string;
  cargo_items: string;
  status: string;
}

const DEFAULT_CHECKS = [
  'missing-parts',
  'unrepaired-items',
  'wrong-box',
  'show-mismatch',
  'vehicle-conflict'
];

function checkMissingParts(
  inventory: InventoryRecord[],
  packing: PackingRecord[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const packedItemIds = new Set(packing.map(p => p.item_id));

  for (const item of inventory) {
    if (!packedItemIds.has(item.item_id)) {
      issues.push({
        issueType: 'missing-part',
        severity: 'high',
        description: `物品 ${item.item_name} (编号: ${item.item_id}) 在清单中但未装箱`,
        relatedItem: item.item_id,
        relatedBox: item.box_number,
        validationBatch: '',
        createdAt: new Date().toISOString()
      });
    }
  }

  for (const packed of packing) {
    const exists = inventory.some(i => i.item_id === packed.item_id);
    if (!exists) {
      issues.push({
        issueType: 'extra-item',
        severity: 'medium',
        description: `物品 ${packed.item_name || packed.item_id} 已装箱但不在清单中`,
        relatedItem: packed.item_id,
        relatedBox: packed.box_number,
        validationBatch: '',
        createdAt: new Date().toISOString()
      });
    }
  }

  return issues;
}

function checkUnrepairedItems(
  inventory: InventoryRecord[],
  maintenance: MaintenanceRecord[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  const fragileItems = inventory.filter(i => i.is_fragile === 1);
  const unrepairedRecords = maintenance.filter(m => 
    m.repair_status === '待修' || m.repair_status === '维修中' ||
    m.repair_status === 'pending' || m.repair_status === 'processing'
  );

  for (const record of unrepairedRecords) {
    const item = inventory.find(i => i.item_id === record.item_id);
    const isFragile = item?.is_fragile === 1;
    
    issues.push({
      issueType: isFragile ? 'unrepaired-fragile' : 'unrepaired-item',
      severity: isFragile ? 'high' : 'medium',
      description: `${isFragile ? '易损件' : '物品'} ${record.item_name || record.item_id} 维修状态为 "${record.repair_status}"，问题: ${record.issue_description}`,
      relatedItem: record.item_id,
      validationBatch: '',
      createdAt: new Date().toISOString()
    });
  }

  return issues;
}

function checkWrongBox(
  inventory: InventoryRecord[],
  packing: PackingRecord[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const inventoryMap = new Map(inventory.map(i => [i.item_id, i]));

  for (const packed of packing) {
    const inventoryItem = inventoryMap.get(packed.item_id);
    if (inventoryItem && inventoryItem.box_number !== packed.box_number) {
      issues.push({
        issueType: 'wrong-box',
        severity: 'high',
        description: `物品 ${packed.item_name || packed.item_id} 装箱箱号错误: 清单指定箱号 ${inventoryItem.box_number}，实际装箱 ${packed.box_number}`,
        relatedItem: packed.item_id,
        relatedBox: packed.box_number,
        validationBatch: '',
        createdAt: new Date().toISOString()
      });
    }
  }

  return issues;
}

function checkShowMismatch(
  shows: ShowRecord[],
  inventory: InventoryRecord[],
  packing: PackingRecord[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const packedItemIds = new Set(packing.map(p => p.item_id));
  const packedItemNames = new Set(packing.map(p => p.item_name?.toLowerCase()));

  for (const show of shows) {
    const requiredItemsText = show.required_items || '';
    const requiredPuppetsText = show.required_puppets || '';
    
    const allRequired = [
      ...requiredItemsText.split(/[,，;；]/).map(s => s.trim()).filter(s => s),
      ...requiredPuppetsText.split(/[,，;；]/).map(s => s.trim()).filter(s => s)
    ];

    for (const required of allRequired) {
      const requiredLower = required.toLowerCase();
      
      const matchedById = inventory.some(i => 
        i.item_id.toLowerCase() === requiredLower
      );
      
      const matchedByName = inventory.some(i => 
        i.item_name.toLowerCase().includes(requiredLower) ||
        requiredLower.includes(i.item_name.toLowerCase())
      );

      const isPackedById = packedItemIds.has(required);
      const isPackedByName = Array.from(packedItemNames).some(name => 
        name.includes(requiredLower) || requiredLower.includes(name)
      );

      if (!matchedById && !matchedByName) {
        issues.push({
          issueType: 'show-item-not-found',
          severity: 'high',
          description: `演出 "${show.play_title}" (${show.show_date} ${show.venue}) 需要的物品 "${required}" 不在库存清单中`,
          relatedShow: show.show_id,
          validationBatch: '',
          createdAt: new Date().toISOString()
        });
      } else if (!isPackedById && !isPackedByName) {
        issues.push({
          issueType: 'show-item-not-packed',
          severity: 'high',
          description: `演出 "${show.play_title}" (${show.show_date} ${show.venue}) 需要的物品 "${required}" 未装箱`,
          relatedShow: show.show_id,
          relatedItem: required,
          validationBatch: '',
          createdAt: new Date().toISOString()
        });
      }
    }
  }

  return issues;
}

function checkVehicleConflict(vehicles: VehicleRecord[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  const vehicleGroups = new Map<string, VehicleRecord[]>();
  for (const vehicle of vehicles) {
    if (!vehicleGroups.has(vehicle.vehicle_number)) {
      vehicleGroups.set(vehicle.vehicle_number, []);
    }
    vehicleGroups.get(vehicle.vehicle_number)!.push(vehicle);
  }

  for (const [vehicleNum, plans] of vehicleGroups) {
    if (plans.length <= 1) continue;

    for (let i = 0; i < plans.length; i++) {
      for (let j = i + 1; j < plans.length; j++) {
        const planA = plans[i];
        const planB = plans[j];
        
        const conflict = checkTimeOverlap(
          planA.departure_time, planA.arrival_time,
          planB.departure_time, planB.arrival_time
        );

        if (conflict) {
          issues.push({
            issueType: 'vehicle-time-conflict',
            severity: 'high',
            description: `车辆 ${vehicleNum} 存在时间冲突: 计划 #${planA.plan_id} (${planA.departure_time} ~ ${planA.arrival_time || '未设置到达'}) 与计划 #${planB.plan_id} (${planB.departure_time} ~ ${planB.arrival_time || '未设置到达'}) 时段重叠`,
            relatedVehicle: vehicleNum,
            validationBatch: '',
            createdAt: new Date().toISOString()
          });
        }
      }
    }
  }

  return issues;
}

function checkTimeOverlap(
  startA: string, endA: string,
  startB: string, endB: string
): boolean {
  try {
    const parseTime = (timeStr: string): Date => {
      if (!timeStr) return new Date(0);
      const date = new Date(timeStr);
      if (!isNaN(date.getTime())) return date;
      return new Date(0);
    };

    const aStart = parseTime(startA);
    const aEnd = endA ? parseTime(endA) : new Date(aStart.getTime() + 3600000);
    const bStart = parseTime(startB);
    const bEnd = endB ? parseTime(endB) : new Date(bStart.getTime() + 3600000);

    return aStart < bEnd && bStart < aEnd;
  } catch {
    return false;
  }
}

export async function validateData(options: ValidateOptions): Promise<ValidationResult> {
  const { checks = DEFAULT_CHECKS } = options;
  const batchId = options.batch || generateBatchId();
  const db = getDb();

  console.log('开始数据验证...');
  console.log(`验证批次: ${batchId}`);

  const inventory = db.prepare('SELECT * FROM inventory').all() as InventoryRecord[];
  const maintenance = db.prepare('SELECT * FROM maintenance').all() as MaintenanceRecord[];
  const packing = db.prepare('SELECT * FROM packing_scans').all() as PackingRecord[];
  const shows = db.prepare('SELECT * FROM show_schedules').all() as ShowRecord[];
  const vehicles = db.prepare('SELECT * FROM vehicle_plans').all() as VehicleRecord[];

  console.log(`数据统计: 库存 ${inventory.length} 项, 维修记录 ${maintenance.length} 条, 装箱记录 ${packing.length} 条, 演出场次 ${shows.length} 场, 车辆计划 ${vehicles.length} 条`);

  let allIssues: ValidationIssue[] = [];

  if (checks.includes('missing-parts')) {
    console.log('检查: 木偶缺件...');
    const issues = checkMissingParts(inventory, packing);
    allIssues = [...allIssues, ...issues];
    console.log(`  发现 ${issues.length} 个问题`);
  }

  if (checks.includes('unrepaired-items')) {
    console.log('检查: 易损件未修...');
    const issues = checkUnrepairedItems(inventory, maintenance);
    allIssues = [...allIssues, ...issues];
    console.log(`  发现 ${issues.length} 个问题`);
  }

  if (checks.includes('wrong-box')) {
    console.log('检查: 箱号错装...');
    const issues = checkWrongBox(inventory, packing);
    allIssues = [...allIssues, ...issues];
    console.log(`  发现 ${issues.length} 个问题`);
  }

  if (checks.includes('show-mismatch')) {
    console.log('检查: 场次道具不匹配...');
    const issues = checkShowMismatch(shows, inventory, packing);
    allIssues = [...allIssues, ...issues];
    console.log(`  发现 ${issues.length} 个问题`);
  }

  if (checks.includes('vehicle-conflict')) {
    console.log('检查: 同车时段冲突...');
    const issues = checkVehicleConflict(vehicles);
    allIssues = [...allIssues, ...issues];
    console.log(`  发现 ${issues.length} 个问题`);
  }

  for (const issue of allIssues) {
    issue.validationBatch = batchId;
  }

  if (allIssues.length > 0) {
    console.log(`\n保存验证问题到数据库...`);
    const insertStmt = db.prepare(`
      INSERT INTO validation_issues 
      (issue_type, severity, description, related_item, related_box, related_show, related_vehicle, validation_batch, created_at)
      VALUES (@issueType, @severity, @description, @relatedItem, @relatedBox, @relatedShow, @relatedVehicle, @validationBatch, @createdAt)
    `);

    const transaction = db.transaction((items: ValidationIssue[]) => {
      for (const item of items) {
        insertStmt.run({
          issueType: item.issueType,
          severity: item.severity,
          description: item.description,
          relatedItem: item.relatedItem,
          relatedBox: item.relatedBox,
          relatedShow: item.relatedShow,
          relatedVehicle: item.relatedVehicle,
          validationBatch: item.validationBatch,
          createdAt: item.createdAt
        });
      }
    });

    transaction(allIssues);
  }

  const highCount = allIssues.filter(i => i.severity === 'high').length;
  const mediumCount = allIssues.filter(i => i.severity === 'medium').length;
  const lowCount = allIssues.filter(i => i.severity === 'low').length;

  console.log('\n' + '='.repeat(60));
  console.log('验证结果汇总');
  console.log('='.repeat(60));
  console.log(`总问题数: ${allIssues.length}`);
  console.log(`  高风险: ${highCount}`);
  console.log(`  中风险: ${mediumCount}`);
  console.log(`  低风险: ${lowCount}`);

  if (allIssues.length > 0) {
    console.log('\n问题详情:');
    for (const issue of allIssues) {
      const severityLabel = issue.severity === 'high' ? '🔴 高' : 
                           issue.severity === 'medium' ? '🟡 中' : '🟢 低';
      console.log(`\n  [${severityLabel}] ${issue.description}`);
    }
  }

  return {
    batchId,
    totalIssues: allIssues.length,
    highSeverity: highCount,
    mediumSeverity: mediumCount,
    lowSeverity: lowCount,
    issues: allIssues
  };
}
