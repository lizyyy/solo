const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/repair-teams.json');

class RepairTeam {
  static ensureDataFile() {
    if (!fs.existsSync(DATA_PATH)) {
      fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
      fs.writeFileSync(DATA_PATH, JSON.stringify([], null, 2));
    }
  }

  static getAll() {
    this.ensureDataFile();
    const data = fs.readFileSync(DATA_PATH, 'utf8');
    return JSON.parse(data);
  }

  static saveAll(teams) {
    this.ensureDataFile();
    fs.writeFileSync(DATA_PATH, JSON.stringify(teams, null, 2));
  }

  static findById(id) {
    const teams = this.getAll();
    return teams.find(t => t.id === id);
  }

  static findByName(name) {
    const teams = this.getAll();
    return teams.find(t => t.name === name);
  }

  static create(team) {
    const teams = this.getAll();
    const newTeam = {
      id: `RT${Date.now()}${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      handoverRecords: [],
      ...team
    };
    teams.push(newTeam);
    this.saveAll(teams);
    return newTeam;
  }

  static addHandoverRecord(teamId, handover) {
    const teams = this.getAll();
    const index = teams.findIndex(t => t.id === teamId);
    if (index === -1) return null;
    
    teams[index].handoverRecords = teams[index].handoverRecords || [];
    teams[index].handoverRecords.push({
      ...handover,
      handoverTime: new Date().toISOString()
    });
    teams[index].updatedAt = new Date().toISOString();
    this.saveAll(teams);
    return teams[index];
  }
}

module.exports = RepairTeam;
