import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');

class StorageService {
  constructor() {
    this.collections = {
      medicines: [],
      inventory: [],
      dosageRules: [],
      prescriptions: [],
      importErrors: []
    };
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    try {
      await fs.access(DATA_DIR);
    } catch {
      await fs.mkdir(DATA_DIR, { recursive: true });
    }

    for (const collectionName of Object.keys(this.collections)) {
      await this.loadCollection(collectionName);
    }

    this.initialized = true;
  }

  async loadCollection(collectionName) {
    const filePath = this.getFilePath(collectionName);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      this.collections[collectionName] = JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.collections[collectionName] = [];
        await this.saveCollection(collectionName);
      } else {
        throw error;
      }
    }
  }

  async saveCollection(collectionName) {
    const filePath = this.getFilePath(collectionName);
    await fs.writeFile(filePath, JSON.stringify(this.collections[collectionName], null, 2), 'utf-8');
  }

  getFilePath(collectionName) {
    return path.join(DATA_DIR, `${collectionName}.json`);
  }

  async getAll(collectionName) {
    await this.init();
    return [...this.collections[collectionName]];
  }

  async getById(collectionName, id) {
    await this.init();
    return this.collections[collectionName].find(item => item.id === id) || null;
  }

  async find(collectionName, predicate) {
    await this.init();
    return this.collections[collectionName].filter(predicate);
  }

  async findOne(collectionName, predicate) {
    await this.init();
    return this.collections[collectionName].find(predicate) || null;
  }

  async create(collectionName, data) {
    await this.init();
    const item = {
      ...data,
      id: data.id || crypto.randomUUID(),
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.collections[collectionName].push(item);
    await this.saveCollection(collectionName);
    return item;
  }

  async update(collectionName, id, data) {
    await this.init();
    const index = this.collections[collectionName].findIndex(item => item.id === id);
    if (index === -1) {
      throw new Error(`Item with id ${id} not found in ${collectionName}`);
    }
    this.collections[collectionName][index] = {
      ...this.collections[collectionName][index],
      ...data,
      updatedAt: new Date().toISOString()
    };
    await this.saveCollection(collectionName);
    return this.collections[collectionName][index];
  }

  async delete(collectionName, id) {
    await this.init();
    const index = this.collections[collectionName].findIndex(item => item.id === id);
    if (index === -1) {
      throw new Error(`Item with id ${id} not found in ${collectionName}`);
    }
    const deleted = this.collections[collectionName].splice(index, 1)[0];
    await this.saveCollection(collectionName);
    return deleted;
  }

  async bulkCreate(collectionName, items) {
    await this.init();
    const createdItems = items.map(data => ({
      ...data,
      id: data.id || crypto.randomUUID(),
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    this.collections[collectionName].push(...createdItems);
    await this.saveCollection(collectionName);
    return createdItems;
  }

  async clear(collectionName) {
    await this.init();
    this.collections[collectionName] = [];
    await this.saveCollection(collectionName);
  }

  async saveImportError(error) {
    await this.init();
    const errorRecord = {
      id: crypto.randomUUID(),
      ...error,
      createdAt: new Date().toISOString()
    };
    this.collections.importErrors.push(errorRecord);
    await this.saveCollection('importErrors');
    return errorRecord;
  }

  async getImportErrors() {
    await this.init();
    return [...this.collections.importErrors];
  }
}

export default new StorageService();
