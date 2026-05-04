const fs = require('fs-extra');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

class StorageService {
  constructor() {
    fs.ensureDirSync(DATA_DIR);
  }

  async saveProject(project) {
    const projectPath = path.join(DATA_DIR, `${project.id}.json`);
    await fs.writeJson(projectPath, project, { spaces: 2 });
    return project;
  }

  async getProject(projectId) {
    const projectPath = path.join(DATA_DIR, `${projectId}.json`);
    if (!await fs.pathExists(projectPath)) {
      return null;
    }
    return await fs.readJson(projectPath);
  }

  async listProjects() {
    const files = await fs.readdir(DATA_DIR);
    const projects = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const project = await fs.readJson(path.join(DATA_DIR, file));
        projects.push({
          id: project.id,
          name: project.name,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          checkCount: (project.checks || []).length
        });
      }
    }
    
    return projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  async deleteProject(projectId) {
    const projectPath = path.join(DATA_DIR, `${projectId}.json`);
    if (await fs.pathExists(projectPath)) {
      await fs.remove(projectPath);
    }
    return true;
  }

  async loadSettings() {
    const settingsPath = path.join(DATA_DIR, 'settings.json');
    if (!await fs.pathExists(settingsPath)) {
      return {};
    }
    return await fs.readJson(settingsPath);
  }

  async saveSettings(settings) {
    const settingsPath = path.join(DATA_DIR, 'settings.json');
    await fs.writeJson(settingsPath, settings, { spaces: 2 });
    return settings;
  }
}

module.exports = new StorageService();
