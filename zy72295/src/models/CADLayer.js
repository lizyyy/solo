const { v4: uuidv4 } = require('uuid');

class CADLayer {
  constructor(data) {
    this.id = uuidv4();
    this.name = data.name;
    this.importedAt = new Date().toISOString();
    this.importedBy = data.importedBy || '系统';
    this.zones = data.zones || [];
    this.isDuplicate = false;
    this.sourceFile = data.sourceFile || '';
    this.version = 1;
  }

  static generateFingerprint(layerData) {
    const sortedZones = [...(layerData.zones || [])].sort((a, b) => a.name.localeCompare(b.name));
    return `${layerData.name}-${JSON.stringify(sortedZones)}`;
  }
}

module.exports = { CADLayer };
