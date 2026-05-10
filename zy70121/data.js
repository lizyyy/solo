class DataStore {
  constructor() {
    this.allergenRules = new Map();
    this.skuBatches = new Map();
    this.orders = new Map();
    this.inventory = new Map();
    this.recalls = new Map();
    this.locks = new Map();
    this.lockOwners = new Map();
  }
}

module.exports = { DataStore };
