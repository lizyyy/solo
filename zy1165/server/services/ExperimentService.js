const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

class ExperimentService {
  constructor() {
    this.experiments = new Map();
    this.dataDir = path.join(__dirname, '../../data');
    this._ensureDataDir();
    this._loadFromFile();
  }

  _ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  _getFilePath() {
    return path.join(this.dataDir, 'experiments.json');
  }

  _loadFromFile() {
    try {
      const filePath = this._getFilePath();
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        const experiments = JSON.parse(data);
        experiments.forEach(exp => {
          this.experiments.set(exp.id, exp);
        });
      }
    } catch (error) {
      console.error('加载实验数据失败:', error);
    }
  }

  _saveToFile() {
    try {
      const filePath = this._getFilePath();
      const experiments = Array.from(this.experiments.values());
      fs.writeFileSync(filePath, JSON.stringify(experiments, null, 2), 'utf8');
    } catch (error) {
      console.error('保存实验数据失败:', error);
    }
  }

  createExperiment(config, result) {
    const id = uuidv4();
    const experiment = {
      id,
      name: config.name || `实验-${new Date().toISOString().slice(0, 10)}`,
      config,
      result,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    this.experiments.set(id, experiment);
    this._saveToFile();
    
    return experiment;
  }

  getExperiment(id) {
    return this.experiments.get(id);
  }

  getAllExperiments() {
    return Array.from(this.experiments.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  deleteExperiment(id) {
    const deleted = this.experiments.delete(id);
    if (deleted) {
      this._saveToFile();
    }
    return deleted;
  }
}

module.exports = ExperimentService;
