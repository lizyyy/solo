import { openDB } from 'idb'
import { v4 as uuidv4 } from 'uuid'

const DB_NAME = 'InventoryOfflineDB'
const DB_VERSION = 1
const PENDING_QUEUE_STORE = 'pendingQueue'
const CACHED_DATA_STORE = 'cachedData'
const LOCAL_COUNT_STORE = 'localCounts'
const OFFLINE_TASKS_STORE = 'offlineTasks'

let dbPromise = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(PENDING_QUEUE_STORE)) {
          const queueStore = db.createObjectStore(PENDING_QUEUE_STORE, { 
            keyPath: 'id' 
          })
          queueStore.createIndex('createdAt', 'createdAt')
          queueStore.createIndex('status', 'status')
          queueStore.createIndex('type', 'type')
        }

        if (!db.objectStoreNames.contains(CACHED_DATA_STORE)) {
          const cacheStore = db.createObjectStore(CACHED_DATA_STORE, { 
            keyPath: 'key' 
          })
          cacheStore.createIndex('expiresAt', 'expiresAt')
        }

        if (!db.objectStoreNames.contains(LOCAL_COUNT_STORE)) {
          const countStore = db.createObjectStore(LOCAL_COUNT_STORE, { 
            keyPath: 'id' 
          })
          countStore.createIndex('taskId', 'taskId')
          countStore.createIndex('productId', 'productId')
          countStore.createIndex('synced', 'synced')
        }

        if (!db.objectStoreNames.contains(OFFLINE_TASKS_STORE)) {
          const taskStore = db.createObjectStore(OFFLINE_TASKS_STORE, { 
            keyPath: 'id' 
          })
          taskStore.createIndex('synced', 'synced')
        }
      }
    })
  }
  return dbPromise
}

export const offlineStorage = {
  async init() {
    await getDB()
  },

  isOnline() {
    return navigator.onLine
  },

  async addToPendingQueue(item) {
    const db = await getDB()
    const queueItem = {
      id: uuidv4(),
      ...item,
      status: 'pending',
      retryCount: 0,
      maxRetries: 5,
      createdAt: new Date().toISOString()
    }
    await db.put(PENDING_QUEUE_STORE, queueItem)
    return queueItem
  },

  async getPendingQueue() {
    const db = await getDB()
    const allItems = await db.getAll(PENDING_QUEUE_STORE)
    return allItems
      .filter(item => item.status === 'pending' || item.status === 'failed')
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  },

  async updateQueueItem(id, updates) {
    const db = await getDB()
    const item = await db.get(PENDING_QUEUE_STORE, id)
    if (item) {
      await db.put(PENDING_QUEUE_STORE, { ...item, ...updates })
    }
  },

  async removeFromQueue(id) {
    const db = await getDB()
    await db.delete(PENDING_QUEUE_STORE, id)
  },

  async saveLocalCount(countData) {
    const db = await getDB()
    const countItem = {
      ...countData,
      synced: false,
      updatedAt: new Date().toISOString()
    }
    await db.put(LOCAL_COUNT_STORE, countItem)
    return countItem
  },

  async getLocalCountsByTask(taskId) {
    const db = await getDB()
    const allCounts = await db.getAll(LOCAL_COUNT_STORE)
    return allCounts.filter(count => count.taskId === taskId)
  },

  async getUnsyncedCounts() {
    const db = await getDB()
    const allCounts = await db.getAll(LOCAL_COUNT_STORE)
    return allCounts.filter(count => !count.synced)
  },

  async markCountsAsSynced(ids) {
    const db = await getDB()
    for (const id of ids) {
      const count = await db.get(LOCAL_COUNT_STORE, id)
      if (count) {
        await db.put(LOCAL_COUNT_STORE, { ...count, synced: true })
      }
    }
  },

  async saveOfflineTask(taskData) {
    const db = await getDB()
    const taskItem = {
      ...taskData,
      synced: false,
      createdAt: new Date().toISOString()
    }
    await db.put(OFFLINE_TASKS_STORE, taskItem)
    return taskItem
  },

  async getOfflineTasks() {
    const db = await getDB()
    return await db.getAll(OFFLINE_TASKS_STORE)
  },

  async cacheData(key, data, ttlMinutes = 60) {
    const db = await getDB()
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString()
    await db.put(CACHED_DATA_STORE, {
      key,
      data,
      expiresAt,
      cachedAt: new Date().toISOString()
    })
  },

  async getCachedData(key) {
    const db = await getDB()
    const cached = await db.get(CACHED_DATA_STORE, key)
    if (cached) {
      if (new Date(cached.expiresAt) > new Date()) {
        return cached.data
      }
      await db.delete(CACHED_DATA_STORE, key)
    }
    return null
  },

  async clearCache() {
    const db = await getDB()
    await db.clear(CACHED_DATA_STORE)
  },

  async clearAll() {
    const db = await getDB()
    await db.clear(PENDING_QUEUE_STORE)
    await db.clear(LOCAL_COUNT_STORE)
    await db.clear(OFFLINE_TASKS_STORE)
    await db.clear(CACHED_DATA_STORE)
  }
}

export default offlineStorage
