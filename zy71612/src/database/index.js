import { openDB } from 'idb'
import {
  BillSchema,
  EndorseSchema,
  CollectionSchema,
  DiscountSchema,
  ReminderSchema,
  ReportSchema,
  RemarkSchema,
  OperationLogSchema
} from '../models/types.js'

const DB_NAME = 'AcceptanceReminderDB'
const DB_VERSION = 1

const SCHEMAS = [
  BillSchema,
  EndorseSchema,
  CollectionSchema,
  DiscountSchema,
  ReminderSchema,
  ReportSchema,
  RemarkSchema,
  OperationLogSchema
]

class Database {
  constructor() {
    this.db = null
    this.cache = new Map()
    this.cacheTime = new Map()
    this.cacheTTL = 5 * 60 * 1000
  }

  async init() {
    if (this.db) return this.db

    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade: (db, oldVersion, newVersion, transaction) => {
        SCHEMAS.forEach(schema => {
          if (!db.objectStoreNames.contains(schema.name)) {
            const store = db.createObjectStore(schema.name, {
              keyPath: schema.keyPath
            })
            schema.indexes.forEach(idx => {
              store.createIndex(idx.name, idx.name, { unique: idx.unique })
            })
          }
        })
      }
    })

    return this.db
  }

  _getCacheKey(storeName, key) {
    return `${storeName}:${key}`
  }

  _isCacheValid(cacheKey) {
    const time = this.cacheTime.get(cacheKey)
    if (!time) return false
    return Date.now() - time < this.cacheTTL
  }

  _setCache(storeName, key, value) {
    const cacheKey = this._getCacheKey(storeName, key)
    this.cache.set(cacheKey, value)
    this.cacheTime.set(cacheKey, Date.now())
  }

  _getCache(storeName, key) {
    const cacheKey = this._getCacheKey(storeName, key)
    if (this._isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey)
    }
    return null
  }

  _clearCache(storeName) {
    const prefix = `${storeName}:`
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
        this.cacheTime.delete(key)
      }
    }
  }

  async add(storeName, data) {
    await this.init()
    const id = await this.db.add(storeName, data)
    this._clearCache(storeName)
    return id
  }

  async put(storeName, data) {
    await this.init()
    const id = await this.db.put(storeName, data)
    this._clearCache(storeName)
    return id
  }

  async get(storeName, id) {
    const cached = this._getCache(storeName, id)
    if (cached) return cached

    await this.init()
    const data = await this.db.get(storeName, id)
    if (data) {
      this._setCache(storeName, id, data)
    }
    return data
  }

  async getByIndex(storeName, indexName, value) {
    await this.init()
    return await this.db.getFromIndex(storeName, indexName, value)
  }

  async getAll(storeName) {
    const cached = this._getCache(storeName, '__all__')
    if (cached) return cached

    await this.init()
    const data = await this.db.getAll(storeName)
    this._setCache(storeName, '__all__', data)
    return data
  }

  async getAllFromIndex(storeName, indexName, value) {
    await this.init()
    return await this.db.getAllFromIndex(storeName, indexName, value)
  }

  async delete(storeName, id) {
    await this.init()
    await this.db.delete(storeName, id)
    this._clearCache(storeName)
  }

  async clear(storeName) {
    await this.init()
    await this.db.clear(storeName)
    this._clearCache(storeName)
  }

  async count(storeName) {
    await this.init()
    return await this.db.count(storeName)
  }

  async transaction(storeNames, mode, callback) {
    await this.init()
    const tx = this.db.transaction(storeNames, mode)
    const result = await callback(tx)
    await tx.done
    storeNames.forEach(name => this._clearCache(name))
    return result
  }

  async bulkAdd(storeName, items) {
    await this.init()
    const tx = this.db.transaction(storeName, 'readwrite')
    const store = tx.store
    for (const item of items) {
      store.add(item)
    }
    await tx.done
    this._clearCache(storeName)
  }

  async bulkPut(storeName, items) {
    await this.init()
    const tx = this.db.transaction(storeName, 'readwrite')
    const store = tx.store
    for (const item of items) {
      store.put(item)
    }
    await tx.done
    this._clearCache(storeName)
  }

  async getRange(storeName, indexName, lower, upper) {
    await this.init()
    const range = IDBKeyRange.bound(lower, upper, true, true)
    return await this.db.getAllFromIndex(storeName, indexName, range)
  }
}

export const db = new Database()
export default db
