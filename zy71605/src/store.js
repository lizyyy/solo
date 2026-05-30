const fs = require('fs')
const path = require('path')

const DEFAULT_DATA_DIR = path.join(__dirname, '..', 'data')

class Store {
  constructor(dataDir = DEFAULT_DATA_DIR) {
    this.dataDir = dataDir
    this.collections = {
      members: [],
      storedValueRecords: [],
      bonusRules: [],
      freezeRecords: [],
      stores: [],
      migrationRecords: [],
      migrationBatches: [],
      timelineEvents: []
    }
  }

  _filePath(name) {
    return path.join(this.dataDir, `${name}.json`)
  }

  load() {
    for (const name of Object.keys(this.collections)) {
      const fp = this._filePath(name)
      if (fs.existsSync(fp)) {
        try {
          this.collections[name] = JSON.parse(fs.readFileSync(fp, 'utf-8'))
        } catch {
          this.collections[name] = []
        }
      }
    }
    return this
  }

  save() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true })
    }
    for (const [name, data] of Object.entries(this.collections)) {
      fs.writeFileSync(this._filePath(name), JSON.stringify(data, null, 2), 'utf-8')
    }
    return this
  }

  get(name) {
    return this.collections[name] || []
  }

  add(name, item) {
    if (!this.collections[name]) this.collections[name] = []
    this.collections[name].push(item)
    return item
  }

  update(name, predicate, updater) {
    const idx = this.collections[name].findIndex(predicate)
    if (idx === -1) return null
    const before = { ...this.collections[name][idx] }
    this.collections[name][idx] = { ...this.collections[name][idx], ...updater }
    return { before, after: this.collections[name][idx] }
  }

  find(name, predicate) {
    return this.collections[name].find(predicate) || null
  }

  filter(name, predicate) {
    return this.collections[name].filter(predicate)
  }

  remove(name, predicate) {
    const before = this.collections[name].length
    this.collections[name] = this.collections[name].filter(i => !predicate(i))
    return before - this.collections[name].length
  }
}

module.exports = { Store }
