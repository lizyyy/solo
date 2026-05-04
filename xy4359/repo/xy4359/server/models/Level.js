const { readJSONFile, writeJSONFile, generateId, getTimestamp } = require('../utils/fileStorage');

const LEVELS_FILE = 'levels.json';

class Level {
  static getAll() {
    return readJSONFile(LEVELS_FILE);
  }

  static getById(id) {
    const levels = this.getAll();
    return levels.find(level => level.id === id);
  }

  static create(levelData) {
    const levels = this.getAll();
    const newLevel = {
      id: generateId(),
      name: levelData.name || '未命名关卡',
      description: levelData.description || '',
      sceneData: levelData.sceneData,
      propsList: levelData.propsList,
      timeline: levelData.timeline,
      stageConfig: levelData.stageConfig,
      createdAt: getTimestamp(),
      updatedAt: getTimestamp()
    };
    levels.push(newLevel);
    writeJSONFile(LEVELS_FILE, levels);
    return newLevel;
  }

  static update(id, levelData) {
    const levels = this.getAll();
    const index = levels.findIndex(level => level.id === id);
    if (index === -1) return null;
    
    levels[index] = {
      ...levels[index],
      ...levelData,
      updatedAt: getTimestamp()
    };
    writeJSONFile(LEVELS_FILE, levels);
    return levels[index];
  }

  static delete(id) {
    const levels = this.getAll();
    const filteredLevels = levels.filter(level => level.id !== id);
    if (filteredLevels.length === levels.length) return false;
    writeJSONFile(LEVELS_FILE, filteredLevels);
    return true;
  }
}

module.exports = Level;
