const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../models/types');

class Store {
  constructor() {
    this.dataDir = DATA_DIR;
    this.files = {
      materials: 'materials.json',
      schedules: 'schedules.json',
      sensitiveWords: 'sensitive-words.json',
      waivers: 'waivers.json',
      problems: 'problems.json'
    };
    this.ensureDataDir();
    this.initFiles();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  initFiles() {
    Object.values(this.files).forEach(file => {
      const filePath = path.join(this.dataDir, file);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify([], null, 2));
      }
    });
  }

  read(fileName) {
    const filePath = path.join(this.dataDir, this.files[fileName]);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  }

  write(fileName, data) {
    const filePath = path.join(this.dataDir, this.files[fileName]);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  getAllMaterials() {
    return this.read('materials');
  }

  getMaterialById(id) {
    return this.getAllMaterials().find(m => m.id === id);
  }

  getMaterialBySourceId(sourceId) {
    return this.getAllMaterials().find(m => m.sourceId === sourceId);
  }

  addMaterial(material) {
    const materials = this.getAllMaterials();
    materials.push(material);
    this.write('materials', materials);
    return material;
  }

  updateMaterial(id, updates) {
    const materials = this.getAllMaterials();
    const index = materials.findIndex(m => m.id === id);
    if (index !== -1) {
      materials[index] = { ...materials[index], ...updates };
      this.write('materials', materials);
      return materials[index];
    }
    return null;
  }

  getAllSchedules() {
    return this.read('schedules');
  }

  getScheduleByMaterialId(materialId) {
    return this.getAllSchedules().find(s => s.materialId === materialId);
  }

  addSchedule(schedule) {
    const schedules = this.getAllSchedules();
    schedules.push(schedule);
    this.write('schedules', schedules);
    return schedule;
  }

  updateSchedule(materialId, updates) {
    const schedules = this.getAllSchedules();
    const index = schedules.findIndex(s => s.materialId === materialId);
    if (index !== -1) {
      schedules[index] = { ...schedules[index], ...updates };
      this.write('schedules', schedules);
      return schedules[index];
    }
    return null;
  }

  getAllSensitiveWords() {
    return this.read('sensitiveWords');
  }

  addSensitiveWords(words) {
    const existing = this.getAllSensitiveWords();
    const existingSet = new Set(existing.map(w => w.word));
    const newWords = words.filter(w => !existingSet.has(w.word));
    if (newWords.length > 0) {
      const all = [...existing, ...newWords];
      this.write('sensitiveWords', all);
      return newWords;
    }
    return [];
  }

  getAllWaivers() {
    return this.read('waivers');
  }

  getWaiversByProblemId(problemId) {
    return this.getAllWaivers().filter(w => w.problemId === problemId);
  }

  addWaiver(waiver) {
    const waivers = this.getAllWaivers();
    waivers.push(waiver);
    this.write('waivers', waivers);
    return waiver;
  }

  getAllProblems() {
    return this.read('problems');
  }

  getProblemsByMaterialId(materialId) {
    return this.getAllProblems().filter(p => p.materialId === materialId);
  }

  setProblems(problems) {
    this.write('problems', problems);
  }

  clearProblems() {
    this.write('problems', []);
  }

  reset() {
    Object.keys(this.files).forEach(key => {
      this.write(key, []);
    });
  }
}

module.exports = new Store();