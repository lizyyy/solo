const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { Athlete, EquipmentItem } = require('./models');

class Importer {
  constructor(dataStore) {
    this.store = dataStore;
  }
  
  importAthletesFromCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const records = parse(content, { 
      columns: true, 
      skip_empty_lines: true,
      trim: true
    });
    
    const athletes = records.map(r => new Athlete({
      bib: r.bib || r['号码布'],
      name: r.name || r['姓名'],
      phone: r.phone || r['电话'] || '',
      category: r.category || r['组别'] || '',
      gender: r.gender || r['性别'] || ''
    }));
    
    this.store.addAthletes(athletes);
    return { count: athletes.length, athletes };
  }
  
  importAthletesFromJSON(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    const athletes = data.map(r => new Athlete(r));
    this.store.addAthletes(athletes);
    return { count: athletes.length, athletes };
  }
  
  importEquipmentFromCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const records = parse(content, { 
      columns: true, 
      skip_empty_lines: true,
      trim: true
    });
    
    const items = records.map((r, idx) => new EquipmentItem({
      id: r.id || `eq_${idx + 1}`,
      name: r.name || r['装备名称'],
      category: r.category || r['类别'] || 'general',
      required: (r.required || r['强制']) !== 'false' && 
                (r.required || r['强制']) !== 'no' && 
                (r.required || r['强制']) !== '否'
    }));
    
    this.store.addEquipment(items);
    return { count: items.length, items };
  }
  
  importEquipmentFromJSON(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    const items = data.map(r => new EquipmentItem(r));
    this.store.addEquipment(items);
    return { count: items.length, items };
  }
}

module.exports = Importer;
