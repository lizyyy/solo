const fs = require('fs').promises;
const path = require('path');

class OutputManager {
  constructor(outputDir, force = false) {
    this.outputDir = path.resolve(outputDir);
    this.force = force;
  }

  async prepareOutputDir() {
    try {
      await fs.access(this.outputDir);
      const files = await fs.readdir(this.outputDir);
      if (files.length > 0 && !this.force) {
        throw new Error(`输出目录不为空: ${this.outputDir}。使用 --force 参数覆盖`);
      }
      await this.clearDir(this.outputDir);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(this.outputDir, { recursive: true });
      } else {
        throw error;
      }
    }
  }

  async clearDir(dir) {
    const files = await fs.readdir(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        await this.clearDir(filePath);
        await fs.rmdir(filePath);
      } else {
        await fs.unlink(filePath);
      }
    }
  }

  async writeMachineReadable(data) {
    const filePath = path.join(this.outputDir, 'results.json');
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return filePath;
  }

  async writeInvalidRecords(invalidRecords) {
    const filePath = path.join(this.outputDir, 'invalid-records.json');
    await fs.writeFile(filePath, JSON.stringify(invalidRecords, null, 2), 'utf-8');
    return filePath;
  }

  async writeFile(filename, content) {
    const filePath = path.join(this.outputDir, filename);
    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  }
}

module.exports = { OutputManager };
