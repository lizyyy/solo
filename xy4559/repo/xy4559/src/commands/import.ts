import { getDb } from '../db';
import { readCsvFile, generateBatchId, CsvRecord } from '../utils/csvReader';

export type ImportType = 'inventory' | 'maintenance' | 'packing' | 'shows' | 'vehicles';

export interface ImportOptions {
  type: ImportType;
  file: string;
  batch?: string;
}

function normalizeFieldName(field: string, possibleNames: string[]): string | null {
  const lowerField = field.toLowerCase();
  for (const name of possibleNames) {
    if (lowerField === name.toLowerCase() || 
        lowerField.includes(name.toLowerCase())) {
      return name;
    }
  }
  return null;
}

function mapInventoryRecord(record: CsvRecord, batchId: string): any {
  const mapping: Record<string, string[]> = {
    itemId: ['物品编号', 'item_id', 'itemId', '编号', '道具编号', '木偶编号'],
    itemName: ['物品名称', 'item_name', 'itemName', '名称', '道具名称', '木偶名称'],
    itemType: ['物品类型', 'item_type', 'itemType', '类型', '分类'],
    boxNumber: ['箱号', 'box_number', 'boxNumber', '装箱编号', '所属箱号'],
    status: ['状态', 'status', '物品状态'],
    isFragile: ['是否易损', 'is_fragile', 'isFragile', '易损件', '易碎'],
    description: ['描述', 'description', '备注', '说明']
  };

  const result: any = {
    import_batch: batchId,
    imported_at: new Date().toISOString()
  };

  for (const [targetField, possibleNames] of Object.entries(mapping)) {
    for (const sourceField of Object.keys(record)) {
      const matched = normalizeFieldName(sourceField, possibleNames);
      if (matched) {
        const snakeField = targetField.replace(/([A-Z])/g, '_$1').toLowerCase();
        const value = record[sourceField];
        
        if (targetField === 'isFragile') {
          result[snakeField] = value === '是' || value === '易损' || value === '易碎' || 
                               value === 'true' || value === '1' ? 1 : 0;
        } else {
          result[snakeField] = value;
        }
        break;
      }
    }
  }

  return result;
}

function mapMaintenanceRecord(record: CsvRecord, batchId: string): any {
  const mapping: Record<string, string[]> = {
    maintenanceId: ['维修编号', 'maintenance_id', 'maintenanceId', '报修编号'],
    itemId: ['物品编号', 'item_id', 'itemId', '道具编号', '木偶编号'],
    itemName: ['物品名称', 'item_name', 'itemName', '道具名称', '木偶名称'],
    issueDescription: ['问题描述', 'issue_description', 'issueDescription', '故障描述', '问题'],
    reportDate: ['报修日期', 'report_date', 'reportDate', '发现日期'],
    repairStatus: ['维修状态', 'repair_status', 'repairStatus', '状态'],
    repairPerson: ['维修人员', 'repair_person', 'repairPerson', '维修人'],
    repairDate: ['维修日期', 'repair_date', 'repairDate', '完成日期'],
    notes: ['备注', 'notes', '说明', '备注信息']
  };

  const result: any = {
    import_batch: batchId,
    imported_at: new Date().toISOString()
  };

  for (const [targetField, possibleNames] of Object.entries(mapping)) {
    for (const sourceField of Object.keys(record)) {
      const matched = normalizeFieldName(sourceField, possibleNames);
      if (matched) {
        const snakeField = targetField.replace(/([A-Z])/g, '_$1').toLowerCase();
        result[snakeField] = record[sourceField];
        break;
      }
    }
  }

  return result;
}

function mapPackingRecord(record: CsvRecord, batchId: string): any {
  const mapping: Record<string, string[]> = {
    scanId: ['扫描编号', 'scan_id', 'scanId', '装箱编号'],
    scanTime: ['扫描时间', 'scan_time', 'scanTime', '装箱时间'],
    itemId: ['物品编号', 'item_id', 'itemId', '道具编号', '木偶编号'],
    itemName: ['物品名称', 'item_name', 'itemName', '道具名称', '木偶名称'],
    boxNumber: ['箱号', 'box_number', 'boxNumber', '装箱编号'],
    scanner: ['扫描人', 'scanner', '装箱人', '操作人'],
    status: ['状态', 'status', '装箱状态']
  };

  const result: any = {
    import_batch: batchId,
    imported_at: new Date().toISOString()
  };

  for (const [targetField, possibleNames] of Object.entries(mapping)) {
    for (const sourceField of Object.keys(record)) {
      const matched = normalizeFieldName(sourceField, possibleNames);
      if (matched) {
        const snakeField = targetField.replace(/([A-Z])/g, '_$1').toLowerCase();
        result[snakeField] = record[sourceField];
        break;
      }
    }
  }

  return result;
}

function mapShowRecord(record: CsvRecord, batchId: string): any {
  const mapping: Record<string, string[]> = {
    showId: ['场次编号', 'show_id', 'showId', '演出编号'],
    showDate: ['演出日期', 'show_date', 'showDate', '日期'],
    showTime: ['演出时间', 'show_time', 'showTime', '时间'],
    venue: ['演出地点', 'venue', '地点', '剧场', '剧院'],
    playTitle: ['剧目名称', 'play_title', 'playTitle', '剧目', '节目名称'],
    requiredItems: ['所需道具', 'required_items', 'requiredItems', '道具清单'],
    requiredPuppets: ['所需木偶', 'required_puppets', 'requiredPuppets', '木偶清单'],
    status: ['状态', 'status', '场次状态']
  };

  const result: any = {
    import_batch: batchId,
    imported_at: new Date().toISOString()
  };

  for (const [targetField, possibleNames] of Object.entries(mapping)) {
    for (const sourceField of Object.keys(record)) {
      const matched = normalizeFieldName(sourceField, possibleNames);
      if (matched) {
        const snakeField = targetField.replace(/([A-Z])/g, '_$1').toLowerCase();
        result[snakeField] = record[sourceField];
        break;
      }
    }
  }

  return result;
}

function mapVehicleRecord(record: CsvRecord, batchId: string): any {
  const mapping: Record<string, string[]> = {
    planId: ['计划编号', 'plan_id', 'planId', '车辆计划编号'],
    vehicleNumber: ['车辆编号', 'vehicle_number', 'vehicleNumber', '车牌号', '车号'],
    vehicleType: ['车辆类型', 'vehicle_type', 'vehicleType', '车型'],
    driverName: ['司机姓名', 'driver_name', 'driverName', '司机', '驾驶员'],
    departureTime: ['出发时间', 'departure_time', 'departureTime', '发车时间'],
    arrivalTime: ['到达时间', 'arrival_time', 'arrivalTime', '预计到达'],
    origin: ['出发地', 'origin', '起点'],
    destination: ['目的地', 'destination', '终点'],
    cargoItems: ['装载物品', 'cargo_items', 'cargoItems', '货物', '装载清单'],
    status: ['状态', 'status', '车辆状态']
  };

  const result: any = {
    import_batch: batchId,
    imported_at: new Date().toISOString()
  };

  for (const [targetField, possibleNames] of Object.entries(mapping)) {
    for (const sourceField of Object.keys(record)) {
      const matched = normalizeFieldName(sourceField, possibleNames);
      if (matched) {
        const snakeField = targetField.replace(/([A-Z])/g, '_$1').toLowerCase();
        result[snakeField] = record[sourceField];
        break;
      }
    }
  }

  return result;
}

export async function importData(options: ImportOptions): Promise<void> {
  const { type, file, batch } = options;
  const batchId = batch || generateBatchId();

  console.log(`开始导入 ${type} 数据...`);
  console.log(`批次号: ${batchId}`);

  const records = await readCsvFile(file);
  console.log(`读取到 ${records.length} 条记录`);

  if (records.length === 0) {
    console.log('没有数据需要导入');
    return;
  }

  const db = getDb();
  let insertStmt: any;
  let mapFunction: (record: CsvRecord, batchId: string) => any;
  let tableName: string;

  switch (type) {
    case 'inventory':
      tableName = 'inventory';
      mapFunction = mapInventoryRecord;
      insertStmt = db.prepare(`
        INSERT OR REPLACE INTO inventory 
        (item_id, item_name, item_type, box_number, status, is_fragile, description, import_batch, imported_at)
        VALUES (@item_id, @item_name, @item_type, @box_number, @status, @is_fragile, @description, @import_batch, @imported_at)
      `);
      break;

    case 'maintenance':
      tableName = 'maintenance';
      mapFunction = mapMaintenanceRecord;
      insertStmt = db.prepare(`
        INSERT OR REPLACE INTO maintenance
        (maintenance_id, item_id, item_name, issue_description, report_date, repair_status, repair_person, repair_date, notes, import_batch, imported_at)
        VALUES (@maintenance_id, @item_id, @item_name, @issue_description, @report_date, @repair_status, @repair_person, @repair_date, @notes, @import_batch, @imported_at)
      `);
      break;

    case 'packing':
      tableName = 'packing_scans';
      mapFunction = mapPackingRecord;
      insertStmt = db.prepare(`
        INSERT OR REPLACE INTO packing_scans
        (scan_id, scan_time, item_id, item_name, box_number, scanner, status, import_batch, imported_at)
        VALUES (@scan_id, @scan_time, @item_id, @item_name, @box_number, @scanner, @status, @import_batch, @imported_at)
      `);
      break;

    case 'shows':
      tableName = 'show_schedules';
      mapFunction = mapShowRecord;
      insertStmt = db.prepare(`
        INSERT OR REPLACE INTO show_schedules
        (show_id, show_date, show_time, venue, play_title, required_items, required_puppets, status, import_batch, imported_at)
        VALUES (@show_id, @show_date, @show_time, @venue, @play_title, @required_items, @required_puppets, @status, @import_batch, @imported_at)
      `);
      break;

    case 'vehicles':
      tableName = 'vehicle_plans';
      mapFunction = mapVehicleRecord;
      insertStmt = db.prepare(`
        INSERT OR REPLACE INTO vehicle_plans
        (plan_id, vehicle_number, vehicle_type, driver_name, departure_time, arrival_time, origin, destination, cargo_items, status, import_batch, imported_at)
        VALUES (@plan_id, @vehicle_number, @vehicle_type, @driver_name, @departure_time, @arrival_time, @origin, @destination, @cargo_items, @status, @import_batch, @imported_at)
      `);
      break;

    default:
      throw new Error(`未知的导入类型: ${type}`);
  }

  const transaction = db.transaction((items: any[]) => {
    for (const item of items) {
      insertStmt.run(item);
    }
  });

  const mappedRecords = records.map(r => mapFunction(r, batchId));
  
  console.log(`正在写入数据库...`);
  transaction(mappedRecords);
  
  console.log(`成功导入 ${mappedRecords.length} 条记录到 ${tableName}`);
}
