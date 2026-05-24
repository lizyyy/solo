const { LAYERS } = require('./merger');

const OVERRIDE_TYPES = {
  null_override: { label: 'NULL覆盖', description: '显式设置为null，覆盖之前的值' },
  value_override: { label: '值覆盖', description: '新值覆盖旧值' },
  array_replace: { label: '数组替换', description: '新数组完全替换旧数组' },
  array_concat: { label: '数组合并', description: '新数组追加到旧数组后面' },
  array_unique: { label: '数组去重合并', description: '合并数组并去重' },
  object_merge: { label: '对象合并', description: '递归合并对象属性' },
  new_value: { label: '新增值', description: '该层级新增配置项' }
};

function detectConflicts(traceMap, options) {
  const conflicts = [];
  const caseInconsistencies = [];

  if (!options.caseSensitive) {
    const allKeyUsages = new Map();

    for (const [path, entry] of Object.entries(traceMap)) {
      for (const [layerName, layerData] of Object.entries(entry.layers || {})) {
        if (layerData.key) {
          const pathParts = path.split('.');
          const keyName = pathParts[pathParts.length - 1];
          const parentPath = pathParts.slice(0, -1).join('.');
          const groupKey = parentPath ? `${parentPath}.${keyName.toLowerCase()}` : keyName.toLowerCase();

          if (!allKeyUsages.has(groupKey)) {
            allKeyUsages.set(groupKey, []);
          }
          allKeyUsages.get(groupKey).push({
            layer: layerName,
            key: layerData.key,
            path
          });
        }
      }
    }

    for (const [groupKey, usages] of allKeyUsages) {
      const uniqueKeys = new Set(usages.map(u => u.key));
      if (uniqueKeys.size > 1) {
        caseInconsistencies.push({
          path: usages[0].path,
          lowerKey: groupKey.split('.').pop(),
          usages: usages.map(u => ({
            layer: u.layer,
            key: u.key,
            layerLabel: LAYERS.find(l => l.name === u.layer)?.label || u.layer
          }))
        });
      }
    }
  }

  for (const [path, entry] of Object.entries(traceMap)) {
    const layerCount = Object.keys(entry.layers || {}).length;

    if (layerCount > 1 && entry.overridden) {
      const layerChain = getLayerChain(entry);

      if (entry.finalValue === null) {
        const nonNullLayers = Object.entries(entry.layers || {})
          .filter(([_, data]) => data.value !== null)
          .map(([layerName, data]) => ({
            layer: layerName,
            layerLabel: LAYERS.find(l => l.name === layerName)?.label || layerName,
            value: data.value
          }));

        if (nonNullLayers.length > 0) {
          conflicts.push({
            type: 'null_override',
            path,
            finalValue: null,
            finalLayer: entry.finalLayer,
            finalLayerLabel: LAYERS.find(l => l.name === entry.finalLayer)?.label || entry.finalLayer,
            overrideType: entry.overrideType,
            overrideTypeLabel: OVERRIDE_TYPES[entry.overrideType]?.label || entry.overrideType,
            overriddenValues: nonNullLayers,
            chain: layerChain
          });
        }
      } else {
        conflicts.push({
          type: 'override',
          path,
          finalValue: entry.finalValue,
          finalLayer: entry.finalLayer,
          finalLayerLabel: LAYERS.find(l => l.name === entry.finalLayer)?.label || entry.finalLayer,
          overrideType: entry.overrideType,
          overrideTypeLabel: OVERRIDE_TYPES[entry.overrideType]?.label || entry.overrideType,
          chain: layerChain
        });
      }
    }
  }

  return {
    conflicts,
    caseInconsistencies,
    hasConflicts: conflicts.length > 0 || caseInconsistencies.length > 0
  };
}

function getLayerChain(entry) {
  const chain = [];
  const sortedLayers = [...LAYERS].sort((a, b) => a.priority - b.priority);

  for (const layer of sortedLayers) {
    if (entry.layers && entry.layers[layer.name]) {
      const layerData = entry.layers[layer.name];
      chain.push({
        layer: layer.name,
        layerLabel: layer.label,
        value: layerData.value,
        key: layerData.key,
        isFinal: layer.name === entry.finalLayer
      });
    }
  }

  return chain;
}

function getOverrideChain(traceMap, keyPath) {
  const entry = traceMap[keyPath];
  if (!entry) {
    return null;
  }

  return {
    path: keyPath,
    finalValue: entry.finalValue,
    finalLayer: entry.finalLayer,
    finalLayerLabel: LAYERS.find(l => l.name === entry.finalLayer)?.label || entry.finalLayer,
    overrideType: entry.overrideType,
    overrideTypeLabel: OVERRIDE_TYPES[entry.overrideType]?.label || entry.overrideType,
    overrideDescription: OVERRIDE_TYPES[entry.overrideType]?.description || '',
    chain: getLayerChain(entry)
  };
}

function filterByKeyPath(traceMap, keyPath) {
  const result = {};
  const prefix = keyPath + '.';

  for (const [path, entry] of Object.entries(traceMap)) {
    if (path === keyPath || path.startsWith(prefix)) {
      result[path] = entry;
    }
  }

  return result;
}

function getStatistics(traceMap, conflicts) {
  const totalKeys = Object.keys(traceMap).length;
  const overriddenKeys = Object.values(traceMap).filter(e => e.overridden).length;
  const newKeys = Object.values(traceMap).filter(e => e.overrideType === 'new_value').length;
  const nullOverrides = Object.values(traceMap).filter(e => e.overrideType === 'null_override').length;

  const layerStats = {};
  for (const layer of LAYERS) {
    layerStats[layer.name] = {
      label: layer.label,
      totalKeys: 0,
      finalKeys: 0,
      overriddenKeys: 0
    };
  }

  for (const entry of Object.values(traceMap)) {
    for (const layerName of Object.keys(entry.layers || {})) {
      if (layerStats[layerName]) {
        layerStats[layerName].totalKeys++;
      }
    }
    if (entry.finalLayer && layerStats[entry.finalLayer]) {
      layerStats[entry.finalLayer].finalKeys++;
    }
    if (entry.overridden && layerStats[entry.finalLayer]) {
      layerStats[entry.finalLayer].overriddenKeys++;
    }
  }

  return {
    totalKeys,
    overriddenKeys,
    newKeys,
    nullOverrides,
    conflictCount: conflicts.conflicts.length,
    caseInconsistencyCount: conflicts.caseInconsistencies.length,
    layerStats
  };
}

module.exports = {
  detectConflicts,
  getOverrideChain,
  filterByKeyPath,
  getStatistics,
  OVERRIDE_TYPES,
  LAYERS
};
