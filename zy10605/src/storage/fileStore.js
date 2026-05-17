const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class FileStore {
  constructor(dataDir) {
    this.dataDir = dataDir || path.join(process.cwd(), 'data');
    this.files = {
      orders: 'orders.json',
      liveSessions: 'liveSessions.json',
      replayPermissions: 'replayPermissions.json',
      history: 'history.json',
      badRecords: 'badRecords.json'
    };
    this.init();
  }

  init() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    for (const file of Object.values(this.files)) {
      const filePath = path.join(this.dataDir, file);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify([], null, 2));
      }
    }
  }

  read(fileName) {
    const filePath = path.join(this.dataDir, fileName);
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  write(fileName, data) {
    const filePath = path.join(this.dataDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  getAll(collection) {
    return this.read(this.files[collection]);
  }

  getById(collection, id) {
    const items = this.read(this.files[collection]);
    return items.find(item => item.id === id);
  }

  create(collection, data) {
    const items = this.read(this.files[collection]);
    const newItem = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data
    };
    items.push(newItem);
    this.write(this.files[collection], items);
    return newItem;
  }

  update(collection, id, data) {
    const items = this.read(this.files[collection]);
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return null;

    items[index] = {
      ...items[index],
      ...data,
      updatedAt: new Date().toISOString()
    };
    this.write(this.files[collection], items);
    return items[index];
  }

  delete(collection, id) {
    const items = this.read(this.files[collection]);
    const filtered = items.filter(item => item.id !== id);
    this.write(this.files[collection], filtered);
    return filtered.length < items.length;
  }

  find(collection, predicate) {
    const items = this.read(this.files[collection]);
    return items.filter(predicate);
  }

  findOne(collection, predicate) {
    const items = this.read(this.files[collection]);
    return items.find(predicate);
  }
}

module.exports = FileStore;
