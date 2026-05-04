const { readJSONFile, writeJSONFile, generateId, getTimestamp } = require('../utils/fileStorage');

const REHEARSALS_FILE = 'rehearsals.json';

class Rehearsal {
  static getAll() {
    return readJSONFile(REHEARSALS_FILE);
  }

  static getById(id) {
    const rehearsals = this.getAll();
    return rehearsals.find(rehearsal => rehearsal.id === id);
  }

  static getByLevelId(levelId) {
    const rehearsals = this.getAll();
    return rehearsals.filter(rehearsal => rehearsal.levelId === levelId);
  }

  static create(rehearsalData) {
    const rehearsals = this.getAll();
    const newRehearsal = {
      id: generateId(),
      levelId: rehearsalData.levelId,
      levelName: rehearsalData.levelName,
      startTime: getTimestamp(),
      endTime: getTimestamp(),
      totalScore: rehearsalData.totalScore || 0,
      actions: rehearsalData.actions || [],
      deductions: rehearsalData.deductions || [],
      replayData: rehearsalData.replayData,
      notes: rehearsalData.notes || '',
      createdAt: getTimestamp(),
      updatedAt: getTimestamp()
    };
    rehearsals.push(newRehearsal);
    writeJSONFile(REHEARSALS_FILE, rehearsals);
    return newRehearsal;
  }

  static update(id, rehearsalData) {
    const rehearsals = this.getAll();
    const index = rehearsals.findIndex(rehearsal => rehearsal.id === id);
    if (index === -1) return null;
    
    rehearsals[index] = {
      ...rehearsals[index],
      ...rehearsalData,
      updatedAt: getTimestamp()
    };
    writeJSONFile(REHEARSALS_FILE, rehearsals);
    return rehearsals[index];
  }

  static delete(id) {
    const rehearsals = this.getAll();
    const filteredRehearsals = rehearsals.filter(rehearsal => rehearsal.id !== id);
    if (filteredRehearsals.length === rehearsals.length) return false;
    writeJSONFile(REHEARSALS_FILE, filteredRehearsals);
    return true;
  }
}

module.exports = Rehearsal;
