const fs = require('fs');
const path = require('path');

const { Athlete, EquipmentItem, ScanRecord, EquipmentCheck, Waiving } = require('./models');

class DataStore {
  constructor(dataDir = './data') {
    this.dataDir = dataDir;
    this.ensureDataDir();
    
    this.athletes = new Map();
    this.equipment = new Map();
    this.bibScans = [];
    this.supplyScans = [];
    this.equipmentChecks = [];
    this.waivings = [];
    
    this.loadAll();
  }
  
  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }
  
  getFilePath(name) {
    return path.join(this.dataDir, `${name}.json`);
  }
  
  loadAll() {
    this.loadAthletes();
    this.loadEquipment();
    this.loadBibScans();
    this.loadSupplyScans();
    this.loadEquipmentChecks();
    this.loadWaivings();
  }
  
  loadAthletes() {
    const file = this.getFilePath('athletes');
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      this.athletes = new Map(data.map(a => [a.bib, new Athlete(a)]));
    }
  }
  
  loadEquipment() {
    const file = this.getFilePath('equipment');
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      this.equipment = new Map(data.map(e => [e.id, new EquipmentItem(e)]));
    }
  }
  
  loadBibScans() {
    const file = this.getFilePath('bibScans');
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      this.bibScans = data.map(s => new ScanRecord(s));
    }
  }
  
  loadSupplyScans() {
    const file = this.getFilePath('supplyScans');
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      this.supplyScans = data.map(s => new ScanRecord(s));
    }
  }
  
  loadEquipmentChecks() {
    const file = this.getFilePath('equipmentChecks');
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      this.equipmentChecks = data.map(c => new EquipmentCheck(c));
    }
  }
  
  loadWaivings() {
    const file = this.getFilePath('waivings');
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      this.waivings = data.map(w => new Waiving(w));
    }
  }
  
  saveAll() {
    this.saveAthletes();
    this.saveEquipment();
    this.saveBibScans();
    this.saveSupplyScans();
    this.saveEquipmentChecks();
    this.saveWaivings();
  }
  
  saveAthletes() {
    const data = Array.from(this.athletes.values());
    fs.writeFileSync(this.getFilePath('athletes'), JSON.stringify(data, null, 2));
  }
  
  saveEquipment() {
    const data = Array.from(this.equipment.values());
    fs.writeFileSync(this.getFilePath('equipment'), JSON.stringify(data, null, 2));
  }
  
  saveBibScans() {
    fs.writeFileSync(this.getFilePath('bibScans'), JSON.stringify(this.bibScans, null, 2));
  }
  
  saveSupplyScans() {
    fs.writeFileSync(this.getFilePath('supplyScans'), JSON.stringify(this.supplyScans, null, 2));
  }
  
  saveEquipmentChecks() {
    fs.writeFileSync(this.getFilePath('equipmentChecks'), JSON.stringify(this.equipmentChecks, null, 2));
  }
  
  saveWaivings() {
    fs.writeFileSync(this.getFilePath('waivings'), JSON.stringify(this.waivings, null, 2));
  }
  
  addAthletes(athletes) {
    athletes.forEach(a => {
      this.athletes.set(a.bib, a);
    });
    this.saveAthletes();
  }
  
  addEquipment(items) {
    items.forEach(e => {
      this.equipment.set(e.id, e);
    });
    this.saveEquipment();
  }
  
  addBibScan(bib, scanner = 'default') {
    const scan = new ScanRecord({
      bib,
      type: 'bib',
      scanner
    });
    this.bibScans.push(scan);
    this.saveBibScans();
    return scan;
  }
  
  addSupplyScan(bib, scanner = 'default') {
    const scan = new ScanRecord({
      bib,
      type: 'supply',
      scanner
    });
    this.supplyScans.push(scan);
    this.saveSupplyScans();
    return scan;
  }
  
  addEquipmentCheck(bib, equipmentId, present) {
    const check = new EquipmentCheck({
      bib,
      equipmentId,
      present
    });
    this.equipmentChecks.push(check);
    this.saveEquipmentChecks();
    return check;
  }
  
  addWaiving(bib, equipmentId, reason, authorizedBy = 'unknown') {
    const waiving = new Waiving({
      bib,
      equipmentId,
      reason,
      authorizedBy
    });
    this.waivings.push(waiving);
    this.saveWaivings();
    return waiving;
  }
  
  hasBibScan(bib) {
    return this.bibScans.some(s => s.bib === bib);
  }
  
  hasSupplyScan(bib) {
    return this.supplyScans.some(s => s.bib === bib);
  }
  
  getLatestBibScan(bib) {
    const scans = this.bibScans.filter(s => s.bib === bib);
    return scans.length > 0 ? scans[scans.length - 1] : null;
  }
  
  getLatestSupplyScan(bib) {
    const scans = this.supplyScans.filter(s => s.bib === bib);
    return scans.length > 0 ? scans[scans.length - 1] : null;
  }
  
  getAthleteEquipmentStatus(bib) {
    const result = {};
    this.equipment.forEach((item, id) => {
      const checks = this.equipmentChecks.filter(c => c.bib === bib && c.equipmentId === id);
      const waiving = this.waivings.find(w => w.bib === bib && w.equipmentId === id);
      
      result[id] = {
        item,
        checked: checks.length > 0,
        present: checks.length > 0 ? checks[checks.length - 1].present : false,
        waived: !!waiving,
        waiving: waiving || null
      };
    });
    return result;
  }
  
  getMissingEquipment(bib) {
    const status = this.getAthleteEquipmentStatus(bib);
    const missing = [];
    
    Object.values(status).forEach(s => {
      if (s.item.required && !s.present && !s.waived) {
        missing.push(s.item);
      }
    });
    
    return missing;
  }
  
  getRawMissingEquipment(bib) {
    const status = this.getAthleteEquipmentStatus(bib);
    const missing = [];
    
    Object.values(status).forEach(s => {
      if (s.item.required && !s.present) {
        missing.push(s.item);
      }
    });
    
    return missing;
  }
  
  getAthletesWithMissingEquipment() {
    const result = [];
    this.athletes.forEach((athlete, bib) => {
      const missing = this.getMissingEquipment(bib);
      if (missing.length > 0) {
        result.push({ athlete, missing });
      }
    });
    return result;
  }
  
  getAthletesWithWaivings() {
    const result = new Map();
    
    this.waivings.forEach(w => {
      if (!result.has(w.bib)) {
        const athlete = this.athletes.get(w.bib);
        result.set(w.bib, { athlete, waivings: [] });
      }
      result.get(w.bib).waivings.push(w);
    });
    
    return Array.from(result.values());
  }
  
  reset() {
    this.athletes.clear();
    this.equipment.clear();
    this.bibScans = [];
    this.supplyScans = [];
    this.equipmentChecks = [];
    this.waivings = [];
    this.saveAll();
  }
}

module.exports = DataStore;
