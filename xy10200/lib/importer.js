const fs = require('fs');
const path = require('path');
const { ContainerPosition, ShiftRecord } = require('./models');

class Importer {
  constructor(workspace) {
    this.workspace = workspace;
  }

  importGateSystem(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    return data.map(item => new ContainerPosition({
      ...item,
      source: 'gate_system',
    }));
  }

  importYardInventory(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    return data.map(item => new ContainerPosition({
      ...item,
      source: 'yard_inventory',
    }));
  }

  importTallyRecord(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    return data.map(item => new ShiftRecord(item));
  }

  importAll(gateFile, yardFile, tallyFile) {
    const positions = [];
    const shifts = [];

    if (gateFile) {
      positions.push(...this.importGateSystem(gateFile));
    }
    if (yardFile) {
      positions.push(...this.importYardInventory(yardFile));
    }
    if (tallyFile) {
      shifts.push(...this.importTallyRecord(tallyFile));
    }

    return { positions, shifts };
  }
}

module.exports = { Importer };
