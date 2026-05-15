import { v4 as uuidv4 } from 'uuid';
import { createSupplier, getSupplierByCode, updateSupplierStatus } from '../models/supplier.js';
import { createMaterial, updateMaterialStatus, updateMaterialSummary, markAsAbnormal, getMaterialsByBatch } from '../models/material.js';
import { createProcessingRecord } from '../models/processingRecord.js';
import { setCache, getCacheVersion, isCacheValid } from '../models/cache.js';

const CACHE_KEY_SUPPLIER = 'supplier_catalog';

function generateSummary(content) {
  return `摘要：${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`;
}

export async function processSupplierBatch(batchData) {
  const batchId = uuidv4();
  const results = [];
  const rerunMarker = `RERUN-${Date.now()}`;
  
  const cacheInfo = await setCache(CACHE_KEY_SUPPLIER, { refreshedAt: Date.now() });
  const currentCacheVersion = cacheInfo.version;
  
  for (const item of batchData) {
    const result = await processSingleSupplier(item, batchId, currentCacheVersion, rerunMarker);
    results.push(result);
  }
  
  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  
  return {
    batchId,
    rerunMarker,
    total: results.length,
    success: successCount,
    error: errorCount,
    details: results
  };
}

async function processSingleSupplier(item, batchId, cacheVersion, rerunMarker) {
  try {
    await createProcessingRecord({
      batch_id: batchId,
      material_id: 'pre-check',
      action: '开始处理供应商',
      result: 'initiated',
      conclusion: `开始处理供应商: ${item.supplier.name}`,
      rerun_marker: rerunMarker
    });

    let supplier = await getSupplierByCode(item.supplier.code);
    
    if (!supplier) {
      supplier = await createSupplier(item.supplier);
      await createProcessingRecord({
        batch_id: batchId,
        material_id: 'supplier-creation',
        action: '创建供应商记录',
        result: 'created',
        conclusion: `新建供应商: ${supplier.name}`,
        rerun_marker: rerunMarker
      });
    } else {
      await createProcessingRecord({
        batch_id: batchId,
        material_id: 'supplier-existing',
        action: '供应商已存在',
        result: 'existing',
        conclusion: `供应商已存在: ${supplier.name}`,
        rerun_marker: rerunMarker
      });
    }

    const material = await createMaterial({
      supplier_id: supplier.id,
      batch_id: batchId,
      material_type: item.material.type,
      content: item.material.content,
      cache_version: cacheVersion
    });

    await createProcessingRecord({
      batch_id: batchId,
      material_id: material.id,
      action: '创建材料记录',
      result: 'created',
      conclusion: `材料类型: ${item.material.type}`,
      rerun_marker: rerunMarker
    });

    if (item.simulateCacheIssue) {
      const staleCache = await simulateStaleCache(material.id, batchId, rerunMarker);
      return staleCache;
    }

    const summary = generateSummary(item.material.content);
    await updateMaterialSummary(material.id, summary);
    await updateMaterialStatus(material.id, 'processed');
    await updateSupplierStatus(supplier.id, 'completed');

    await createProcessingRecord({
      batch_id: batchId,
      material_id: material.id,
      action: '材料处理完成',
      result: 'success',
      conclusion: `材料摘要生成完成`,
      rerun_marker: rerunMarker
    });

    return {
      materialId: material.id,
      supplierId: supplier.id,
      supplierCode: item.supplier.code,
      supplierName: item.supplier.name,
      status: 'success',
      summary,
      rawInput: item
    };

  } catch (error) {
    return {
      supplierCode: item.supplier?.code || 'unknown',
      supplierName: item.supplier?.name || 'unknown',
      status: 'error',
      error: error.message,
      rawInput: item
    };
  }
}

async function simulateStaleCache(materialId, batchId, rerunMarker) {
  const expectedVersion = await getCacheVersion(CACHE_KEY_SUPPLIER);
  const wrongVersion = expectedVersion + '_stale';

  await markAsAbnormal(materialId, `缓存版本不匹配: 预期 ${expectedVersion}, 实际 ${wrongVersion}`);

  await createProcessingRecord({
    batch_id: batchId,
    material_id: materialId,
    action: '缓存验证失败',
    result: 'error',
    conclusion: `缓存未刷新: 预期版本 ${expectedVersion}`,
    rerun_marker: rerunMarker
  });

  const materials = await getMaterialsByBatch(batchId);
  const material = materials.find(m => m.id === materialId);
  
  return {
    materialId: materialId,
    status: 'error',
    errorType: 'cache_not_refreshed',
    errorMessage: '缓存未刷新导致处理失败',
    expectedCacheVersion: expectedVersion,
    actualCacheVersion: wrongVersion,
    isAbnormal: true,
    rawInput: material ? JSON.parse(material.raw_input) : null
  };
}

export async function validateCache(materialId, expectedVersion) {
  return isCacheValid(CACHE_KEY_SUPPLIER, expectedVersion);
}

export async function refreshSupplierCache() {
  return setCache(CACHE_KEY_SUPPLIER, { refreshedAt: Date.now() });
}
