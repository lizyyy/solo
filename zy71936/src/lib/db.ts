import Dexie, { type Table } from "dexie"
import type { Project, PhotoRecord, ChangeLog, ExportSpec } from "./types"

class PhotoMarkDB extends Dexie {
  projects!: Table<Project, string>
  photoRecords!: Table<PhotoRecord, string>
  changeLogs!: Table<ChangeLog, string>
  exportSpecs!: Table<ExportSpec, string>

  constructor() {
    super("PhotoMarkDB")
    this.version(1).stores({
      projects: "id, name, createdAt",
      photoRecords: "id, projectId, markStatus, sourceType, authorizationStatus, createdAt",
      changeLogs: "id, photoRecordId, field, changedAt",
      exportSpecs: "id, name, lastUsedAt",
    })
  }
}

export const db = new PhotoMarkDB()

export async function createProject(name: string, specVersion: string): Promise<Project> {
  const project: Project = {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    importCount: 0,
    specVersion,
  }
  await db.projects.add(project)
  return project
}

export async function getProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id)
}

export async function getAllProjects(): Promise<Project[]> {
  return db.projects.toArray()
}

export async function addPhotoRecords(records: PhotoRecord[]): Promise<void> {
  await db.photoRecords.bulkAdd(records)
  if (records.length > 0) {
    const projectId = records[0].projectId
    const project = await db.projects.get(projectId)
    if (project) {
      await db.projects.update(projectId, {
        importCount: project.importCount + records.length,
      })
    }
  }
}

export async function getPhotoRecordsByProject(projectId: string): Promise<PhotoRecord[]> {
  return db.photoRecords.where("projectId").equals(projectId).toArray()
}

export async function getAllPhotoRecords(): Promise<PhotoRecord[]> {
  return db.photoRecords.toArray()
}

export async function updatePhotoRecord(id: string, changes: Partial<PhotoRecord>): Promise<void> {
  await db.photoRecords.update(id, { ...changes, updatedAt: Date.now() })
}

export async function getPhotoRecordsByStatus(status: string): Promise<PhotoRecord[]> {
  return db.photoRecords.where("markStatus").equals(status).toArray()
}

export async function addChangeLog(log: ChangeLog): Promise<void> {
  await db.changeLogs.add(log)
}

export async function getChangeLogsByRecord(recordId: string): Promise<ChangeLog[]> {
  return db.changeLogs.where("photoRecordId").equals(recordId).sortBy("changedAt")
}

export async function getAllChangeLogs(): Promise<ChangeLog[]> {
  return db.changeLogs.orderBy("changedAt").reverse().toArray()
}

export async function addExportSpec(spec: ExportSpec): Promise<void> {
  await db.exportSpecs.add(spec)
}

export async function getAllExportSpecs(): Promise<ExportSpec[]> {
  return db.exportSpecs.toArray()
}

export async function updateExportSpec(id: string, changes: Partial<ExportSpec>): Promise<void> {
  await db.exportSpecs.update(id, changes)
}

export async function deletePhotoRecord(id: string): Promise<void> {
  await db.photoRecords.delete(id)
  await db.changeLogs.where("photoRecordId").equals(id).delete()
}

export async function deleteProject(id: string): Promise<void> {
  await db.projects.delete(id)
  const records = await db.photoRecords.where("projectId").equals(id).toArray()
  const recordIds = records.map((r) => r.id)
  await db.photoRecords.where("projectId").equals(id).delete()
  for (const rid of recordIds) {
    await db.changeLogs.where("photoRecordId").equals(rid).delete()
  }
}
