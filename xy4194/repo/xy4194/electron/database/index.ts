import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import fs from 'fs/promises'
import path from 'path'
import dayjs from 'dayjs'
import type { Review, Project } from '../../src/types'

export class Database {
  private db: SqlJsDatabase
  private dbPath: string

  constructor(db: SqlJsDatabase, dbPath: string) {
    this.db = db
    this.dbPath = dbPath
    this.initializeTables()
  }

  private initializeTables(): void {
    // 创建复核意见表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        issue_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        status TEXT NOT NULL,
        reviewer_name TEXT NOT NULL,
        comment TEXT,
        evidence_photo TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)

    // 创建项目表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        scene_sheet_path TEXT,
        prop_status_path TEXT,
        actor_call_sheet_path TEXT,
        photo_directory TEXT,
        scenes_data TEXT,
        prop_status_data TEXT,
        actor_calls_data TEXT,
        photos_data TEXT,
        issues_data TEXT
      )
    `)

    // 创建索引
    this.db.run('CREATE INDEX IF NOT EXISTS idx_reviews_issue ON reviews(issue_id)')
    this.db.run('CREATE INDEX IF NOT EXISTS idx_reviews_project ON reviews(project_id)')
  }

  async save(): Promise<void> {
    const data = this.db.export()
    const buffer = Buffer.from(data)
    await fs.writeFile(this.dbPath, buffer)
  }

  // 复核意见相关操作
  getAllReviews(): Review[] {
    const result = this.db.exec('SELECT * FROM reviews')
    if (result.length === 0) return []
    
    const columns = result[0].columns
    return result[0].values.map(row => {
      const obj: any = {}
      columns.forEach((col, i) => {
        obj[col] = row[i]
      })
      return this.mapRowToReview(obj)
    })
  }

  getReviewByIssueId(issueId: string): Review | null {
    const result = this.db.exec(
      'SELECT * FROM reviews WHERE issue_id = ? LIMIT 1',
      [issueId]
    )
    if (result.length === 0 || result[0].values.length === 0) return null
    
    const columns = result[0].columns
    const row = result[0].values[0]
    const obj: any = {}
    columns.forEach((col, i) => {
      obj[col] = row[i]
    })
    return this.mapRowToReview(obj)
  }

  getReviewsByProjectId(projectId: string): Review[] {
    const result = this.db.exec(
      'SELECT * FROM reviews WHERE project_id = ?',
      [projectId]
    )
    if (result.length === 0) return []
    
    const columns = result[0].columns
    return result[0].values.map(row => {
      const obj: any = {}
      columns.forEach((col, i) => {
        obj[col] = row[i]
      })
      return this.mapRowToReview(obj)
    })
  }

  async saveReview(review: Partial<Review> & { issueId: string; projectId: string }): Promise<Review> {
    const existing = this.getReviewByIssueId(review.issueId)
    const now = dayjs().toISOString()
    
    if (existing) {
      const updated: Review = {
        ...existing,
        status: review.status ?? existing.status,
        reviewerName: review.reviewerName ?? existing.reviewerName,
        comment: review.comment ?? existing.comment,
        evidencePhoto: review.evidencePhoto ?? existing.evidencePhoto,
        updatedAt: now,
      }
      
      this.db.run(`
        UPDATE reviews SET
          status = ?,
          reviewer_name = ?,
          comment = ?,
          evidence_photo = ?,
          updated_at = ?
        WHERE id = ?
      `, [
        updated.status,
        updated.reviewerName,
        updated.comment,
        updated.evidencePhoto,
        updated.updatedAt,
        updated.id,
      ])
      
      await this.save()
      return updated
    } else {
      const newReview: Review = {
        id: review.id ?? this.generateId(),
        issueId: review.issueId,
        projectId: review.projectId,
        status: review.status ?? 'needs_more_info',
        reviewerName: review.reviewerName ?? '未知',
        comment: review.comment ?? '',
        evidencePhoto: review.evidencePhoto,
        createdAt: now,
        updatedAt: now,
      }
      
      this.db.run(`
        INSERT INTO reviews (
          id, issue_id, project_id, status, reviewer_name,
          comment, evidence_photo, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        newReview.id,
        newReview.issueId,
        newReview.projectId,
        newReview.status,
        newReview.reviewerName,
        newReview.comment,
        newReview.evidencePhoto,
        newReview.createdAt,
        newReview.updatedAt,
      ])
      
      await this.save()
      return newReview
    }
  }

  // 项目相关操作
  getAllProjects(): Project[] {
    const result = this.db.exec('SELECT * FROM projects ORDER BY updated_at DESC')
    if (result.length === 0) return []
    
    const columns = result[0].columns
    return result[0].values.map(row => {
      const obj: any = {}
      columns.forEach((col, i) => {
        obj[col] = row[i]
      })
      return this.mapRowToProject(obj)
    })
  }

  getProject(id: string): Project | null {
    const result = this.db.exec('SELECT * FROM projects WHERE id = ? LIMIT 1', [id])
    if (result.length === 0 || result[0].values.length === 0) return null
    
    const columns = result[0].columns
    const row = result[0].values[0]
    const obj: any = {}
    columns.forEach((col, i) => {
      obj[col] = row[i]
    })
    return this.mapRowToProject(obj)
  }

  async saveProject(project: Partial<Project> & { name: string }): Promise<Project> {
    const existing = project.id ? this.getProject(project.id) : null
    const now = dayjs().toISOString()
    
    if (existing) {
      const updated: Project = {
        ...existing,
        name: project.name ?? existing.name,
        description: project.description ?? existing.description,
        sceneSheetPath: project.sceneSheetPath ?? existing.sceneSheetPath,
        propStatusPath: project.propStatusPath ?? existing.propStatusPath,
        actorCallSheetPath: project.actorCallSheetPath ?? existing.actorCallSheetPath,
        photoDirectory: project.photoDirectory ?? existing.photoDirectory,
        scenes: project.scenes ?? existing.scenes,
        propStatus: project.propStatus ?? existing.propStatus,
        actorCalls: project.actorCalls ?? existing.actorCalls,
        photos: project.photos ?? existing.photos,
        issues: project.issues ?? existing.issues,
        updatedAt: now,
      }
      
      this.db.run(`
        UPDATE projects SET
          name = ?,
          description = ?,
          updated_at = ?,
          scene_sheet_path = ?,
          prop_status_path = ?,
          actor_call_sheet_path = ?,
          photo_directory = ?,
          scenes_data = ?,
          prop_status_data = ?,
          actor_calls_data = ?,
          photos_data = ?,
          issues_data = ?
        WHERE id = ?
      `, [
        updated.name,
        updated.description,
        updated.updatedAt,
        updated.sceneSheetPath,
        updated.propStatusPath,
        updated.actorCallSheetPath,
        updated.photoDirectory,
        JSON.stringify(updated.scenes),
        JSON.stringify(updated.propStatus),
        JSON.stringify(updated.actorCalls),
        JSON.stringify(updated.photos),
        JSON.stringify(updated.issues),
        updated.id,
      ])
      
      await this.save()
      return updated
    } else {
      const newProject: Project = {
        id: project.id ?? this.generateId(),
        name: project.name,
        description: project.description,
        createdAt: now,
        updatedAt: now,
        sceneSheetPath: project.sceneSheetPath,
        propStatusPath: project.propStatusPath,
        actorCallSheetPath: project.actorCallSheetPath,
        photoDirectory: project.photoDirectory,
        scenes: project.scenes ?? [],
        propStatus: project.propStatus ?? [],
        actorCalls: project.actorCalls ?? [],
        photos: project.photos ?? [],
        issues: project.issues ?? [],
      }
      
      this.db.run(`
        INSERT INTO projects (
          id, name, description, created_at, updated_at,
          scene_sheet_path, prop_status_path, actor_call_sheet_path, photo_directory,
          scenes_data, prop_status_data, actor_calls_data, photos_data, issues_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        newProject.id,
        newProject.name,
        newProject.description,
        newProject.createdAt,
        newProject.updatedAt,
        newProject.sceneSheetPath,
        newProject.propStatusPath,
        newProject.actorCallSheetPath,
        newProject.photoDirectory,
        JSON.stringify(newProject.scenes),
        JSON.stringify(newProject.propStatus),
        JSON.stringify(newProject.actorCalls),
        JSON.stringify(newProject.photos),
        JSON.stringify(newProject.issues),
      ])
      
      await this.save()
      return newProject
    }
  }

  async deleteProject(id: string): Promise<void> {
    this.db.run('DELETE FROM reviews WHERE project_id = ?', [id])
    this.db.run('DELETE FROM projects WHERE id = ?', [id])
    await this.save()
  }

  private mapRowToReview(row: any): Review {
    return {
      id: row.id,
      issueId: row.issue_id,
      projectId: row.project_id,
      status: row.status as Review['status'],
      reviewerName: row.reviewer_name,
      comment: row.comment,
      evidencePhoto: row.evidence_photo,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  private mapRowToProject(row: any): Project {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sceneSheetPath: row.scene_sheet_path,
      propStatusPath: row.prop_status_path,
      actorCallSheetPath: row.actor_call_sheet_path,
      photoDirectory: row.photo_directory,
      scenes: row.scenes_data ? JSON.parse(row.scenes_data) : [],
      propStatus: row.prop_status_data ? JSON.parse(row.prop_status_data) : [],
      actorCalls: row.actor_calls_data ? JSON.parse(row.actor_calls_data) : [],
      photos: row.photos_data ? JSON.parse(row.photos_data) : [],
      issues: row.issues_data ? JSON.parse(row.issues_data) : [],
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }
}

export async function initializeDatabase(dataPath: string): Promise<Database> {
  const SQL = await initSqlJs()
  const dbPath = path.join(dataPath, 'continuity-checker.db')
  
  let db: SqlJsDatabase
  
  try {
    const buffer = await fs.readFile(dbPath)
    db = new SQL.Database(buffer)
    console.log('Loaded existing database from:', dbPath)
  } catch (error) {
    db = new SQL.Database()
    console.log('Created new database at:', dbPath)
  }
  
  return new Database(db, dbPath)
}
