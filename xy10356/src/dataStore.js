const fs = require('fs');
const path = require('path');

class DataStore {
  constructor(baseDir = '.') {
    this.baseDir = baseDir;
    this.dataPath = path.join(baseDir, 'data');
    this.screensFile = path.join(this.dataPath, 'screens.json');
    this.contractsFile = path.join(this.dataPath, 'contracts.json');
    this.placementsFile = path.join(this.dataPath, 'placements.json');
    this.changesFile = path.join(this.dataPath, 'changes.json');
    this.giftsFile = path.join(this.dataPath, 'gifts.json');
    this.published = path.join(this.dataPath, 'published.json');
    
    this.ensureDataDir();
    this.initEmptyFiles();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
  }

  initEmptyFiles() {
    if (!fs.existsSync(this.screensFile)) fs.writeFileSync(this.screensFile, JSON.stringify([]));
    if (!fs.existsSync(this.contractsFile)) fs.writeFileSync(this.contractsFile, JSON.stringify([]));
    if (!fs.existsSync(this.placementsFile)) fs.writeFileSync(this.placementsFile, JSON.stringify([]));
    if (!fs.existsSync(this.changesFile)) fs.writeFileSync(this.changesFile, JSON.stringify([]));
    if (!fs.existsSync(this.giftsFile)) fs.writeFileSync(this.giftsFile, JSON.stringify([]));
    if (!fs.existsSync(this.published)) fs.writeFileSync(this.published, JSON.stringify({}));
  }

  getScreens() {
    return JSON.parse(fs.readFileSync(this.screensFile, 'utf8'));
  }

  getContracts() {
    return JSON.parse(fs.readFileSync(this.contractsFile, 'utf8'));
  }

  getPlacements() {
    return JSON.parse(fs.readFileSync(this.placementsFile, 'utf8'));
  }

  getChanges() {
    return JSON.parse(fs.readFileSync(this.changesFile, 'utf8'));
  }

  getGifts() {
    return JSON.parse(fs.readFileSync(this.giftsFile, 'utf8'));
  }

  getPublished() {
    return JSON.parse(fs.readFileSync(this.published, 'utf8'));
  }

  addScreen(screen) {
    const screens = this.getScreens();
    if (!screens.find(s => s.id === screen.id)) {
      screens.push(screen);
      fs.writeFileSync(this.screensFile, JSON.stringify(screens, null, 2));
      return true;
    }
    return false;
  }

  addContract(contract) {
    const contracts = this.getContracts();
    if (!contracts.find(c => c.id === contract.id)) {
      contracts.push(contract);
      fs.writeFileSync(this.contractsFile, JSON.stringify(contracts, null, 2));
      return true;
    }
    return false;
  }

  addPlacement(placement) {
    const placements = this.getPlacements();
    placements.push(placement);
    fs.writeFileSync(this.placementsFile, JSON.stringify(placements, null, 2));
  }

  addChange(change) {
    const changes = this.getChanges();
    changes.push(change);
    fs.writeFileSync(this.changesFile, JSON.stringify(changes, null, 2));
  }

  addGift(gift) {
    const gifts = this.getGifts();
    gifts.push(gift);
    fs.writeFileSync(this.giftsFile, JSON.stringify(gifts, null, 2));
  }

  updateChange(changeId, updates) {
    const changes = this.getChanges();
    const index = changes.findIndex(c => c.id === changeId);
    if (index !== -1) {
      changes[index] = { ...changes[index], ...updates };
      fs.writeFileSync(this.changesFile, JSON.stringify(changes, null, 2));
      return true;
    }
    return false;
  }

  setPublished(data) {
    fs.writeFileSync(this.published, JSON.stringify(data, null, 2));
  }

  clearAll() {
    this.initEmptyFiles();
  }
}

module.exports = DataStore;
