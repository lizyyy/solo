import initSqlJs, { Database } from 'sql.js';
import { v4 as uuidv4 } from 'uuid';
import { Project, CalculationResult } from '../models/types.js';

export class DatabaseService {
  private db: Database | null = null;
  private dbPath: string;

  constructor(dbPath: string = './hydraulic_balance.db') {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    const SQL = await initSqlJs();
    this.db = new SQL.Database();
    this.createTables();
  }

  private createTables(): void {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        userNotes TEXT,
        data TEXT NOT NULL
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS calculation_results (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        data TEXT NOT NULL,
        FOREIGN KEY (projectId) REFERENCES projects (id)
      )
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_results_projectId 
      ON calculation_results (projectId)
    `);
  }

  async saveProject(project: Project): Promise<Project> {
    if (!this.db) throw new Error('数据库未初始化');

    const existingProject = this.db.exec(
      'SELECT id FROM projects WHERE id = ?',
      [project.id]
    );

    if (existingProject.length > 0 && existingProject[0].values.length > 0) {
      this.db.run(
        `UPDATE projects 
         SET name = ?, description = ?, updatedAt = ?, userNotes = ?, data = ?
         WHERE id = ?`,
        [
          project.name,
          project.description || '',
          project.updatedAt,
          project.userNotes || '',
          JSON.stringify(project),
          project.id,
        ]
      );
    } else {
      this.db.run(
        `INSERT INTO projects (id, name, description, createdAt, updatedAt, userNotes, data)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          project.id,
          project.name,
          project.description || '',
          project.createdAt,
          project.updatedAt,
          project.userNotes || '',
          JSON.stringify(project),
        ]
      );
    }

    return project;
  }

  async getProject(id: string): Promise<Project | null> {
    if (!this.db) throw new Error('数据库未初始化');

    const result = this.db.exec('SELECT data FROM projects WHERE id = ?', [id]);

    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    const jsonData = result[0].values[0][0] as string;
    return JSON.parse(jsonData) as Project;
  }

  async getAllProjects(): Promise<Project[]> {
    if (!this.db) throw new Error('数据库未初始化');

    const result = this.db.exec('SELECT data FROM projects ORDER BY updatedAt DESC');

    if (result.length === 0) {
      return [];
    }

    return result[0].values.map((row) => {
      return JSON.parse(row[0] as string) as Project;
    });
  }

  async deleteProject(id: string): Promise<boolean> {
    if (!this.db) throw new Error('数据库未初始化');

    this.db.run('DELETE FROM calculation_results WHERE projectId = ?', [id]);
    const result = this.db.run('DELETE FROM projects WHERE id = ?', [id]);

    return result.getRowsModified() > 0;
  }

  async saveCalculationResult(result: CalculationResult): Promise<CalculationResult> {
    if (!this.db) throw new Error('数据库未初始化');

    this.db.run(
      `INSERT INTO calculation_results (id, projectId, timestamp, data)
       VALUES (?, ?, ?, ?)`,
      [
        result.id,
        result.projectId,
        result.timestamp,
        JSON.stringify(result),
      ]
    );

    return result;
  }

  async getCalculationResults(projectId: string): Promise<CalculationResult[]> {
    if (!this.db) throw new Error('数据库未初始化');

    const result = this.db.exec(
      'SELECT data FROM calculation_results WHERE projectId = ? ORDER BY timestamp DESC',
      [projectId]
    );

    if (result.length === 0) {
      return [];
    }

    return result[0].values.map((row) => {
      return JSON.parse(row[0] as string) as CalculationResult;
    });
  }

  async getLatestCalculationResult(projectId: string): Promise<CalculationResult | null> {
    if (!this.db) throw new Error('数据库未初始化');

    const result = this.db.exec(
      `SELECT data FROM calculation_results 
       WHERE projectId = ? 
       ORDER BY timestamp DESC 
       LIMIT 1`,
      [projectId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    return JSON.parse(result[0].values[0][0] as string) as CalculationResult;
  }

  async exportToJSON(): Promise<string> {
    if (!this.db) throw new Error('数据库未初始化');

    const projects = await this.getAllProjects();
    const allResults: CalculationResult[] = [];

    for (const project of projects) {
      const results = await this.getCalculationResults(project.id);
      allResults.push(...results);
    }

    return JSON.stringify(
      {
        exportDate: new Date().toISOString(),
        projects,
        calculationResults: allResults,
      },
      null,
      2
    );
  }

  async importFromJSON(jsonData: string): Promise<{ projects: number; results: number }> {
    if (!this.db) throw new Error('数据库未初始化');

    const data = JSON.parse(jsonData);
    let projectCount = 0;
    let resultCount = 0;

    if (data.projects && Array.isArray(data.projects)) {
      for (const project of data.projects) {
        await this.saveProject(project);
        projectCount++;
      }
    }

    if (data.calculationResults && Array.isArray(data.calculationResults)) {
      for (const result of data.calculationResults) {
        await this.saveCalculationResult(result);
        resultCount++;
      }
    }

    return { projects: projectCount, results: resultCount };
  }
}
