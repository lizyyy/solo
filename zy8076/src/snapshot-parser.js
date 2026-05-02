const fs = require('fs');
const path = require('path');

class SnapshotParser {
  constructor(snapshotDir) {
    this.snapshotDir = snapshotDir;
  }

  parseVersion(filename) {
    const match = filename.match(/v(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  loadSnapshot(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    if (!data.version || !data.data) {
      throw new Error(`Invalid snapshot format in ${filePath}`);
    }

    return {
      version: data.version,
      data: data.data,
      metadata: data.metadata || {},
      source: path.basename(filePath)
    };
  }

  loadAllSnapshots() {
    if (!fs.existsSync(this.snapshotDir)) {
      throw new Error(`Snapshot directory not found: ${this.snapshotDir}`);
    }

    const files = fs.readdirSync(this.snapshotDir)
      .filter(f => f.endsWith('.json'))
      .map(f => ({
        path: path.join(this.snapshotDir, f),
        name: f,
        version: this.parseVersion(f)
      }))
      .filter(f => f.version !== null)
      .sort((a, b) => a.version - b.version);

    const snapshots = {};
    for (const file of files) {
      const snapshot = this.loadSnapshot(file.path);
      snapshots[snapshot.version] = snapshot;
    }

    return snapshots;
  }

  detectVersionChain(snapshots) {
    const versions = Object.keys(snapshots).map(Number).sort((a, b) => a - b);
    const chain = [];
    const missing = [];

    for (let i = 0; i < versions.length; i++) {
      if (i === 0) {
        chain.push(versions[i]);
      } else {
        const prev = versions[i - 1];
        const curr = versions[i];
        if (curr === prev + 1) {
          chain.push(curr);
        } else {
          for (let v = prev + 1; v < curr; v++) {
            missing.push(v);
          }
          chain.push(curr);
        }
      }
    }

    return { chain, missing };
  }

  getSnapshot(version) {
    const snapshots = this.loadAllSnapshots();
    return snapshots[version] || null;
  }

  getLatestSnapshot(snapshots) {
    const versions = Object.keys(snapshots).map(Number);
    if (versions.length === 0) return null;
    const latest = Math.max(...versions);
    return snapshots[latest];
  }
}

module.exports = SnapshotParser;
