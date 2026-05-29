const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const config = require('../config');

class ArchiveService {
  async archiveVersion(lutRecord, archiveReason = 'version_update') {
    const archiveDir = path.join(config.storage.archiveDir, lutRecord.uuid);
    await fs.ensureDir(archiveDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = lutRecord.name.replace(/[^\w\u4e00-\u9fa5-]/g, '_');
    const archiveName = `${safeName}_${lutRecord.version}_${timestamp}.zip`;
    const archivePath = path.join(archiveDir, archiveName);

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(archivePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        resolve({
          archivePath,
          archiveSize: archive.pointer(),
          archiveName
        });
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);

      if (fs.existsSync(lutRecord.file_path)) {
        archive.file(lutRecord.file_path, { name: path.basename(lutRecord.file_path) });
      }

      const metadata = {
        uuid: lutRecord.uuid,
        name: lutRecord.name,
        version: lutRecord.version,
        projectId: lutRecord.project_id,
        sceneId: lutRecord.scene_id,
        fileHash: lutRecord.file_hash,
        colorist: lutRecord.colorist,
        notes: lutRecord.notes,
        status: lutRecord.status,
        archivedAt: new Date().toISOString(),
        archiveReason
      };

      archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });
      archive.finalize();
    });
  }

  async restoreFromArchive(uuid, archiveName) {
    const archivePath = path.join(config.storage.archiveDir, uuid, archiveName);
    if (!await fs.pathExists(archivePath)) {
      throw new Error(`归档文件不存在: ${archiveName}`);
    }
    return archivePath;
  }

  async listArchives(uuid) {
    const archiveDir = path.join(config.storage.archiveDir, uuid);
    if (!await fs.pathExists(archiveDir)) {
      return [];
    }

    const files = await fs.readdir(archiveDir);
    const archives = [];

    for (const file of files) {
      const filePath = path.join(archiveDir, file);
      const stats = await fs.stat(filePath);
      archives.push({
        name: file,
        size: stats.size,
        createdAt: stats.birthtime
      });
    }

    return archives.sort((a, b) => b.createdAt - a.createdAt);
  }
}

module.exports = new ArchiveService();
