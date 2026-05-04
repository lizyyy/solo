import type {
  Project,
  Fixture,
  Cue,
  Circuit,
  MediaFile,
  BannedDevice,
  Issue,
  ProjectSummary,
} from '../types';
import { getDb } from './database';
import { randomUUID } from 'crypto';

function generateId(): string {
  return randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

export const projectModel = {
  create(name: string, venue: string = ''): Project {
    const db = getDb();
    const id = generateId();
    const createdAt = now();
    const project: Project = {
      id,
      name,
      venue,
      createdAt,
      updatedAt: createdAt,
    };
    
    const stmt = db.prepare(
      'INSERT INTO projects (id, name, venue, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(project.id, project.name, project.venue, project.createdAt, project.updatedAt);
    
    return project;
  },

  getById(id: string): Project | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      venue: row.venue || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  getAll(): Project[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as any[];
    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      venue: row.venue || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },

  update(id: string, updates: Partial<Pick<Project, 'name' | 'venue'>>): Project | null {
    const db = getDb();
    const updatedAt = now();
    const setClauses: string[] = [];
    const values: any[] = [];
    
    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }
    if (updates.venue !== undefined) {
      setClauses.push('venue = ?');
      values.push(updates.venue);
    }
    
    if (setClauses.length === 0) return this.getById(id);
    
    setClauses.push('updated_at = ?');
    values.push(updatedAt, id);
    
    const stmt = db.prepare(`UPDATE projects SET ${setClauses.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.getById(id);
  },

  delete(id: string): boolean {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM projects WHERE id = ?');
    const result = stmt.run(id);
    return (result as any).changes > 0;
  },

  getSummary(id: string): ProjectSummary | null {
    const project = this.getById(id);
    if (!project) return null;
    
    const db = getDb();
    
    const fixtureCount = (db.prepare('SELECT COUNT(*) as count FROM fixtures WHERE project_id = ?').get(id) as any).count;
    const cueCount = (db.prepare('SELECT COUNT(*) as count FROM cues WHERE project_id = ?').get(id) as any).count;
    const circuitCount = (db.prepare('SELECT COUNT(*) as count FROM circuits WHERE project_id = ?').get(id) as any).count;
    const mediaCount = (db.prepare('SELECT COUNT(*) as count FROM media_files WHERE project_id = ?').get(id) as any).count;
    const issueCount = (db.prepare('SELECT COUNT(*) as count FROM issues WHERE project_id = ?').get(id) as any).count;
    const unresolvedIssueCount = (db.prepare('SELECT COUNT(*) as count FROM issues WHERE project_id = ? AND resolved = 0').get(id) as any).count;
    
    return {
      project,
      fixtureCount,
      cueCount,
      circuitCount,
      mediaCount,
      issueCount,
      unresolvedIssueCount,
    };
  },
};

export const fixtureModel = {
  create(data: Omit<Fixture, 'id'>): Fixture {
    const db = getDb();
    const id = generateId();
    const fixture: Fixture = {
      id,
      ...data,
    };
    
    const stmt = db.prepare(
      `INSERT INTO fixtures (
        id, project_id, name, type, dmx_start_address, 
        dmx_channel_count, universe, power, circuit_id, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      fixture.id,
      fixture.projectId,
      fixture.name,
      fixture.type,
      fixture.dmxStartAddress,
      fixture.dmxChannelCount,
      fixture.universe,
      fixture.power,
      fixture.circuitId,
      fixture.note
    );
    
    return fixture;
  },

  getByProjectId(projectId: string): Fixture[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM fixtures WHERE project_id = ? ORDER BY dmx_start_address').all(projectId) as any[];
    return rows.map((row: any) => ({
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      type: row.type,
      dmxStartAddress: row.dmx_start_address,
      dmxChannelCount: row.dmx_channel_count,
      universe: row.universe,
      power: row.power,
      circuitId: row.circuit_id,
      note: row.note,
    }));
  },

  deleteByProjectId(projectId: string): number {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM fixtures WHERE project_id = ?');
    const result = stmt.run(projectId);
    return (result as any).changes;
  },
};

export const cueModel = {
  create(data: Omit<Cue, 'id'>): Cue {
    const db = getDb();
    const id = generateId();
    const cue: Cue = {
      id,
      ...data,
    };
    
    const stmt = db.prepare(
      `INSERT INTO cues (
        id, project_id, cue_number, name, description, 
        media_references, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      cue.id,
      cue.projectId,
      cue.cueNumber,
      cue.name,
      cue.description,
      JSON.stringify(cue.mediaReferences),
      cue.note
    );
    
    return cue;
  },

  getByProjectId(projectId: string): Cue[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM cues WHERE project_id = ? ORDER BY cue_number').all(projectId) as any[];
    return rows.map((row: any) => ({
      id: row.id,
      projectId: row.project_id,
      cueNumber: row.cue_number,
      name: row.name,
      description: row.description,
      mediaReferences: JSON.parse(row.media_references || '[]'),
      note: row.note,
    }));
  },

  deleteByProjectId(projectId: string): number {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM cues WHERE project_id = ?');
    const result = stmt.run(projectId);
    return (result as any).changes;
  },
};

export const circuitModel = {
  create(data: Omit<Circuit, 'id'>): Circuit {
    const db = getDb();
    const id = generateId();
    const circuit: Circuit = {
      id,
      ...data,
    };
    
    const stmt = db.prepare(
      `INSERT INTO circuits (
        id, project_id, name, max_power, description, note
      ) VALUES (?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      circuit.id,
      circuit.projectId,
      circuit.name,
      circuit.maxPower,
      circuit.description,
      circuit.note
    );
    
    return circuit;
  },

  getByProjectId(projectId: string): Circuit[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM circuits WHERE project_id = ? ORDER BY name').all(projectId) as any[];
    return rows.map((row: any) => ({
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      maxPower: row.max_power,
      description: row.description,
      note: row.note,
    }));
  },

  deleteByProjectId(projectId: string): number {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM circuits WHERE project_id = ?');
    const result = stmt.run(projectId);
    return (result as any).changes;
  },
};

export const mediaFileModel = {
  create(data: Omit<MediaFile, 'id'>): MediaFile {
    const db = getDb();
    const id = generateId();
    const mediaFile: MediaFile = {
      id,
      ...data,
    };
    
    const stmt = db.prepare(
      `INSERT INTO media_files (
        id, project_id, name, path, size, file_type
      ) VALUES (?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      mediaFile.id,
      mediaFile.projectId,
      mediaFile.name,
      mediaFile.path,
      mediaFile.size,
      mediaFile.fileType
    );
    
    return mediaFile;
  },

  getByProjectId(projectId: string): MediaFile[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM media_files WHERE project_id = ? ORDER BY name').all(projectId) as any[];
    return rows.map((row: any) => ({
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      path: row.path,
      size: row.size,
      fileType: row.file_type,
    }));
  },

  deleteByProjectId(projectId: string): number {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM media_files WHERE project_id = ?');
    const result = stmt.run(projectId);
    return (result as any).changes;
  },
};

export const bannedDeviceModel = {
  create(data: Omit<BannedDevice, 'id'>): BannedDevice {
    const db = getDb();
    const id = generateId();
    const device: BannedDevice = {
      id,
      ...data,
    };
    
    const stmt = db.prepare(
      `INSERT INTO banned_devices (
        id, project_id, name, reason
      ) VALUES (?, ?, ?, ?)`
    );
    stmt.run(
      device.id,
      device.projectId,
      device.name,
      device.reason
    );
    
    return device;
  },

  getByProjectId(projectId: string): BannedDevice[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM banned_devices WHERE project_id = ? ORDER BY name').all(projectId) as any[];
    return rows.map((row: any) => ({
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      reason: row.reason,
    }));
  },

  deleteByProjectId(projectId: string): number {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM banned_devices WHERE project_id = ?');
    const result = stmt.run(projectId);
    return (result as any).changes;
  },
};

export const issueModel = {
  create(data: Omit<Issue, 'id' | 'createdAt'>): Issue {
    const db = getDb();
    const id = generateId();
    const issue: Issue = {
      id,
      ...data,
      createdAt: now(),
    };
    
    const stmt = db.prepare(
      `INSERT INTO issues (
        id, project_id, type, severity, title, description,
        affected_items, resolved, resolution_note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      issue.id,
      issue.projectId,
      issue.type,
      issue.severity,
      issue.title,
      issue.description,
      JSON.stringify(issue.affectedItems),
      issue.resolved ? 1 : 0,
      issue.resolutionNote,
      issue.createdAt
    );
    
    return issue;
  },

  getByProjectId(projectId: string, includeResolved: boolean = true): Issue[] {
    const db = getDb();
    let query = 'SELECT * FROM issues WHERE project_id = ?';
    const params: any[] = [projectId];
    
    if (!includeResolved) {
      query += ' AND resolved = 0';
    }
    
    query += ' ORDER BY created_at DESC';
    
    const rows = db.prepare(query).all(...params) as any[];
    return rows.map((row: any) => ({
      id: row.id,
      projectId: row.project_id,
      type: row.type,
      severity: row.severity,
      title: row.title,
      description: row.description,
      affectedItems: JSON.parse(row.affected_items || '[]'),
      resolved: row.resolved === 1,
      resolutionNote: row.resolution_note,
      createdAt: row.created_at,
    }));
  },

  update(id: string, updates: { resolved?: boolean; resolutionNote?: string }): Issue | null {
    const db = getDb();
    const setClauses: string[] = [];
    const values: any[] = [];
    
    if (updates.resolved !== undefined) {
      setClauses.push('resolved = ?');
      values.push(updates.resolved ? 1 : 0);
    }
    if (updates.resolutionNote !== undefined) {
      setClauses.push('resolution_note = ?');
      values.push(updates.resolutionNote);
    }
    
    if (setClauses.length === 0) return this.getById(id);
    
    values.push(id);
    const stmt = db.prepare(`UPDATE issues SET ${setClauses.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.getById(id);
  },

  getById(id: string): Issue | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM issues WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      projectId: row.project_id,
      type: row.type,
      severity: row.severity,
      title: row.title,
      description: row.description,
      affectedItems: JSON.parse(row.affected_items || '[]'),
      resolved: row.resolved === 1,
      resolutionNote: row.resolution_note,
      createdAt: row.created_at,
    };
  },

  deleteByProjectId(projectId: string): number {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM issues WHERE project_id = ?');
    const result = stmt.run(projectId);
    return (result as any).changes;
  },
};
