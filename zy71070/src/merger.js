const ARRAY_MERGE_MODES = {
  REPLACE: 'replace',
  CONCAT: 'concat',
  UNIQUE: 'unique'
};

const LAYERS = [
  { name: 'default', label: '默认值', priority: 1 },
  { name: 'env', label: '环境配置', priority: 2 },
  { name: 'tenant', label: '租户配置', priority: 3 }
];

function normalizeKey(key, caseSensitive) {
  if (caseSensitive) return key;
  return key.toLowerCase();
}

function getKeyPath(parentPath, key) {
  return parentPath ? `${parentPath}.${key}` : key;
}

function deepMergeWithTrace(target, source, layerName, layerLabel, options, traceMap, parentPath = '') {
  const result = { ...target };
  const { caseSensitive, arrayMergeMode } = options;

  const targetKeys = Object.keys(target);
  const sourceKeys = Object.keys(source);

  const targetKeyMap = {};
  targetKeys.forEach(key => {
    targetKeyMap[normalizeKey(key, caseSensitive)] = key;
  });

  for (const sourceKey of sourceKeys) {
    const normalizedSourceKey = normalizeKey(sourceKey, caseSensitive);
    const originalTargetKey = targetKeyMap[normalizedSourceKey];
    const targetKey = originalTargetKey || sourceKey;

    const pathKey = targetKey;
    const currentPath = getKeyPath(parentPath, pathKey);

    const sourceValue = source[sourceKey];
    const targetValue = target[targetKey];

    const traceEntry = traceMap.get(currentPath) || {
      path: currentPath,
      layers: {},
      finalValue: undefined,
      finalLayer: null,
      conflict: false
    };

    traceEntry.layers[layerName] = {
      value: sourceValue,
      layer: layerName,
      layerLabel,
      key: sourceKey
    };

    if (sourceValue === null) {
      result[targetKey] = null;
      traceEntry.finalValue = null;
      traceEntry.finalLayer = layerName;
      traceEntry.overridden = true;
      traceEntry.overrideType = 'null_override';
      delete targetKeyMap[normalizedSourceKey];
      traceMap.set(currentPath, traceEntry);
      continue;
    }

    if (Array.isArray(sourceValue)) {
      let mergedArray;

      if (targetValue === undefined || !Array.isArray(targetValue)) {
        mergedArray = [...sourceValue];
        traceEntry.overrideType = 'new_value';
      } else {
        switch (arrayMergeMode) {
          case ARRAY_MERGE_MODES.CONCAT:
            mergedArray = [...targetValue, ...sourceValue];
            traceEntry.overrideType = 'array_concat';
            break;
          case ARRAY_MERGE_MODES.UNIQUE:
            mergedArray = [...new Set([...targetValue, ...sourceValue])];
            traceEntry.overrideType = 'array_unique';
            break;
          case ARRAY_MERGE_MODES.REPLACE:
          default:
            mergedArray = [...sourceValue];
            traceEntry.overrideType = 'array_replace';
            break;
        }
      }

      result[targetKey] = mergedArray;
      traceEntry.finalValue = mergedArray;
      traceEntry.finalLayer = layerName;
      delete targetKeyMap[normalizedSourceKey];
      traceMap.set(currentPath, traceEntry);
      continue;
    }

    if (typeof sourceValue === 'object' && sourceValue !== null) {
      const nestedTarget = targetValue && typeof targetValue === 'object' && !Array.isArray(targetValue)
        ? targetValue
        : {};

      const nestedResult = deepMergeWithTrace(
        nestedTarget,
        sourceValue,
        layerName,
        layerLabel,
        options,
        traceMap,
        currentPath
      );

      result[targetKey] = nestedResult;
      traceEntry.finalValue = nestedResult;
      traceEntry.finalLayer = layerName;
      traceEntry.overrideType = 'object_merge';
      delete targetKeyMap[normalizedSourceKey];
      traceMap.set(currentPath, traceEntry);
      continue;
    }

    if (targetValue !== undefined) {
      traceEntry.overridden = true;
      traceEntry.overrideType = 'value_override';
      traceEntry.previousValue = targetValue;
    } else {
      traceEntry.overrideType = 'new_value';
    }

    result[targetKey] = sourceValue;
    traceEntry.finalValue = sourceValue;
    traceEntry.finalLayer = layerName;
    delete targetKeyMap[normalizedSourceKey];
    traceMap.set(currentPath, traceEntry);
  }

  for (const remainingKey of Object.keys(targetKeyMap)) {
    const originalKey = targetKeyMap[remainingKey];
    const currentPath = getKeyPath(parentPath, originalKey);
    const traceEntry = traceMap.get(currentPath);
    if (traceEntry) {
      traceEntry.finalValue = target[originalKey];
      traceMap.set(currentPath, traceEntry);
    }
  }

  return result;
}

function mergeConfigs(layers, options) {
  const traceMap = new Map();
  let result = {};

  const sortedLayers = [...LAYERS].sort((a, b) => a.priority - b.priority);

  for (const layer of sortedLayers) {
    const layerConfig = layers[layer.name];
    if (layerConfig) {
      result = deepMergeWithTrace(
        result,
        layerConfig,
        layer.name,
        layer.label,
        options,
        traceMap
      );
    }
  }

  return {
    mergedConfig: result,
    traceMap: Object.fromEntries(traceMap)
  };
}

module.exports = {
  mergeConfigs,
  ARRAY_MERGE_MODES,
  LAYERS
};
