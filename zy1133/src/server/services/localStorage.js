const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../../data');
const ANNOTATIONS_DIR = path.join(DATA_DIR, 'annotations');
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');

class LocalStorage {
  constructor() {
    this.ensureDirectories();
  }

  ensureDirectories() {
    [DATA_DIR, ANNOTATIONS_DIR, SESSIONS_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  generateId() {
    return `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  loadSampleData() {
    const sampleDir = path.join(DATA_DIR, 'sample');
    
    try {
      const sessions = this.parseCSV(fs.readFileSync(path.join(sampleDir, 'sessions.csv'), 'utf-8'));
      const setlist = JSON.parse(fs.readFileSync(path.join(sampleDir, 'setlist.json'), 'utf-8'));
      const takes = JSON.parse(fs.readFileSync(path.join(sampleDir, 'takes.json'), 'utf-8'));
      const pitchBeat = this.parseCSV(fs.readFileSync(path.join(sampleDir, 'pitch-beat.csv'), 'utf-8'));
      
      return {
        id: 'sample',
        name: '示例数据',
        createdAt: new Date().toISOString(),
        data: {
          sessions,
          setlist,
          takes,
          pitchBeat
        }
      };
    } catch (error) {
      console.error('加载示例数据失败:', error);
      return null;
    }
  }

  parseCSV(content) {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',');
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = this.splitCSVLine(lines[i]);
      if (values.length === headers.length) {
        const row = {};
        headers.forEach((header, idx) => {
          row[header.trim()] = this.parseValue(values[idx].trim());
        });
        data.push(row);
      }
    }
    
    return data;
  }

  splitCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    
    return result;
  }

  parseValue(value) {
    if (value === '' || value === null) return '';
    if (value === 'true') return true;
    if (value === 'false') return false;
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== '') return num;
    return value;
  }

  saveProject(projectData) {
    const id = projectData.id || this.generateId();
    const project = {
      id,
      name: projectData.name || `项目 ${new Date().toLocaleDateString()}`,
      createdAt: projectData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      data: projectData.data
    };
    
    const filePath = path.join(SESSIONS_DIR, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(project, null, 2), 'utf-8');
    
    return project;
  }

  loadProject(id) {
    const filePath = path.join(SESSIONS_DIR, `${id}.json`);
    
    if (!fs.existsSync(filePath)) {
      if (id === 'sample') {
        return this.loadSampleData();
      }
      return null;
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`加载项目 ${id} 失败:`, error);
      return null;
    }
  }

  listProjects() {
    if (!fs.existsSync(SESSIONS_DIR)) return [];
    
    const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
    const projects = [];
    
    files.forEach(file => {
      try {
        const content = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf-8');
        const project = JSON.parse(content);
        projects.push({
          id: project.id,
          name: project.name,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt
        });
      } catch (error) {
        console.error(`读取项目文件 ${file} 失败:`, error);
      }
    });
    
    projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    const sample = this.loadSampleData();
    if (sample) {
      projects.unshift({
        id: 'sample',
        name: '示例数据',
        createdAt: sample.createdAt,
        updatedAt: sample.createdAt,
        isSample: true
      });
    }
    
    return projects;
  }

  deleteProject(id) {
    if (id === 'sample') {
      return false;
    }
    
    const filePath = path.join(SESSIONS_DIR, `${id}.json`);
    const annotationsPath = this.getAnnotationsPath(id);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    if (fs.existsSync(annotationsPath)) {
      fs.unlinkSync(annotationsPath);
    }
    
    return true;
  }

  getAnnotationsPath(projectId) {
    return path.join(ANNOTATIONS_DIR, `${projectId}_annotations.json`);
  }

  loadAnnotations(projectId) {
    const filePath = this.getAnnotationsPath(projectId);
    
    if (!fs.existsSync(filePath)) {
      return {
        projectId,
        markers: {},
        notes: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`加载注释 ${projectId} 失败:`, error);
      return {
        projectId,
        markers: {},
        notes: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
  }

  saveAnnotations(projectId, annotations) {
    const filePath = this.getAnnotationsPath(projectId);
    
    const data = {
      projectId,
      markers: annotations.markers || {},
      notes: annotations.notes || {},
      createdAt: annotations.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    
    return data;
  }

  setMarker(projectId, itemId, markerType) {
    const annotations = this.loadAnnotations(projectId);
    
    if (!annotations.markers) {
      annotations.markers = {};
    }
    
    annotations.markers[itemId] = {
      type: markerType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    return this.saveAnnotations(projectId, annotations);
  }

  removeMarker(projectId, itemId) {
    const annotations = this.loadAnnotations(projectId);
    
    if (annotations.markers && annotations.markers[itemId]) {
      delete annotations.markers[itemId];
    }
    
    return this.saveAnnotations(projectId, annotations);
  }

  setNote(projectId, itemId, noteText) {
    const annotations = this.loadAnnotations(projectId);
    
    if (!annotations.notes) {
      annotations.notes = {};
    }
    
    const existing = annotations.notes[itemId];
    annotations.notes[itemId] = {
      text: noteText,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    return this.saveAnnotations(projectId, annotations);
  }

  removeNote(projectId, itemId) {
    const annotations = this.loadAnnotations(projectId);
    
    if (annotations.notes && annotations.notes[itemId]) {
      delete annotations.notes[itemId];
    }
    
    return this.saveAnnotations(projectId, annotations);
  }

  getFullAnnotations(projectId) {
    return this.loadAnnotations(projectId);
  }
}

module.exports = new LocalStorage();
