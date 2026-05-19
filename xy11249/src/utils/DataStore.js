const fs = require('fs');
const path = require('path');

class DataStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.ensureDataDir();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  getFilePath(collection) {
    return path.join(this.dataDir, `${collection}.json`);
  }

  load(collection) {
    const filePath = this.getFilePath(collection);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`加载 ${collection} 失败:`, error.message);
      return [];
    }
  }

  save(collection, data) {
    const filePath = this.getFilePath(collection);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  findAll(collection, ModelClass) {
    const data = this.load(collection);
    return data.map(item => ModelClass.fromJSON(item));
  }

  findById(collection, id, ModelClass) {
    const data = this.load(collection);
    const item = data.find(i => i.id === id);
    return item ? ModelClass.fromJSON(item) : null;
  }

  findOne(collection, predicate, ModelClass) {
    const data = this.load(collection);
    const item = data.find(predicate);
    return item ? ModelClass.fromJSON(item) : null;
  }

  find(collection, predicate, ModelClass) {
    const data = this.load(collection);
    const items = data.filter(predicate);
    return items.map(item => ModelClass.fromJSON(item));
  }

  insert(collection, model) {
    const data = this.load(collection);
    data.push(model.toJSON());
    this.save(collection, data);
    return model;
  }

  insertMany(collection, models) {
    const data = this.load(collection);
    const jsonModels = models.map(m => m.toJSON());
    data.push(...jsonModels);
    this.save(collection, data);
    return models;
  }

  update(collection, id, updateFn, ModelClass) {
    const data = this.load(collection);
    const index = data.findIndex(item => item.id === id);
    if (index === -1) {
      return null;
    }
    const model = ModelClass.fromJSON(data[index]);
    updateFn(model);
    model.updatedAt = new Date();
    data[index] = model.toJSON();
    this.save(collection, data);
    return model;
  }

  delete(collection, id) {
    const data = this.load(collection);
    const index = data.findIndex(item => item.id === id);
    if (index === -1) {
      return false;
    }
    data.splice(index, 1);
    this.save(collection, data);
    return true;
  }

  clear(collection) {
    this.save(collection, []);
  }
}

module.exports = DataStore;
