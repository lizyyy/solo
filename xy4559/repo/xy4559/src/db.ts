import Database from 'better-sqlite3';
import path from 'path';

export interface InventoryItem {
  id?: number;
  itemId: string;
  itemName: string;
  itemType: string;
  boxNumber: string;
  status: string;
  isFragile: boolean;
  description: string;
  importBatch: string;
  importedAt: string;
}

export interface MaintenanceRecord {
  id?: number;
  maintenanceId: string;
  itemId: string;
  itemName: string;
  issueDescription: string;
  reportDate: string;
  repairStatus: string;
  repairPerson: string;
  repairDate: string;
  notes: string;
  importBatch: string;
  importedAt: string;
}

export interface PackingScan {
  id?: number;
  scanId: string;
  scanTime: string;
  itemId: string;
  itemName: string;
  boxNumber: string;
  scanner: string;
  status: string;
  importBatch: string;
  importedAt: string;
}

export interface ShowSchedule {
  id?: number;
  showId: string;
  showDate: string;
  showTime: string;
  venue: string;
  playTitle: string;
  requiredItems: string;
  requiredPuppets: string;
  status: string;
  importBatch: string;
  importedAt: string;
}

export interface VehiclePlan {
  id?: number;
  planId: string;
  vehicleNumber: string;
  vehicleType: string;
  driverName: string;
  departureTime: string;
  arrivalTime: string;
  origin: string;
  destination: string;
  cargoItems: string;
  status: string;
  importBatch: string;
  importedAt: string;
}

export interface ValidationIssue {
  id?: number;
  issueType: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  relatedItem?: string;
  relatedBox?: string;
  relatedShow?: string;
  relatedVehicle?: string;
  validationBatch: string;
  createdAt: string;
}

export interface ReviewConclusion {
  id?: number;
  validationIssueId: number;
  conclusion: string;
  decision: 'accept' | 'reject' | 'pending' | 'resolved';
  reviewedBy: string;
  reviewedAt: string;
  notes: string;
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'puppet-checkout.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function initDb(): void {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      item_type TEXT NOT NULL,
      box_number TEXT NOT NULL,
      status TEXT DEFAULT '正常',
      is_fragile INTEGER DEFAULT 0,
      description TEXT,
      import_batch TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      UNIQUE(item_id, import_batch)
    );

    CREATE TABLE IF NOT EXISTS maintenance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      maintenance_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      item_name TEXT,
      issue_description TEXT NOT NULL,
      report_date TEXT NOT NULL,
      repair_status TEXT DEFAULT '待修',
      repair_person TEXT,
      repair_date TEXT,
      notes TEXT,
      import_batch TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      UNIQUE(maintenance_id, import_batch)
    );

    CREATE TABLE IF NOT EXISTS packing_scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id TEXT NOT NULL,
      scan_time TEXT NOT NULL,
      item_id TEXT NOT NULL,
      item_name TEXT,
      box_number TEXT NOT NULL,
      scanner TEXT,
      status TEXT DEFAULT '已装箱',
      import_batch TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      UNIQUE(scan_id, import_batch)
    );

    CREATE TABLE IF NOT EXISTS show_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      show_id TEXT NOT NULL,
      show_date TEXT NOT NULL,
      show_time TEXT,
      venue TEXT NOT NULL,
      play_title TEXT NOT NULL,
      required_items TEXT,
      required_puppets TEXT,
      status TEXT DEFAULT '待准备',
      import_batch TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      UNIQUE(show_id, import_batch)
    );

    CREATE TABLE IF NOT EXISTS vehicle_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id TEXT NOT NULL,
      vehicle_number TEXT NOT NULL,
      vehicle_type TEXT,
      driver_name TEXT,
      departure_time TEXT NOT NULL,
      arrival_time TEXT,
      origin TEXT,
      destination TEXT NOT NULL,
      cargo_items TEXT,
      status TEXT DEFAULT '待出发',
      import_batch TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      UNIQUE(plan_id, import_batch)
    );

    CREATE TABLE IF NOT EXISTS validation_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      description TEXT NOT NULL,
      related_item TEXT,
      related_box TEXT,
      related_show TEXT,
      related_vehicle TEXT,
      validation_batch TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS review_conclusions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      validation_issue_id INTEGER NOT NULL,
      conclusion TEXT NOT NULL,
      decision TEXT NOT NULL,
      reviewed_by TEXT NOT NULL,
      reviewed_at TEXT NOT NULL,
      notes TEXT,
      FOREIGN KEY (validation_issue_id) REFERENCES validation_issues(id),
      UNIQUE(validation_issue_id)
    );

    CREATE INDEX IF NOT EXISTS idx_inventory_item ON inventory(item_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_box ON inventory(box_number);
    CREATE INDEX IF NOT EXISTS idx_maintenance_item ON maintenance(item_id);
    CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance(repair_status);
    CREATE INDEX IF NOT EXISTS idx_packing_item ON packing_scans(item_id);
    CREATE INDEX IF NOT EXISTS idx_packing_box ON packing_scans(box_number);
    CREATE INDEX IF NOT EXISTS idx_shows_date ON show_schedules(show_date);
    CREATE INDEX IF NOT EXISTS idx_vehicles_departure ON vehicle_plans(departure_time);
    CREATE INDEX IF NOT EXISTS idx_issues_batch ON validation_issues(validation_batch);
  `);
}
