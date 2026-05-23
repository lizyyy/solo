const { calculateFileHash } = require('./scanner');

function detectMissingPhotos(files, requiredTypes, options = {}) {
  const result = {
    totalWorkOrders: 0,
    completeWorkOrders: 0,
    incompleteWorkOrders: 0,
    missingItems: [],
    workOrders: {}
  };
  
  const grouped = groupByWorkOrder(files);
  
  for (const [workOrderKey, workOrderFiles] of Object.entries(grouped)) {
    const workOrderInfo = workOrderFiles[0].parsed;
    
    if (options.customer && workOrderInfo.customerId !== options.customer.toUpperCase()) {
      continue;
    }
    if (options.workorder && workOrderInfo.workOrderId !== options.workorder.toUpperCase()) {
      continue;
    }
    
    result.totalWorkOrders++;
    result.workOrders[workOrderKey] = {
      customerId: workOrderInfo.customerId,
      workOrderId: workOrderInfo.workOrderId,
      files: workOrderFiles.map(f => ({
        type: f.parsed.photoType,
        path: f.path,
        name: f.name
      })),
      presentTypes: [],
      missingTypes: []
    };
    
    const presentTypes = new Set(workOrderFiles.map(f => f.parsed.photoType));
    const missingTypes = requiredTypes.filter(t => !presentTypes.has(t));
    
    result.workOrders[workOrderKey].presentTypes = Array.from(presentTypes);
    result.workOrders[workOrderKey].missingTypes = missingTypes;
    
    if (missingTypes.length === 0) {
      result.completeWorkOrders++;
    } else {
      result.incompleteWorkOrders++;
      result.missingItems.push({
        customerId: workOrderInfo.customerId,
        workOrderId: workOrderInfo.workOrderId,
        missingTypes,
        presentTypes: Array.from(presentTypes),
        files: workOrderFiles.map(f => f.path)
      });
    }
  }
  
  return result;
}

function groupByWorkOrder(files) {
  const groups = {};
  
  for (const file of files) {
    const key = `${file.parsed.customerId}-${file.parsed.workOrderId}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(file);
  }
  
  return groups;
}

async function detectDuplicates(files, useContentHash = true) {
  const result = {
    totalDuplicates: 0,
    duplicateGroups: [],
    detectionMethod: useContentHash ? 'content-hash' : 'size-only'
  };
  
  const sizeGroups = {};
  for (const file of files) {
    const sizeKey = file.size.toString();
    if (!sizeGroups[sizeKey]) {
      sizeGroups[sizeKey] = [];
    }
    sizeGroups[sizeKey].push(file);
  }
  
  for (const [size, sizeGroupFiles] of Object.entries(sizeGroups)) {
    if (sizeGroupFiles.length < 2) continue;
    
    const typeGroups = {};
    for (const file of sizeGroupFiles) {
      const key = `${file.parsed.customerId}-${file.parsed.workOrderId}-${file.parsed.photoType}`;
      if (!typeGroups[key]) {
        typeGroups[key] = [];
      }
      typeGroups[key].push(file);
    }
    
    for (const [key, groupFiles] of Object.entries(typeGroups)) {
      if (groupFiles.length < 2) continue;
      
      if (useContentHash) {
        const hashGroups = {};
        for (const file of groupFiles) {
          try {
            const hash = await calculateFileHash(file.path);
            if (!hashGroups[hash]) {
              hashGroups[hash] = [];
            }
            hashGroups[hash].push(file);
          } catch (error) {
            console.warn(`无法计算文件哈希: ${file.path}`);
          }
        }
        
        for (const [hash, hashGroupFiles] of Object.entries(hashGroups)) {
          if (hashGroupFiles.length >= 2) {
            result.totalDuplicates += hashGroupFiles.length - 1;
            result.duplicateGroups.push({
              customerId: hashGroupFiles[0].parsed.customerId,
              workOrderId: hashGroupFiles[0].parsed.workOrderId,
              photoType: hashGroupFiles[0].parsed.photoType,
              hash,
              count: hashGroupFiles.length,
              files: hashGroupFiles.map(f => ({
                path: f.path,
                name: f.name,
                size: f.size,
                mtime: f.mtime
              }))
            });
          }
        }
      } else {
        result.totalDuplicates += groupFiles.length - 1;
        result.duplicateGroups.push({
          customerId: groupFiles[0].parsed.customerId,
          workOrderId: groupFiles[0].parsed.workOrderId,
          photoType: groupFiles[0].parsed.photoType,
          count: groupFiles.length,
          files: groupFiles.map(f => ({
            path: f.path,
            name: f.name,
            size: f.size,
            mtime: f.mtime
          }))
        });
      }
    }
  }
  
  return result;
}

module.exports = {
  detectMissingPhotos,
  detectDuplicates,
  groupByWorkOrder
};
