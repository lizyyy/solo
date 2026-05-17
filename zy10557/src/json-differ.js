const _ = require('lodash');

const DIFF_TYPES = {
  ADDED: 'added',
  REMOVED: 'removed',
  CHANGED: 'changed',
  ARRAY_ITEM_ADDED: 'array_item_added',
  ARRAY_ITEM_REMOVED: 'array_item_removed',
  ARRAY_ORDER_CHANGED: 'array_order_changed',
  DEFAULT_VALUE: 'default_value',
  SENSITIVE: 'sensitive'
};

class JsonDiffer {
  constructor(options = {}) {
    this.arrayNormalize = options.arrayNormalize !== false;
    this.arrayKeyFields = options.arrayKeyFields || {};
    this.ignoreArrayOrder = options.ignoreArrayOrder !== false;
  }

  diff(obj1, obj2, path = '') {
    const diffs = [];

    if (_.isArray(obj1) && _.isArray(obj2)) {
      return this.diffArrays(obj1, obj2, path);
    }

    if (_.isObject(obj1) && _.isObject(obj2)) {
      return this.diffObjects(obj1, obj2, path);
    }

    if (!_.isEqual(obj1, obj2)) {
      diffs.push({
        type: DIFF_TYPES.CHANGED,
        path,
        oldValue: obj1,
        newValue: obj2
      });
    }

    return diffs;
  }

  diffObjects(obj1, obj2, path) {
    const diffs = [];
    const allKeys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);

    for (const key of allKeys) {
      const currentPath = path ? `${path}.${key}` : key;
      const val1 = obj1?.[key];
      const val2 = obj2?.[key];

      if (!(key in obj1)) {
        diffs.push({
          type: DIFF_TYPES.ADDED,
          path: currentPath,
          value: val2
        });
      } else if (!(key in obj2)) {
        diffs.push({
          type: DIFF_TYPES.REMOVED,
          path: currentPath,
          value: val1
        });
      } else if (_.isArray(val1) && _.isArray(val2)) {
        diffs.push(...this.diffArrays(val1, val2, currentPath));
      } else if (_.isObject(val1) && _.isObject(val2)) {
        diffs.push(...this.diffObjects(val1, val2, currentPath));
      } else if (!_.isEqual(val1, val2)) {
        diffs.push({
          type: DIFF_TYPES.CHANGED,
          path: currentPath,
          oldValue: val1,
          newValue: val2
        });
      }
    }

    return diffs;
  }

  diffArrays(arr1, arr2, path) {
    const diffs = [];
    const keyField = this.getArrayKeyField(path);

    if (this.arrayNormalize && keyField) {
      return this.diffArraysByKey(arr1, arr2, path, keyField);
    }

    if (this.ignoreArrayOrder) {
      return this.diffArraysUnordered(arr1, arr2, path);
    }

    const maxLen = Math.max(arr1.length, arr2.length);
    for (let i = 0; i < maxLen; i++) {
      const currentPath = `${path}[${i}]`;
      if (i >= arr1.length) {
        diffs.push({
          type: DIFF_TYPES.ARRAY_ITEM_ADDED,
          path: currentPath,
          index: i,
          value: arr2[i]
        });
      } else if (i >= arr2.length) {
        diffs.push({
          type: DIFF_TYPES.ARRAY_ITEM_REMOVED,
          path: currentPath,
          index: i,
          value: arr1[i]
        });
      } else {
        diffs.push(...this.diff(arr1[i], arr2[i], currentPath));
      }
    }

    return diffs;
  }

  diffArraysByKey(arr1, arr2, path, keyField) {
    const diffs = [];
    const map1 = this.arrayToMap(arr1, keyField);
    const map2 = this.arrayToMap(arr2, keyField);
    const allKeys = new Set([...map1.keys(), ...map2.keys()]);

    for (const key of allKeys) {
      const currentPath = `${path}[${keyField}=${key}]`;
      if (!map1.has(key)) {
        diffs.push({
          type: DIFF_TYPES.ARRAY_ITEM_ADDED,
          path: currentPath,
          keyField,
          keyValue: key,
          value: map2.get(key)
        });
      } else if (!map2.has(key)) {
        diffs.push({
          type: DIFF_TYPES.ARRAY_ITEM_REMOVED,
          path: currentPath,
          keyField,
          keyValue: key,
          value: map1.get(key)
        });
      } else {
        diffs.push(...this.diff(map1.get(key), map2.get(key), currentPath));
      }
    }

    return diffs;
  }

  diffArraysUnordered(arr1, arr2, path) {
    const diffs = [];
    const arr1Copy = [...arr1];
    const arr2Copy = [...arr2];
    const matchedIndices = new Set();

    for (let i = 0; i < arr1Copy.length; i++) {
      let foundMatch = false;
      for (let j = 0; j < arr2Copy.length; j++) {
        if (matchedIndices.has(j)) continue;
        if (_.isEqual(arr1Copy[i], arr2Copy[j])) {
          matchedIndices.add(j);
          foundMatch = true;
          break;
        }
      }
      if (!foundMatch) {
        diffs.push({
          type: DIFF_TYPES.ARRAY_ITEM_REMOVED,
          path: `${path}[${i}]`,
          index: i,
          value: arr1Copy[i]
        });
      }
    }

    for (let j = 0; j < arr2Copy.length; j++) {
      if (!matchedIndices.has(j)) {
        diffs.push({
          type: DIFF_TYPES.ARRAY_ITEM_ADDED,
          path: `${path}[${j}]`,
          index: j,
          value: arr2Copy[j]
        });
      }
    }

    return diffs;
  }

  arrayToMap(arr, keyField) {
    const map = new Map();
    for (const item of arr) {
      const key = item?.[keyField];
      if (key !== undefined) {
        map.set(String(key), item);
      }
    }
    return map;
  }

  getArrayKeyField(path) {
    for (const [pattern, keyField] of Object.entries(this.arrayKeyFields)) {
      if (path.includes(pattern) || path.match(new RegExp(pattern))) {
        return keyField;
      }
    }
    return null;
  }

  multiEnvDiff(configs, baseEnv) {
    const envs = Object.keys(configs);
    const results = {};

    for (const env of envs) {
      if (env === baseEnv) continue;
      results[`${baseEnv}..${env}`] = {
        baseEnv,
        targetEnv: env,
        diffs: this.diff(configs[baseEnv], configs[env])
      };
    }

    return results;
  }
}

JsonDiffer.DIFF_TYPES = DIFF_TYPES;

module.exports = JsonDiffer;