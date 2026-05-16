const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SnapshotManager {
  constructor(outputDir) {
    this.outputDir = outputDir;
    this.snapshotDir = path.join(outputDir, 'snapshots');
    this.ensureDirs();
  }

  ensureDirs() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    if (!fs.existsSync(this.snapshotDir)) {
      fs.mkdirSync(this.snapshotDir, { recursive: true });
    }
  }

  createSnapshot(protoData, version = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotVersion = version || timestamp;
    
    const snapshot = {
      version: snapshotVersion,
      createdAt: new Date().toISOString(),
      checksum: this.calculateChecksum(protoData),
      messages: protoData.messages.map(msg => ({
        name: msg.name,
        fullName: msg.fullName,
        package: msg.package,
        fileName: msg.fileName,
        startLine: msg.startLine,
        fields: Array.from(msg.fields.values()).map(field => ({
          name: field.name,
          number: field.number,
          type: field.type,
          repeated: field.repeated,
          line: field.line,
          fileName: field.fileName
        }))
      })),
      enums: protoData.enums.map(en => ({
        name: en.name,
        fullName: en.fullName,
        fileName: en.fileName,
        startLine: en.startLine,
        values: Array.from(en.values.values())
      })),
      services: protoData.services.map(svc => ({
        name: svc.name,
        fullName: svc.fullName,
        fileName: svc.fileName,
        startLine: svc.startLine,
        methods: Array.from(svc.methods.values())
      })),
      sourceLocations: protoData.sourceLocations
    };

    const snapshotPath = path.join(this.snapshotDir, `snapshot-${snapshotVersion}.json`);
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');

    const latestPath = path.join(this.snapshotDir, 'latest.json');
    fs.writeFileSync(latestPath, JSON.stringify(snapshot, null, 2), 'utf-8');

    return {
      snapshot: snapshot,
      path: snapshotPath
    };
  }

  loadSnapshot(version = null) {
    let snapshotPath;
    
    if (version) {
      snapshotPath = path.join(this.snapshotDir, `snapshot-${version}.json`);
    } else {
      snapshotPath = path.join(this.snapshotDir, 'latest.json');
    }

    if (!fs.existsSync(snapshotPath)) {
      if (version) {
        throw new Error(`快照不存在: ${snapshotPath}`);
      }
      return null;
    }

    const content = fs.readFileSync(snapshotPath, 'utf-8');
    const snapshot = JSON.parse(content);

    snapshot.messages.forEach(msg => {
      msg.fields = new Map(msg.fields.map(f => [f.number, f]));
    });

    return snapshot;
  }

  listSnapshots() {
    if (!fs.existsSync(this.snapshotDir)) {
      return [];
    }

    const files = fs.readdirSync(this.snapshotDir)
      .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
      .sort()
      .reverse();

    return files.map(f => {
      const content = fs.readFileSync(path.join(this.snapshotDir, f), 'utf-8');
      const snapshot = JSON.parse(content);
      return {
        version: snapshot.version,
        createdAt: snapshot.createdAt,
        fileName: f
      };
    });
  }

  deleteSnapshot(version) {
    const snapshotPath = path.join(this.snapshotDir, `snapshot-${version}.json`);
    if (fs.existsSync(snapshotPath)) {
      fs.unlinkSync(snapshotPath);
      return true;
    }
    return false;
  }

  calculateChecksum(data) {
    const hash = crypto.createHash('sha256');
    const serialized = JSON.stringify({
      messages: data.messages.map(m => ({
        fullName: m.fullName,
        fields: Array.from(m.fields.values()).map(f => [f.number, f.name, f.type])
      })),
      enums: data.enums.map(e => ({
        fullName: e.fullName,
        values: Array.from(e.values.values()).map(v => [v.number, v.name])
      }))
    });
    hash.update(serialized);
    return hash.digest('hex');
  }

  hasSnapshot(version = null) {
    if (version) {
      return fs.existsSync(path.join(this.snapshotDir, `snapshot-${version}.json`));
    }
    return fs.existsSync(path.join(this.snapshotDir, 'latest.json'));
  }

  exportSnapshot(snapshot, exportPath) {
    const exportData = JSON.stringify(snapshot, null, 2);
    fs.writeFileSync(exportPath, exportData, 'utf-8');
    return exportPath;
  }
}

module.exports = SnapshotManager;
