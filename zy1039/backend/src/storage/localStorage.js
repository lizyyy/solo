const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * 本地文件存储
 * 管理项目数据的保存和加载
 */
class LocalStorage {
  constructor(storageDir = null) {
    this.storageDir = storageDir || path.join(process.cwd(), 'data');
    this.ensureStorageDir();
  }
  
  /**
   * 确保存储目录存在
   */
  async ensureStorageDir() {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }
  }
  
  /**
   * 保存项目
   * @param {Object} projectData - 项目数据
   * @returns {Object} 保存结果
   */
  async saveProject(projectData) {
    const projectId = projectData.id || uuidv4();
    const project = {
      id: projectId,
      name: projectData.name || '未命名项目',
      description: projectData.description || '',
      machine: projectData.machine || null,
      eventSequence: projectData.eventSequence || [],
      executionHistory: projectData.executionHistory || null,
      checkResults: projectData.checkResults || null,
      createdAt: projectData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: projectData.metadata || {}
    };
    
    const filePath = path.join(this.storageDir, `${projectId}.json`);
    
    try {
      await fs.writeFile(filePath, JSON.stringify(project, null, 2), 'utf8');
      return {
        success: true,
        projectId,
        project
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * 加载项目
   * @param {string} projectId - 项目ID
   * @returns {Object} 加载结果
   */
  async loadProject(projectId) {
    const filePath = path.join(this.storageDir, `${projectId}.json`);
    
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const project = JSON.parse(data);
      return {
        success: true,
        project
      };
    } catch (error) {
      return {
        success: false,
        error: error.code === 'ENOENT' ? `项目 "${projectId}" 不存在` : error.message
      };
    }
  }
  
  /**
   * 删除项目
   * @param {string} projectId - 项目ID
   * @returns {Object} 删除结果
   */
  async deleteProject(projectId) {
    const filePath = path.join(this.storageDir, `${projectId}.json`);
    
    try {
      await fs.unlink(filePath);
      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error.code === 'ENOENT' ? `项目 "${projectId}" 不存在` : error.message
      };
    }
  }
  
  /**
   * 列出所有项目
   * @returns {Object} 项目列表
   */
  async listProjects() {
    try {
      const files = await fs.readdir(this.storageDir);
      const projectFiles = files.filter(f => f.endsWith('.json'));
      
      const projects = [];
      for (const file of projectFiles) {
        try {
          const content = await fs.readFile(path.join(this.storageDir, file), 'utf8');
          const project = JSON.parse(content);
          projects.push({
            id: project.id,
            name: project.name,
            description: project.description,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            stateCount: project.machine ? Object.keys(project.machine.states || {}).length : 0,
            eventCount: project.machine ? Object.keys(project.machine.events || {}).length : 0
          });
        } catch (e) {
          // 跳过无效的项目文件
          continue;
        }
      }
      
      // 按更新时间倒序排列
      projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      
      return {
        success: true,
        projects
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        projects: []
      };
    }
  }
  
  /**
   * 导入状态机定义（从原始 JSON/YAML 内容）
   * @param {string} content - 原始内容
   * @param {string} name - 项目名称
   * @returns {Object} 导入结果
   */
  async importMachine(content, name = '导入的状态机') {
    const { parser } = require('../engine');
    
    try {
      const machine = parser.parse(content);
      
      const projectId = uuidv4();
      const project = {
        id: projectId,
        name,
        description: `从导入创建于 ${new Date().toLocaleString()}`,
        machine,
        eventSequence: [],
        executionHistory: null,
        checkResults: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          imported: true,
          importDate: new Date().toISOString()
        }
      };
      
      return {
        success: true,
        projectId,
        project,
        machine
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * 导出状态机定义
   * @param {string} projectId - 项目ID
   * @param {string} format - 格式：'json' 或 'yaml'
   * @returns {Object} 导出结果
   */
  async exportMachine(projectId, format = 'json') {
    const loadResult = await this.loadProject(projectId);
    if (!loadResult.success) {
      return loadResult;
    }
    
    const { parser } = require('../engine');
    const project = loadResult.project;
    
    if (!project.machine) {
      return {
        success: false,
        error: '项目中没有状态机定义'
      };
    }
    
    try {
      const content = format === 'yaml' 
        ? parser.toYAML(project.machine)
        : parser.toJSON(project.machine);
      
      return {
        success: true,
        content,
        format,
        filename: `${project.name || 'state-machine'}.${format}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = LocalStorage;
