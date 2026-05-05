import * as sqlite3 from 'sqlite3';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  SceneSchedule,
  CostumeItem,
  WashRecord,
  AlterationRecord,
  ReferencePhoto,
  RiskItem,
  Project,
} from '../shared/types';

const DB_FILENAME = 'wardrobe-continuity.db';

export class Database {
  private db: sqlite3.Database | null = null;

  constructor() {
    this.initDatabase();
  }

  private getDbPath(): string {
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    return path.join(userDataPath, DB_FILENAME);
  }

  private initDatabase(): void {
    const dbPath = this.getDbPath();
    this.db = new sqlite3.Database(dbPath);

    this.db.serialize(() => {
      // 项目表
      this.db?.run(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_scanned_at TEXT
        )
      `);

      // 场次通告表
      this.db?.run(`
        CREATE TABLE IF NOT EXISTS scene_schedules (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          scene_number TEXT NOT NULL,
          scene_name TEXT,
          shoot_date TEXT NOT NULL,
          location TEXT,
          characters TEXT,
          day_night TEXT,
          weather TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        )
      `);

      // 服装表
      this.db?.run(`
        CREATE TABLE IF NOT EXISTS costume_items (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          barcode TEXT NOT NULL,
          character TEXT NOT NULL,
          item_name TEXT NOT NULL,
          size TEXT,
          color TEXT,
          scenes TEXT,
          status TEXT NOT NULL DEFAULT 'available',
          notes TEXT,
          last_updated TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        )
      `);

      // 清洗记录表
      this.db?.run(`
        CREATE TABLE IF NOT EXISTS wash_records (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          costume_id TEXT NOT NULL,
          barcode TEXT NOT NULL,
          wash_date TEXT NOT NULL,
          expected_return_date TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id),
          FOREIGN KEY (costume_id) REFERENCES costume_items(id)
        )
      `);

      // 改衣记录表
      this.db?.run(`
        CREATE TABLE IF NOT EXISTS alteration_records (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          costume_id TEXT NOT NULL,
          barcode TEXT NOT NULL,
          change_type TEXT NOT NULL,
          current_size TEXT,
          target_size TEXT,
          request_date TEXT NOT NULL,
          expected_completion TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          is_confirmed INTEGER NOT NULL DEFAULT 0,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id),
          FOREIGN KEY (costume_id) REFERENCES costume_items(id)
        )
      `);

      // 参考照片表
      this.db?.run(`
        CREATE TABLE IF NOT EXISTS reference_photos (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_name TEXT NOT NULL,
          scene_number TEXT,
          character TEXT,
          barcode TEXT,
          photo_type TEXT NOT NULL DEFAULT 'continuity',
          taken_date TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        )
      `);

      // 风险记录表
      this.db?.run(`
        CREATE TABLE IF NOT EXISTS risk_items (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          type TEXT NOT NULL,
          severity TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          scene_number TEXT,
          character TEXT,
          barcode TEXT,
          costume_id TEXT,
          affected_date TEXT,
          is_resolved INTEGER NOT NULL DEFAULT 0,
          resolved_by TEXT,
          resolved_at TEXT,
          resolution_notes TEXT,
          user_override TEXT,
          user_notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id),
          FOREIGN KEY (costume_id) REFERENCES costume_items(id)
        )
      `);

      // 索引
      this.db?.run(`CREATE INDEX IF NOT EXISTS idx_scenes_project ON scene_schedules(project_id)`);
      this.db?.run(`CREATE INDEX IF NOT EXISTS idx_scenes_number ON scene_schedules(scene_number)`);
      this.db?.run(`CREATE INDEX IF NOT EXISTS idx_scenes_date ON scene_schedules(shoot_date)`);
      this.db?.run(`CREATE INDEX IF NOT EXISTS idx_costumes_project ON costume_items(project_id)`);
      this.db?.run(`CREATE INDEX IF NOT EXISTS idx_costumes_barcode ON costume_items(barcode)`);
      this.db?.run(`CREATE INDEX IF NOT EXISTS idx_costumes_character ON costume_items(character)`);
      this.db?.run(`CREATE INDEX IF NOT EXISTS idx_risks_project ON risk_items(project_id)`);
      this.db?.run(`CREATE INDEX IF NOT EXISTS idx_risks_type ON risk_items(type)`);
      this.db?.run(`CREATE INDEX IF NOT EXISTS idx_risks_resolved ON risk_items(is_resolved)`);
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // 项目操作
  async createProject(name: string): Promise<Project> {
    const now = new Date().toISOString();
    const project: Project = {
      id: uuidv4(),
      name,
      createdAt: now,
      updatedAt: now,
    };

    await this.run(
      `INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`,
      [project.id, project.name, project.createdAt, project.updatedAt]
    );

    return project;
  }

  async getProjects(): Promise<Project[]> {
    return this.all<Project>(
      `SELECT id, name, created_at as createdAt, updated_at as updatedAt, last_scanned_at as lastScannedAt FROM projects ORDER BY updated_at DESC`
    );
  }

  async getProject(id: string): Promise<Project | null> {
    return this.get<Project>(
      `SELECT id, name, created_at as createdAt, updated_at as updatedAt, last_scanned_at as lastScannedAt FROM projects WHERE id = ?`,
      [id]
    );
  }

  async updateProject(id: string, name: string): Promise<void> {
    const now = new Date().toISOString();
    await this.run(
      `UPDATE projects SET name = ?, updated_at = ? WHERE id = ?`,
      [name, now, id]
    );
  }

  async updateLastScanned(projectId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.run(
      `UPDATE projects SET last_scanned_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, projectId]
    );
  }

  // 场次操作
  async saveSceneSchedules(projectId: string, scenes: SceneSchedule[]): Promise<void> {
    const now = new Date().toISOString();
    
    // 删除现有数据
    await this.run(`DELETE FROM scene_schedules WHERE project_id = ?`, [projectId]);
    
    for (const scene of scenes) {
      await this.run(
        `INSERT INTO scene_schedules (
          id, project_id, scene_number, scene_name, shoot_date, location, 
          characters, day_night, weather, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          scene.id || uuidv4(),
          projectId,
          scene.sceneNumber,
          scene.sceneName,
          scene.shootDate,
          scene.location,
          JSON.stringify(scene.characters),
          scene.dayNight,
          scene.weather,
          scene.notes,
          now,
          now,
        ]
      );
    }
  }

  async getSceneSchedules(projectId: string): Promise<SceneSchedule[]> {
    const rows = await this.all<any>(
      `SELECT * FROM scene_schedules WHERE project_id = ? ORDER BY shoot_date, scene_number`,
      [projectId]
    );

    return rows.map((row) => ({
      id: row.id,
      sceneNumber: row.scene_number,
      sceneName: row.scene_name,
      shootDate: row.shoot_date,
      location: row.location,
      characters: JSON.parse(row.characters || '[]'),
      dayNight: row.day_night,
      weather: row.weather,
      notes: row.notes,
    }));
  }

  // 服装操作
  async saveCostumeItems(projectId: string, costumes: CostumeItem[]): Promise<void> {
    const now = new Date().toISOString();
    
    await this.run(`DELETE FROM costume_items WHERE project_id = ?`, [projectId]);
    
    for (const costume of costumes) {
      await this.run(
        `INSERT INTO costume_items (
          id, project_id, barcode, character, item_name, size, color,
          scenes, status, notes, last_updated, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          costume.id || uuidv4(),
          projectId,
          costume.barcode,
          costume.character,
          costume.itemName,
          costume.size,
          costume.color,
          JSON.stringify(costume.scenes || []),
          costume.status,
          costume.notes,
          costume.lastUpdated,
          now,
          now,
        ]
      );
    }
  }

  async getCostumeItems(projectId: string): Promise<CostumeItem[]> {
    const rows = await this.all<any>(
      `SELECT * FROM costume_items WHERE project_id = ? ORDER BY character, item_name`,
      [projectId]
    );

    return rows.map((row) => ({
      id: row.id,
      barcode: row.barcode,
      character: row.character,
      itemName: row.item_name,
      size: row.size,
      color: row.color,
      scenes: JSON.parse(row.scenes || '[]'),
      status: row.status,
      lastUpdated: row.last_updated,
      notes: row.notes,
    }));
  }

  // 清洗记录操作
  async saveWashRecords(projectId: string, records: WashRecord[]): Promise<void> {
    const now = new Date().toISOString();
    
    await this.run(`DELETE FROM wash_records WHERE project_id = ?`, [projectId]);
    
    for (const record of records) {
      await this.run(
        `INSERT INTO wash_records (
          id, project_id, costume_id, barcode, wash_date, expected_return_date,
          status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id || uuidv4(),
          projectId,
          record.costumeId,
          record.barcode,
          record.washDate,
          record.expectedReturnDate,
          record.status,
          record.notes,
          now,
          now,
        ]
      );
    }
  }

  async getWashRecords(projectId: string): Promise<WashRecord[]> {
    const rows = await this.all<any>(
      `SELECT * FROM wash_records WHERE project_id = ? ORDER BY wash_date DESC`,
      [projectId]
    );

    return rows.map((row) => ({
      id: row.id,
      costumeId: row.costume_id,
      barcode: row.barcode,
      washDate: row.wash_date,
      expectedReturnDate: row.expected_return_date,
      status: row.status,
      notes: row.notes,
    }));
  }

  // 改衣记录操作
  async saveAlterationRecords(projectId: string, records: AlterationRecord[]): Promise<void> {
    const now = new Date().toISOString();
    
    await this.run(`DELETE FROM alteration_records WHERE project_id = ?`, [projectId]);
    
    for (const record of records) {
      await this.run(
        `INSERT INTO alteration_records (
          id, project_id, costume_id, barcode, change_type, current_size,
          target_size, request_date, expected_completion, status, is_confirmed,
          notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id || uuidv4(),
          projectId,
          record.costumeId,
          record.barcode,
          record.changeType,
          record.currentSize,
          record.targetSize,
          record.requestDate,
          record.expectedCompletion,
          record.status,
          record.isConfirmed ? 1 : 0,
          record.notes,
          now,
          now,
        ]
      );
    }
  }

  async getAlterationRecords(projectId: string): Promise<AlterationRecord[]> {
    const rows = await this.all<any>(
      `SELECT * FROM alteration_records WHERE project_id = ? ORDER BY request_date DESC`,
      [projectId]
    );

    return rows.map((row) => ({
      id: row.id,
      costumeId: row.costume_id,
      barcode: row.barcode,
      changeType: row.change_type,
      currentSize: row.current_size,
      targetSize: row.target_size,
      requestDate: row.request_date,
      expectedCompletion: row.expected_completion,
      status: row.status,
      isConfirmed: row.is_confirmed === 1,
      notes: row.notes,
    }));
  }

  // 参考照片操作
  async saveReferencePhotos(projectId: string, photos: ReferencePhoto[]): Promise<void> {
    const now = new Date().toISOString();
    
    await this.run(`DELETE FROM reference_photos WHERE project_id = ?`, [projectId]);
    
    for (const photo of photos) {
      await this.run(
        `INSERT INTO reference_photos (
          id, project_id, file_path, file_name, scene_number, character,
          barcode, photo_type, taken_date, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          photo.id || uuidv4(),
          projectId,
          photo.filePath,
          photo.fileName,
          photo.sceneNumber,
          photo.character,
          photo.barcode,
          photo.photoType,
          photo.takenDate,
          photo.notes,
          now,
          now,
        ]
      );
    }
  }

  async getReferencePhotos(projectId: string): Promise<ReferencePhoto[]> {
    const rows = await this.all<any>(
      `SELECT * FROM reference_photos WHERE project_id = ? ORDER BY taken_date DESC`,
      [projectId]
    );

    return rows.map((row) => ({
      id: row.id,
      filePath: row.file_path,
      fileName: row.file_name,
      sceneNumber: row.scene_number,
      character: row.character,
      barcode: row.barcode,
      photoType: row.photo_type,
      takenDate: row.taken_date,
      notes: row.notes,
    }));
  }

  // 风险操作
  async saveRiskItems(projectId: string, risks: RiskItem[]): Promise<void> {
    const now = new Date().toISOString();
    
    await this.run(`DELETE FROM risk_items WHERE project_id = ?`, [projectId]);
    
    for (const risk of risks) {
      await this.run(
        `INSERT INTO risk_items (
          id, project_id, type, severity, title, description, scene_number,
          character, barcode, costume_id, affected_date, is_resolved, resolved_by,
          resolved_at, resolution_notes, user_override, user_notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          risk.id || uuidv4(),
          projectId,
          risk.type,
          risk.severity,
          risk.title,
          risk.description,
          risk.sceneNumber,
          risk.character,
          risk.barcode,
          risk.costumeId,
          risk.affectedDate,
          risk.isResolved ? 1 : 0,
          risk.resolvedBy,
          risk.resolvedAt,
          risk.resolutionNotes,
          risk.userOverride,
          risk.userNotes,
          risk.createdAt || now,
          risk.updatedAt || now,
        ]
      );
    }
  }

  async getRiskItems(projectId: string): Promise<RiskItem[]> {
    const rows = await this.all<any>(
      `SELECT * FROM risk_items WHERE project_id = ? ORDER BY 
        CASE severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        created_at DESC`,
      [projectId]
    );

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      severity: row.severity,
      title: row.title,
      description: row.description,
      sceneNumber: row.scene_number,
      character: row.character,
      barcode: row.barcode,
      costumeId: row.costume_id,
      affectedDate: row.affected_date,
      isResolved: row.is_resolved === 1,
      resolvedBy: row.resolved_by,
      resolvedAt: row.resolved_at,
      resolutionNotes: row.resolution_notes,
      userOverride: row.user_override,
      userNotes: row.user_notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async updateRiskItem(projectId: string, riskId: string, updates: Partial<RiskItem>): Promise<void> {
    const now = new Date().toISOString();
    const setClauses: string[] = ['updated_at = ?'];
    const values: any[] = [now];

    if (updates.isResolved !== undefined) {
      setClauses.push('is_resolved = ?');
      values.push(updates.isResolved ? 1 : 0);
    }
    if (updates.resolvedBy !== undefined) {
      setClauses.push('resolved_by = ?');
      values.push(updates.resolvedBy);
    }
    if (updates.resolvedAt !== undefined) {
      setClauses.push('resolved_at = ?');
      values.push(updates.resolvedAt);
    }
    if (updates.resolutionNotes !== undefined) {
      setClauses.push('resolution_notes = ?');
      values.push(updates.resolutionNotes);
    }
    if (updates.userOverride !== undefined) {
      setClauses.push('user_override = ?');
      values.push(updates.userOverride);
    }
    if (updates.userNotes !== undefined) {
      setClauses.push('user_notes = ?');
      values.push(updates.userNotes);
    }

    values.push(riskId);
    values.push(projectId);

    await this.run(
      `UPDATE risk_items SET ${setClauses.join(', ')} WHERE id = ? AND project_id = ?`,
      values
    );
  }

  // 辅助方法
  private run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db?.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private get<T>(sql: string, params: any[] = []): Promise<T | null> {
    return new Promise((resolve, reject) => {
      this.db?.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row ? (row as T) : null);
      });
    });
  }

  private all<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db?.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }
}

export let database: Database;

export function initDatabase(): Database {
  database = new Database();
  return database;
}
