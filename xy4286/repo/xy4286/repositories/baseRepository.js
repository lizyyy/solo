const storage = require('../storage');
const models = require('../models');

class BaseRepository {
  constructor(collectionName, modelClass) {
    this.store = storage.getStore(collectionName);
    this.modelClass = modelClass;
  }

  _toModel(data) {
    if (!data) return null;
    return new this.modelClass(data);
  }

  _toModels(dataArray) {
    return dataArray.map(data => this._toModel(data));
  }

  findAll() {
    const data = this.store.getAll();
    return this._toModels(data);
  }

  findById(id) {
    const data = this.store.getById(id);
    return this._toModel(data);
  }

  create(model) {
    const data = model.toJSON();
    const created = this.store.create(data);
    return this._toModel(created);
  }

  update(model) {
    const data = model.toJSON();
    const updated = this.store.update(model.id, data);
    return this._toModel(updated);
  }

  delete(id) {
    return this.store.delete(id);
  }

  findByField(field, value) {
    const data = this.store.findByField(field, value);
    return this._toModels(data);
  }

  findOneByField(field, value) {
    const data = this.store.findOneByField(field, value);
    return this._toModel(data);
  }

  findByFields(filters) {
    const data = this.store.findByFields(filters);
    return this._toModels(data);
  }

  clear() {
    this.store.clear();
  }
}

module.exports = BaseRepository;
