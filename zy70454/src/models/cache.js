import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync } from './database.js';
import config from '../config.js';

export async function setCache(key, value, version = null) {
  const now = Date.now();
  const cacheVersion = version || uuidv4();
  const expiresAt = now + config.cache.ttl;
  
  const existing = await getAsync('SELECT cache_key FROM cache_state WHERE cache_key = ?', [key]);
  
  if (existing) {
    await runAsync(
      `UPDATE cache_state 
       SET cache_value = ?, version = ?, expires_at = ?, updated_at = ?
       WHERE cache_key = ?`,
      [JSON.stringify(value), cacheVersion, expiresAt, now, key]
    );
  } else {
    await runAsync(
      `INSERT INTO cache_state (cache_key, cache_value, version, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [key, JSON.stringify(value), cacheVersion, expiresAt, now, now]
    );
  }
  
  return { key, version: cacheVersion, expiresAt };
}

export async function getCache(key) {
  const now = Date.now();
  const cache = await getAsync('SELECT * FROM cache_state WHERE cache_key = ?', [key]);
  
  if (!cache) return null;
  if (cache.expires_at < now) return null;
  
  return {
    value: JSON.parse(cache.cache_value),
    version: cache.version,
    expiresAt: cache.expires_at
  };
}

export async function getCacheVersion(key) {
  const cache = await getCache(key);
  return cache ? cache.version : null;
}

export async function invalidateCache(key) {
  await runAsync('DELETE FROM cache_state WHERE cache_key = ?', [key]);
  return true;
}

export async function isCacheValid(key, expectedVersion) {
  const cache = await getCache(key);
  if (!cache) return false;
  return cache.version === expectedVersion;
}

export async function refreshCacheVersion(key) {
  const cache = await getCache(key);
  if (!cache) return null;
  return setCache(key, cache.value);
}
