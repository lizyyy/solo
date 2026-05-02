const fs = require('fs');
const path = require('path');

class SessionStore {
  constructor(options = {}) {
    this.storageDir = options.storageDir || path.join(process.cwd(), 'sessions');
    this.ensureStorageDir();
  }

  ensureStorageDir() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  async saveSession(session) {
    if (!session || !session.id) {
      throw new Error('Invalid session: must have an id');
    }

    const filename = `${session.id}.json`;
    const filePath = path.join(this.storageDir, filename);
    
    const sessionData = {
      ...session,
      _savedAt: Date.now(),
      _version: '1.0'
    };

    await fs.promises.writeFile(
      filePath,
      JSON.stringify(sessionData, null, 2),
      'utf-8'
    );

    return {
      id: session.id,
      filename,
      path: filePath,
      savedAt: sessionData._savedAt
    };
  }

  async loadSession(sessionId) {
    const filename = `${sessionId}.json`;
    const filePath = path.join(this.storageDir, filename);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const content = await fs.promises.readFile(filePath, 'utf-8');
    const sessionData = JSON.parse(content);

    delete sessionData._savedAt;
    delete sessionData._version;

    return sessionData;
  }

  async deleteSession(sessionId) {
    const filename = `${sessionId}.json`;
    const filePath = path.join(this.storageDir, filename);

    if (!fs.existsSync(filePath)) {
      return false;
    }

    await fs.promises.unlink(filePath);
    return true;
  }

  async listSessions() {
    this.ensureStorageDir();
    
    const files = await fs.promises.readdir(this.storageDir);
    const sessions = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(this.storageDir, file);
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const sessionData = JSON.parse(content);
          
          sessions.push({
            id: sessionData.id,
            name: sessionData.name || 'Unnamed Session',
            createdAt: sessionData.createdAt,
            updatedAt: sessionData.updatedAt,
            savedAt: sessionData._savedAt,
            mode: sessionData.mode,
            tagCount: sessionData.tags?.length || 0,
            filename: file
          });
        } catch (e) {
          console.warn(`Failed to read session file ${file}:`, e.message);
        }
      }
    }

    return sessions.sort((a, b) => (b.savedAt || b.updatedAt) - (a.savedAt || a.updatedAt));
  }

  async sessionExists(sessionId) {
    const filename = `${sessionId}.json`;
    const filePath = path.join(this.storageDir, filename);
    return fs.existsSync(filePath);
  }

  getStoragePath() {
    return this.storageDir;
  }
}

module.exports = { SessionStore };
