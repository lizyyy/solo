const fs = require('fs');
const path = require('path');
const { mkdirp } = require('mkdirp');
const { v4: uuidv4 } = require('uuid');

class StorageService {
  constructor(storagePath) {
    this.storagePath = storagePath;
    this.replaysPath = path.join(storagePath, 'replays');
    this.exportsPath = path.join(storagePath, 'exports');
    this.uploadsPath = path.join(storagePath, 'uploads');
  }
  
  async ensureDirectories() {
    await mkdirp(this.replaysPath);
    await mkdirp(this.exportsPath);
    await mkdirp(this.uploadsPath);
  }
  
  async saveReplay(sessionId, stateMachine) {
    await this.ensureDirectories();
    
    const replayData = {
      id: sessionId,
      savedAt: new Date().toISOString(),
      version: '1.0',
      data: stateMachine.toJSON(),
    };
    
    const fileName = `${sessionId}.json`;
    const filePath = path.join(this.replaysPath, fileName);
    
    await fs.promises.writeFile(
      filePath,
      JSON.stringify(replayData, null, 2),
      'utf-8'
    );
    
    console.log(`[Storage] Replay saved: ${filePath}`);
    return filePath;
  }
  
  async loadReplay(replayId) {
    await this.ensureDirectories();
    
    const fileName = `${replayId}.json`;
    const filePath = path.join(this.replaysPath, fileName);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Replay not found: ${replayId}`);
    }
    
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }
  
  async listReplays() {
    await this.ensureDirectories();
    
    const files = await fs.promises.readdir(this.replaysPath);
    const replays = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(this.replaysPath, file);
          const stats = await fs.promises.stat(filePath);
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const replay = JSON.parse(content);
          
          replays.push({
            id: file.replace('.json', ''),
            name: replay.data?.sessionInfo?.name || file,
            description: replay.data?.sessionInfo?.description || '',
            savedAt: replay.savedAt,
            createdAt: replay.data?.sessionInfo?.createdAt,
            updatedAt: replay.data?.sessionInfo?.updatedAt,
            eventCount: replay.data?.events?.length || 0,
            currentState: replay.data?.currentState,
            fileSize: stats.size,
          });
        } catch (error) {
          console.error(`[Storage] Error reading replay ${file}:`, error.message);
        }
      }
    }
    
    return replays.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
  }
  
  async deleteReplay(replayId) {
    const fileName = `${replayId}.json`;
    const filePath = path.join(this.replaysPath, fileName);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Replay not found: ${replayId}`);
    }
    
    await fs.promises.unlink(filePath);
    console.log(`[Storage] Replay deleted: ${filePath}`);
    return true;
  }
  
  async saveExport(exportId, content, format = 'json') {
    await this.ensureDirectories();
    
    const extension = format === 'markdown' ? 'md' : 'json';
    const fileName = `${exportId}.${extension}`;
    const filePath = path.join(this.exportsPath, fileName);
    
    if (format === 'json') {
      await fs.promises.writeFile(
        filePath,
        typeof content === 'string' ? content : JSON.stringify(content, null, 2),
        'utf-8'
      );
    } else {
      await fs.promises.writeFile(filePath, content, 'utf-8');
    }
    
    console.log(`[Storage] Export saved: ${filePath}`);
    return filePath;
  }
  
  async listExports() {
    await this.ensureDirectories();
    
    const files = await fs.promises.readdir(this.exportsPath);
    const exports = [];
    
    for (const file of files) {
      const filePath = path.join(this.exportsPath, file);
      const stats = await fs.promises.stat(filePath);
      
      exports.push({
        id: path.basename(file, path.extname(file)),
        fileName: file,
        format: file.endsWith('.md') ? 'markdown' : 'json',
        createdAt: stats.birthtime,
        fileSize: stats.size,
      });
    }
    
    return exports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  
  async saveAuditPackage(sessionId, stateMachine, validationResults) {
    await this.ensureDirectories();
    
    const auditPackage = {
      id: uuidv4(),
      sessionId,
      createdAt: new Date().toISOString(),
      version: '1.0',
      type: 'audit_package',
      
      sessionData: stateMachine.toJSON(),
      validation: validationResults,
      
      summary: {
        generatedAt: new Date().toISOString(),
        sessionName: stateMachine.getSessionInfo().name,
        totalEvents: stateMachine.getEvents().length,
        validationErrors: validationResults?.summary?.errors || 0,
        validationWarnings: validationResults?.summary?.warnings || 0,
      },
    };
    
    const fileName = `audit_${sessionId}_${Date.now()}.json`;
    const filePath = path.join(this.exportsPath, fileName);
    
    await fs.promises.writeFile(
      filePath,
      JSON.stringify(auditPackage, null, 2),
      'utf-8'
    );
    
    console.log(`[Storage] Audit package saved: ${filePath}`);
    return { path: filePath, id: auditPackage.id };
  }
  
  async saveUploadedFile(filename, content) {
    await this.ensureDirectories();
    
    const uniqueId = uuidv4();
    const ext = path.extname(filename);
    const savedName = `${uniqueId}${ext}`;
    const filePath = path.join(this.uploadsPath, savedName);
    
    await fs.promises.writeFile(filePath, content, 'utf-8');
    
    console.log(`[Storage] Upload saved: ${filePath}`);
    return { path: filePath, id: uniqueId, originalName: filename };
  }
  
  async readUploadedFile(fileId) {
    const files = await fs.promises.readdir(this.uploadsPath);
    const matchedFile = files.find(f => f.startsWith(fileId));
    
    if (!matchedFile) {
      throw new Error(`Uploaded file not found: ${fileId}`);
    }
    
    const filePath = path.join(this.uploadsPath, matchedFile);
    return await fs.promises.readFile(filePath, 'utf-8');
  }
  
  getStoragePath() {
    return this.storagePath;
  }
  
  getReplaysPath() {
    return this.replaysPath;
  }
  
  getExportsPath() {
    return this.exportsPath;
  }
}

module.exports = {
  StorageService,
};
