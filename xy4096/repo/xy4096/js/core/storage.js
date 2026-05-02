/**
 * 状态存储模块
 * 使用 IndexedDB 进行本地持久化存储，支持：
 * - 凭证数据存储
 * - 公钥包存储
 * - 吊销名单存储
 * - 入场流水存储
 * - 配置设置存储
 * 
 * 刷新后数据不丢失
 */

const StorageManager = (function() {
    'use strict';

    // 数据库配置
    const DB_CONFIG = {
        name: 'OfflineCredentialSandbox',
        version: 1,
        stores: {
            credentials: { keyPath: 'id', autoIncrement: false },
            publicKeys: { keyPath: 'id', autoIncrement: false },
            revocations: { keyPath: 'credentialId', autoIncrement: false },
            entryRecords: { keyPath: 'id', autoIncrement: false },
            settings: { keyPath: 'key', autoIncrement: false },
            isolated: { keyPath: 'credentialId', autoIncrement: false }
        }
    };

    // 数据库实例
    let dbInstance = null;

    /**
     * 打开 IndexedDB 数据库
     * @returns {Promise<IDBDatabase>} 数据库实例
     */
    async function openDatabase() {
        if (dbInstance) {
            return dbInstance;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);

            request.onerror = () => {
                reject(new Error('无法打开数据库'));
            };

            request.onsuccess = () => {
                dbInstance = request.result;
                
                // 监听数据库版本变化
                dbInstance.onversionchange = () => {
                    dbInstance.close();
                    dbInstance = null;
                };

                resolve(dbInstance);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 创建对象仓库
                Object.entries(DB_CONFIG.stores).forEach(([storeName, storeConfig]) => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        const store = db.createObjectStore(storeName, {
                            keyPath: storeConfig.keyPath,
                            autoIncrement: storeConfig.autoIncrement
                        });

                        // 创建索引
                        if (storeName === 'credentials') {
                            store.createIndex('ticketType', 'ticketType', { unique: false });
                            store.createIndex('session', 'session', { unique: false });
                            store.createIndex('status', 'status', { unique: false });
                            store.createIndex('isIsolated', 'isIsolated', { unique: false });
                        }

                        if (storeName === 'entryRecords') {
                            store.createIndex('credentialId', 'credentialId', { unique: false });
                            store.createIndex('date', 'date', { unique: false });
                            store.createIndex('timestamp', 'timestamp', { unique: false });
                            store.createIndex('isAllowed', 'isAllowed', { unique: false });
                        }
                    }
                });
            };
        });
    }

    /**
     * 关闭数据库连接
     */
    function closeDatabase() {
        if (dbInstance) {
            dbInstance.close();
            dbInstance = null;
        }
    }

    /**
     * 执行数据库操作的通用方法
     * @param {string} storeName - 对象仓库名称
     * @param {string} mode - 事务模式 ('readonly' 或 'readwrite')
     * @param {Function} operation - 操作函数
     * @returns {Promise<any>} 操作结果
     */
    async function executeTransaction(storeName, mode, operation) {
        const db = await openDatabase();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, mode);
            const store = transaction.objectStore(storeName);

            let result;
            try {
                result = operation(store);
            } catch (error) {
                reject(error);
                return;
            }

            // 如果是 IDBRequest，处理其结果
            if (result && typeof result.onsuccess === 'function') {
                result.onsuccess = () => {
                    resolve(result.result);
                };
                result.onerror = () => {
                    reject(result.error);
                };
            } else {
                // 同步操作，等待事务完成
                transaction.oncomplete = () => {
                    resolve(result);
                };
                transaction.onerror = () => {
                    reject(transaction.error);
                };
            }
        });
    }

    /**
     * 获取所有数据
     * @param {string} storeName - 对象仓库名称
     * @returns {Promise<Array>} 数据数组
     */
    async function getAll(storeName) {
        return executeTransaction(storeName, 'readonly', (store) => {
            return store.getAll();
        });
    }

    /**
     * 根据键获取数据
     * @param {string} storeName - 对象仓库名称
     * @param {any} key - 键值
     * @returns {Promise<any>} 数据对象
     */
    async function getByKey(storeName, key) {
        return executeTransaction(storeName, 'readonly', (store) => {
            return store.get(key);
        });
    }

    /**
     * 添加或更新数据
     * @param {string} storeName - 对象仓库名称
     * @param {any} data - 要存储的数据
     * @returns {Promise<any>} 存储结果
     */
    async function put(storeName, data) {
        return executeTransaction(storeName, 'readwrite', (store) => {
            return store.put(data);
        });
    }

    /**
     * 批量添加或更新数据
     * @param {string} storeName - 对象仓库名称
     * @param {Array} dataArray - 数据数组
     * @returns {Promise<Array>} 存储结果数组
     */
    async function putBatch(storeName, dataArray) {
        const db = await openDatabase();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const results = [];

            dataArray.forEach((data, index) => {
                const request = store.put(data);
                request.onsuccess = () => {
                    results[index] = request.result;
                };
                request.onerror = () => {
                    results[index] = { error: request.error };
                };
            });

            transaction.oncomplete = () => {
                resolve(results);
            };
            transaction.onerror = () => {
                reject(transaction.error);
            };
        });
    }

    /**
     * 根据键删除数据
     * @param {string} storeName - 对象仓库名称
     * @param {any} key - 键值
     * @returns {Promise<void>}
     */
    async function deleteByKey(storeName, key) {
        return executeTransaction(storeName, 'readwrite', (store) => {
            return store.delete(key);
        });
    }

    /**
     * 清空对象仓库
     * @param {string} storeName - 对象仓库名称
     * @returns {Promise<void>}
     */
    async function clearStore(storeName) {
        return executeTransaction(storeName, 'readwrite', (store) => {
            return store.clear();
        });
    }

    /**
     * 使用索引查询数据
     * @param {string} storeName - 对象仓库名称
     * @param {string} indexName - 索引名称
     * @param {any} value - 索引值
     * @returns {Promise<Array>} 查询结果数组
     */
    async function getByIndex(storeName, indexName, value) {
        const db = await openDatabase();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);

            request.onsuccess = () => {
                resolve(request.result);
            };
            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * 获取数据数量
     * @param {string} storeName - 对象仓库名称
     * @returns {Promise<number>} 数据数量
     */
    async function count(storeName) {
        return executeTransaction(storeName, 'readonly', (store) => {
            return store.count();
        });
    }

    // ========== 高层 API - 针对具体数据类型 ==========

    /**
     * 凭证存储 API
     */
    const CredentialStore = {
        async getAll() {
            return getAll('credentials');
        },

        async getById(id) {
            return getByKey('credentials', id);
        },

        async save(credential) {
            credential.updatedAt = Date.now();
            return put('credentials', credential);
        },

        async saveBatch(credentials) {
            const now = Date.now();
            credentials.forEach(c => {
                c.updatedAt = now;
            });
            return putBatch('credentials', credentials);
        },

        async delete(id) {
            return deleteByKey('credentials', id);
        },

        async clear() {
            return clearStore('credentials');
        },

        async getByStatus(status) {
            return getByIndex('credentials', 'status', status);
        },

        async getBySession(session) {
            return getByIndex('credentials', 'session', session);
        },

        async getIsolated() {
            return getByIndex('credentials', 'isIsolated', true);
        },

        async count() {
            return count('credentials');
        }
    };

    /**
     * 公钥存储 API
     */
    const PublicKeyStore = {
        async getAll() {
            return getAll('publicKeys');
        },

        async getById(id) {
            return getByKey('publicKeys', id);
        },

        async save(publicKey) {
            publicKey.updatedAt = Date.now();
            return put('publicKeys', publicKey);
        },

        async saveBatch(publicKeys) {
            const now = Date.now();
            publicKeys.forEach(k => {
                k.updatedAt = now;
            });
            return putBatch('publicKeys', publicKeys);
        },

        async delete(id) {
            return deleteByKey('publicKeys', id);
        },

        async clear() {
            return clearStore('publicKeys');
        },

        async getActive() {
            const all = await getAll('publicKeys');
            const keys = Array.isArray(all) ? all : [];
            return keys.filter(k => k.isActive && !k.isDeprecated);
        },

        async count() {
            return count('publicKeys');
        }
    };

    /**
     * 吊销名单存储 API
     */
    const RevocationStore = {
        async getAll() {
            return getAll('revocations');
        },

        async getByCredentialId(credentialId) {
            return getByKey('revocations', credentialId);
        },

        async save(revocation) {
            return put('revocations', revocation);
        },

        async saveBatch(revocations) {
            return putBatch('revocations', revocations);
        },

        async delete(credentialId) {
            return deleteByKey('revocations', credentialId);
        },

        async clear() {
            return clearStore('revocations');
        },

        async isRevoked(credentialId) {
            const revocation = await getByKey('revocations', credentialId);
            return !!revocation;
        },

        async count() {
            return count('revocations');
        }
    };

    /**
     * 入场记录存储 API
     */
    const EntryRecordStore = {
        async getAll() {
            return getAll('entryRecords');
        },

        async getById(id) {
            return getByKey('entryRecords', id);
        },

        async save(record) {
            return put('entryRecords', record);
        },

        async saveBatch(records) {
            return putBatch('entryRecords', records);
        },

        async delete(id) {
            return deleteByKey('entryRecords', id);
        },

        async clear() {
            return clearStore('entryRecords');
        },

        async getByCredentialId(credentialId) {
            return getByIndex('entryRecords', 'credentialId', credentialId);
        },

        async getByDate(date) {
            return getByIndex('entryRecords', 'date', date);
        },

        async getToday() {
            const today = new Date().toISOString().split('T')[0];
            return this.getByDate(today);
        },

        async getByTimeRange(startTime, endTime) {
            const all = await getAll('entryRecords');
            const records = Array.isArray(all) ? all : [];
            return records.filter(r => 
                r.timestamp >= startTime && r.timestamp <= endTime
            );
        },

        async getUsedCredentialIds() {
            const all = await getAll('entryRecords');
            const records = Array.isArray(all) ? all : [];
            const allowedRecords = records.filter(r => r.isAllowed);
            return new Set(allowedRecords.map(r => r.credentialId));
        },

        async count() {
            return count('entryRecords');
        },

        async getStats() {
            const all = await getAll('entryRecords');
            const records = Array.isArray(all) ? all : [];
            const today = new Date().toISOString().split('T')[0];
            
            return {
                total: records.length,
                today: records.filter(r => r.date === today).length,
                allowed: records.filter(r => r.isAllowed).length,
                denied: records.filter(r => !r.isAllowed).length,
                duplicates: records.filter(r => 
                    r.denyReason && r.denyReason.includes('重复')
                ).length
            };
        }
    };

    /**
     * 配置设置存储 API
     */
    const SettingsStore = {
        async get(key, defaultValue = null) {
            const value = await getByKey('settings', key);
            return value ? value.data : defaultValue;
        },

        async set(key, data) {
            return put('settings', { key, data, updatedAt: Date.now() });
        },

        async delete(key) {
            return deleteByKey('settings', key);
        },

        async clear() {
            return clearStore('settings');
        },

        async getAll() {
            return getAll('settings');
        }
    };

    /**
     * 隔离区存储 API
     */
    const IsolatedStore = {
        async getAll() {
            return getAll('isolated');
        },

        async getByCredentialId(credentialId) {
            return getByKey('isolated', credentialId);
        },

        async save(isolated) {
            return put('isolated', isolated);
        },

        async delete(credentialId) {
            return deleteByKey('isolated', credentialId);
        },

        async clear() {
            return clearStore('isolated');
        },

        async count() {
            return count('isolated');
        }
    };

    /**
     * 清空所有数据
     * @returns {Promise<void>}
     */
    async function clearAll() {
        await Promise.all([
            CredentialStore.clear(),
            PublicKeyStore.clear(),
            RevocationStore.clear(),
            EntryRecordStore.clear(),
            SettingsStore.clear(),
            IsolatedStore.clear()
        ]);
        
        CryptoAdapter.clearCache();
    }

    /**
     * 导出所有数据
     * @returns {Promise<Object>} 导出的数据对象
     */
    async function exportAllData() {
        const [
            credentials,
            publicKeys,
            revocations,
            entryRecords,
            settings,
            isolated
        ] = await Promise.all([
            CredentialStore.getAll(),
            PublicKeyStore.getAll(),
            RevocationStore.getAll(),
            EntryRecordStore.getAll(),
            SettingsStore.getAll(),
            IsolatedStore.getAll()
        ]);

        return {
            version: '1.0.0',
            exportedAt: Date.now(),
            data: {
                credentials,
                publicKeys,
                revocations,
                entryRecords,
                settings,
                isolated
            }
        };
    }

    /**
     * 导入数据
     * @param {Object} data - 要导入的数据对象
     * @returns {Promise<void>}
     */
    async function importAllData(data) {
        if (!data.data) {
            throw new Error('无效的导入数据格式');
        }

        const { credentials, publicKeys, revocations, entryRecords, settings, isolated } = data.data;

        const promises = [];

        if (credentials && credentials.length > 0) {
            promises.push(CredentialStore.saveBatch(credentials));
        }
        if (publicKeys && publicKeys.length > 0) {
            promises.push(PublicKeyStore.saveBatch(publicKeys));
        }
        if (revocations && revocations.length > 0) {
            promises.push(RevocationStore.saveBatch(revocations));
        }
        if (entryRecords && entryRecords.length > 0) {
            promises.push(EntryRecordStore.saveBatch(entryRecords));
        }
        if (settings && settings.length > 0) {
            promises.push(putBatch('settings', settings));
        }
        if (isolated && isolated.length > 0) {
            promises.push(putBatch('isolated', isolated));
        }

        await Promise.all(promises);
    }

    /**
     * 检查 IndexedDB 是否可用
     * @returns {boolean} 是否可用
     */
    function isAvailable() {
        return typeof indexedDB !== 'undefined';
    }

    /**
     * LocalStorage 备用方案
     * 当 IndexedDB 不可用时使用
     */
    const LocalStorageFallback = {
        prefix: 'ocs_',

        get(key) {
            try {
                const value = localStorage.getItem(this.prefix + key);
                return value ? JSON.parse(value) : null;
            } catch (e) {
                return null;
            }
        },

        set(key, value) {
            try {
                localStorage.setItem(this.prefix + key, JSON.stringify(value));
                return true;
            } catch (e) {
                console.error('LocalStorage 存储失败:', e);
                return false;
            }
        },

        remove(key) {
            localStorage.removeItem(this.prefix + key);
        },

        clear() {
            Object.keys(localStorage)
                .filter(key => key.startsWith(this.prefix))
                .forEach(key => localStorage.removeItem(key));
        }
    };

    // 公开 API
    return {
        // 数据库基础操作
        openDatabase,
        closeDatabase,
        clearAll,

        // 数据导入导出
        exportAllData,
        importAllData,

        // 存储 API
        credentials: CredentialStore,
        publicKeys: PublicKeyStore,
        revocations: RevocationStore,
        entryRecords: EntryRecordStore,
        settings: SettingsStore,
        isolated: IsolatedStore,

        // 兼容性
        isAvailable,
        localStorage: LocalStorageFallback
    };
})();

// 导出到全局命名空间
window.StorageManager = StorageManager;
