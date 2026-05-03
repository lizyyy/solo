const initSqlJs = require('sql.js')
const path = require('path')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')

let db
let dbPath

const getDbPath = () => {
  const appDataPath =
    process.env.APPDATA ||
    (process.platform === 'darwin'
      ? path.join(process.env.HOME, 'Library', 'Application Support')
      : path.join(process.env.HOME, '.local', 'share'))
  
  const appDir = path.join(appDataPath, 'MediaLicenseChecker')
  if (!fs.existsSync(appDir)) {
    fs.mkdirSync(appDir, { recursive: true })
  }
  return path.join(appDir, 'media-license.db')
}

const initDatabase = async () => {
  const SQL = await initSqlJs()
  dbPath = getDbPath()
  
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }
  
  createTables()
  
  return true
}

const createTables = () => {
  db.run(`
    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      tags TEXT,
      file_path TEXT,
      file_fingerprint TEXT,
      license_source TEXT,
      allowed_platforms TEXT,
      allowed_clients TEXT,
      commercial_allowed INTEGER DEFAULT 1,
      expire_date TEXT,
      requires_attribution INTEGER DEFAULT 0,
      attribution_text TEXT,
      notes TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `)
  
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      client_name TEXT,
      target_platforms TEXT,
      description TEXT,
      status TEXT DEFAULT 'draft',
      created_at TEXT,
      updated_at TEXT
    )
  `)
  
  db.run(`
    CREATE TABLE IF NOT EXISTS timelines (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      material_id TEXT,
      material_name TEXT,
      start_time INTEGER,
      end_time INTEGER,
      purpose TEXT,
      target_platform TEXT,
      client_name TEXT,
      notes TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )
  `)
  
  saveDatabase()
}

const saveDatabase = () => {
  if (db && dbPath) {
    const data = db.export()
    const buffer = Buffer.from(data)
    fs.writeFileSync(dbPath, buffer)
  }
}

const parseArray = (str) => {
  if (!str) return []
  try {
    return JSON.parse(str)
  } catch {
    return str.split(',').map(s => s.trim()).filter(Boolean)
  }
}

const stringifyArray = (arr) => {
  if (!arr) return null
  return JSON.stringify(Array.isArray(arr) ? arr : [arr])
}

const mapMaterialRow = (row) => ({
  id: row[0],
  name: row[1],
  type: row[2],
  tags: parseArray(row[3]),
  file_path: row[4],
  file_fingerprint: row[5],
  license_source: row[6],
  allowed_platforms: parseArray(row[7]),
  allowed_clients: parseArray(row[8]),
  commercial_allowed: row[9] === 1,
  expire_date: row[10],
  requires_attribution: row[11] === 1,
  attribution_text: row[12],
  notes: row[13],
  created_at: row[14],
  updated_at: row[15],
})

const mapProjectRow = (row) => ({
  id: row[0],
  name: row[1],
  client_name: row[2],
  target_platforms: parseArray(row[3]),
  description: row[4],
  status: row[5],
  created_at: row[6],
  updated_at: row[7],
})

const mapTimelineRow = (row) => ({
  id: row[0],
  project_id: row[1],
  material_id: row[2],
  material_name: row[3],
  start_time: row[4],
  end_time: row[5],
  purpose: row[6],
  target_platform: row[7],
  client_name: row[8],
  notes: row[9],
  created_at: row[10],
  updated_at: row[11],
})

const getAllMaterials = () => {
  const stmt = db.prepare('SELECT * FROM materials ORDER BY created_at DESC')
  const results = []
  while (stmt.step()) {
    results.push(mapMaterialRow(stmt.get()))
  }
  stmt.free()
  return results
}

const getMaterialById = (id) => {
  const stmt = db.prepare('SELECT * FROM materials WHERE id = ?')
  stmt.bind([id])
  if (stmt.step()) {
    const result = mapMaterialRow(stmt.get())
    stmt.free()
    return result
  }
  stmt.free()
  return null
}

const createMaterial = (material) => {
  const id = uuidv4()
  const now = new Date().toISOString()
  
  db.run(`
    INSERT INTO materials (
      id, name, type, tags, file_path, file_fingerprint,
      license_source, allowed_platforms, allowed_clients,
      commercial_allowed, expire_date, requires_attribution,
      attribution_text, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    material.name,
    material.type,
    stringifyArray(material.tags),
    material.file_path,
    material.file_fingerprint,
    material.license_source,
    stringifyArray(material.allowed_platforms),
    stringifyArray(material.allowed_clients),
    material.commercial_allowed ? 1 : 0,
    material.expire_date,
    material.requires_attribution ? 1 : 0,
    material.attribution_text,
    material.notes,
    now,
    now,
  ])
  
  saveDatabase()
  return getMaterialById(id)
}

const updateMaterial = (id, material) => {
  const now = new Date().toISOString()
  
  db.run(`
    UPDATE materials SET
      name = ?, type = ?, tags = ?, file_path = ?, file_fingerprint = ?,
      license_source = ?, allowed_platforms = ?, allowed_clients = ?,
      commercial_allowed = ?, expire_date = ?, requires_attribution = ?,
      attribution_text = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `, [
    material.name,
    material.type,
    stringifyArray(material.tags),
    material.file_path,
    material.file_fingerprint,
    material.license_source,
    stringifyArray(material.allowed_platforms),
    stringifyArray(material.allowed_clients),
    material.commercial_allowed ? 1 : 0,
    material.expire_date,
    material.requires_attribution ? 1 : 0,
    material.attribution_text,
    material.notes,
    now,
    id,
  ])
  
  saveDatabase()
  return getMaterialById(id)
}

const deleteMaterial = (id) => {
  db.run('DELETE FROM materials WHERE id = ?', [id])
  saveDatabase()
  return true
}

const importMaterials = (materials) => {
  const results = { success: 0, errors: [], importedIds: [] }
  
  for (const material of materials) {
    try {
      if (!material.name || !material.type) {
        results.errors.push({ material: material.name || '未命名', error: '缺少必填字段: name 或 type' })
        continue
      }
      const created = createMaterial(material)
      results.success++
      results.importedIds.push(created.id)
    } catch (e) {
      results.errors.push({ material: material.name || '未命名', error: e.message })
    }
  }
  
  return results
}

const getAllProjects = () => {
  const stmt = db.prepare('SELECT * FROM projects ORDER BY created_at DESC')
  const results = []
  while (stmt.step()) {
    results.push(mapProjectRow(stmt.get()))
  }
  stmt.free()
  return results
}

const getProjectById = (id) => {
  const stmt = db.prepare('SELECT * FROM projects WHERE id = ?')
  stmt.bind([id])
  if (stmt.step()) {
    const result = mapProjectRow(stmt.get())
    stmt.free()
    return result
  }
  stmt.free()
  return null
}

const createProject = (project) => {
  const id = uuidv4()
  const now = new Date().toISOString()
  
  db.run(`
    INSERT INTO projects (
      id, name, client_name, target_platforms, description,
      status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    project.name,
    project.client_name,
    stringifyArray(project.target_platforms),
    project.description,
    project.status || 'draft',
    now,
    now,
  ])
  
  saveDatabase()
  return getProjectById(id)
}

const updateProject = (id, project) => {
  const now = new Date().toISOString()
  
  db.run(`
    UPDATE projects SET
      name = ?, client_name = ?, target_platforms = ?, description = ?,
      status = ?, updated_at = ?
    WHERE id = ?
  `, [
    project.name,
    project.client_name,
    stringifyArray(project.target_platforms),
    project.description,
    project.status,
    now,
    id,
  ])
  
  saveDatabase()
  return getProjectById(id)
}

const deleteProject = (id) => {
  db.run('DELETE FROM timelines WHERE project_id = ?', [id])
  db.run('DELETE FROM projects WHERE id = ?', [id])
  saveDatabase()
  return true
}

const getTimelinesByProject = (projectId) => {
  const stmt = db.prepare('SELECT * FROM timelines WHERE project_id = ? ORDER BY start_time')
  stmt.bind([projectId])
  const results = []
  while (stmt.step()) {
    results.push(mapTimelineRow(stmt.get()))
  }
  stmt.free()
  return results
}

const createTimeline = (timeline) => {
  const id = uuidv4()
  const now = new Date().toISOString()
  
  db.run(`
    INSERT INTO timelines (
      id, project_id, material_id, material_name, start_time, end_time,
      purpose, target_platform, client_name, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    timeline.project_id,
    timeline.material_id,
    timeline.material_name,
    timeline.start_time,
    timeline.end_time,
    timeline.purpose,
    timeline.target_platform,
    timeline.client_name,
    timeline.notes,
    now,
    now,
  ])
  
  saveDatabase()
  return { id, ...timeline, created_at: now, updated_at: now }
}

const updateTimeline = (id, timeline) => {
  const now = new Date().toISOString()
  
  db.run(`
    UPDATE timelines SET
      project_id = ?, material_id = ?, material_name = ?, start_time = ?,
      end_time = ?, purpose = ?, target_platform = ?, client_name = ?,
      notes = ?, updated_at = ?
    WHERE id = ?
  `, [
    timeline.project_id,
    timeline.material_id,
    timeline.material_name,
    timeline.start_time,
    timeline.end_time,
    timeline.purpose,
    timeline.target_platform,
    timeline.client_name,
    timeline.notes,
    now,
    id,
  ])
  
  saveDatabase()
  return { id, ...timeline, updated_at: now }
}

const deleteTimeline = (id) => {
  db.run('DELETE FROM timelines WHERE id = ?', [id])
  saveDatabase()
  return true
}

const exportProject = (projectId) => {
  const project = getProjectById(projectId)
  if (!project) return null
  
  const timelines = getTimelinesByProject(projectId)
  const materialIds = [...new Set(timelines.filter(t => t.material_id).map(t => t.material_id))]
  const materials = materialIds.map(id => getMaterialById(id)).filter(Boolean)
  
  return {
    version: '1.0',
    export_at: new Date().toISOString(),
    project,
    timelines,
    materials,
  }
}

const importProject = (data) => {
  const results = { success: false, errors: [] }
  
  try {
    if (!data.project || !data.project.name) {
      results.errors.push('缺少项目名称')
      return results
    }
    
    const project = createProject({
      name: data.project.name + ' (导入)',
      client_name: data.project.client_name,
      target_platforms: data.project.target_platforms || [],
      description: data.project.description,
      status: data.project.status || 'draft',
    })
    
    const materialIdMap = {}
    if (data.materials && Array.isArray(data.materials)) {
      for (const material of data.materials) {
        const newMaterial = createMaterial({
          ...material,
          id: undefined,
          created_at: undefined,
          updated_at: undefined,
        })
        materialIdMap[material.id] = newMaterial.id
      }
    }
    
    if (data.timelines && Array.isArray(data.timelines)) {
      for (const timeline of data.timelines) {
        const newMaterialId = materialIdMap[timeline.material_id] || timeline.material_id
        createTimeline({
          ...timeline,
          project_id: project.id,
          material_id: newMaterialId,
          id: undefined,
          created_at: undefined,
          updated_at: undefined,
        })
      }
    }
    
    results.success = true
    results.projectId = project.id
    return results
  } catch (e) {
    results.errors.push(e.message)
    return results
  }
}

module.exports = {
  initDatabase,
  getAllMaterials,
  getMaterialById,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  importMaterials,
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getTimelinesByProject,
  createTimeline,
  updateTimeline,
  deleteTimeline,
  exportProject,
  importProject,
  db,
}
