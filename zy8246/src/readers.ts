import * as fs from 'fs-extra';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import * as yaml from 'js-yaml';
import {
  Room,
  LinenTag,
  LaundryBatch,
  LaundryBatches,
  VendorRule,
  DataContext
} from './types';

export function readRoomsCsv(filePath: string): Room[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records.map((record: Record<string, string>) => ({
    roomNumber: record.room_number,
    checkoutTime: record.checkout_time,
    storeId: record.store_id,
    storeName: record.store_name
  }));
}

export function readLinenTagsJsonl(filePath: string): LinenTag[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  return lines.map(line => {
    const obj = JSON.parse(line);
    return {
      tagId: obj.tag_id,
      type: obj.type,
      storeId: obj.store_id,
      lastScan: obj.last_scan,
      scanLocation: obj.scan_location,
      soilLevel: obj.soil_level,
      status: obj.status
    };
  });
}

interface RawBatchTag {
  tag_id: string;
  scan_time: string | Date;
}

interface RawLaundryBatch {
  batch_id: string;
  store_id: string;
  created_at: string | Date;
  sent_at: string | Date | null;
  vendor_id: string;
  status: string;
  expected_return: string | Date | null;
  returned_at: string | Date | null;
  tags: RawBatchTag[];
}

interface RawLaundryBatches {
  batches: RawLaundryBatch[];
}

function toISOString(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

export function readLaundryBatchesYaml(filePath: string): LaundryBatch[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = yaml.load(content) as RawLaundryBatches;

  return data.batches.map(batch => ({
    batchId: batch.batch_id,
    storeId: batch.store_id,
    createdAt: toISOString(batch.created_at) || '',
    sentAt: toISOString(batch.sent_at),
    vendorId: batch.vendor_id,
    status: batch.status,
    expectedReturn: toISOString(batch.expected_return),
    returnedAt: toISOString(batch.returned_at),
    tags: batch.tags.map(tag => ({
      tagId: tag.tag_id,
      scanTime: toISOString(tag.scan_time) || ''
    }))
  }));
}

export function readVendorRulesCsv(filePath: string): VendorRule[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records.map((record: Record<string, string>) => ({
    vendorId: record.vendor_id,
    vendorName: record.vendor_name,
    soilLevel: record.soil_level,
    linenType: record.linen_type,
    treatmentType: record.treatment_type,
    washTemperature: parseInt(record.wash_temperature, 10),
    dryTemperature: parseInt(record.dry_temperature, 10),
    specialInstructions: record.special_instructions || ''
  }));
}

export function loadDataContext(dataDir: string): DataContext {
  const roomsPath = path.join(dataDir, 'rooms.csv');
  const linenTagsPath = path.join(dataDir, 'linen_tags.jsonl');
  const laundryBatchesPath = path.join(dataDir, 'laundry_batches.yaml');
  const vendorRulesPath = path.join(dataDir, 'vendor_rules.csv');

  if (!fs.existsSync(dataDir)) {
    throw new Error(`数据目录不存在: ${dataDir}`);
  }

  const requiredFiles = [roomsPath, linenTagsPath, laundryBatchesPath, vendorRulesPath];
  const missingFiles = requiredFiles.filter(f => !fs.existsSync(f));

  if (missingFiles.length > 0) {
    throw new Error(`缺少必要的数据文件: ${missingFiles.join(', ')}`);
  }

  return {
    rooms: readRoomsCsv(roomsPath),
    linenTags: readLinenTagsJsonl(linenTagsPath),
    laundryBatches: readLaundryBatchesYaml(laundryBatchesPath),
    vendorRules: readVendorRulesCsv(vendorRulesPath)
  };
}