import fs from 'fs/promises';
import path from 'path';
import { getMaterialsByBatch, getMaterialRawInput } from '../models/material.js';
import { getSupplierById, getSupplierRawInput, getAllSuppliers } from '../models/supplier.js';
import { getRecordsByBatch, getFullTraceByRerunMarker } from '../models/processingRecord.js';
import { getAbnormalMaterials } from '../models/material.js';
import config from '../config.js';

export async function generateBatchReport(batchId) {
  const materials = await getMaterialsByBatch(batchId);
  
  if (!materials || materials.length === 0) {
    return { generated: false, message: '未找到该批次的数据' };
  }

  const records = await getRecordsByBatch(batchId);
  
  const successCount = materials.filter(m => m.status === 'processed').length;
  const errorCount = materials.filter(m => m.status === 'error').length;
  const pendingCount = materials.filter(m => m.status === 'pending').length;

  const details = [];
  for (const material of materials) {
    const supplier = await getSupplierById(material.supplier_id);
    const materialRaw = await getMaterialRawInput(material.id);
    const supplierRaw = await getSupplierRawInput(material.supplier_id);
    
    details.push({
      materialId: material.id,
      supplierCode: supplier?.code,
      supplierName: supplier?.name,
      materialType: material.material_type,
      status: material.status,
      summary: material.summary,
      errorMessage: material.error_message,
      isAbnormal: material.is_abnormal,
      cacheVersion: material.cache_version,
      supplierRawInput: supplierRaw,
      materialRawInput: materialRaw
    });
  }

  const report = {
    batchId,
    generatedAt: new Date().toISOString(),
    summary: {
      total: materials.length,
      success: successCount,
      error: errorCount,
      pending: pendingCount
    },
    details,
    processingRecords: records
  };

  const filePath = path.join(config.paths.reports, `batch_${batchId}_${Date.now()}.json`);
  await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8');
  
  return {
    generated: true,
    filePath,
    report
  };
}

export async function generateLegalEvidenceReport(rerunMarker) {
  const traceData = await getFullTraceByRerunMarker(rerunMarker);
  
  if (!traceData || traceData.length === 0) {
    return { generated: false, message: '未找到该重跑标记的数据' };
  }

  const evidenceItems = [];
  
  for (const record of traceData) {
    let materialRaw = {};
    let supplierRaw = {};
    
    if (record.material_raw_input) {
      try {
        const parsed = JSON.parse(record.material_raw_input);
        materialRaw = parsed.material || parsed;
        supplierRaw = parsed.supplier || (record.supplier_raw_input ? JSON.parse(record.supplier_raw_input) : {});
      } catch (e) {
        materialRaw = {};
      }
    } else if (record.supplier_raw_input) {
      try {
        supplierRaw = JSON.parse(record.supplier_raw_input);
      } catch (e) {
        supplierRaw = {};
      }
    }
    
    evidenceItems.push({
      timestamp: new Date(record.created_at).toISOString(),
      action: record.action,
      result: record.result,
      conclusion: record.conclusion,
      evidence: {
        rerunMarker: record.rerun_marker,
        recordId: record.record_id,
        materialId: record.material_id,
        supplierCode: record.supplier_code,
        supplierName: record.supplier_name,
        supplierRawInput: supplierRaw,
        materialRawInput: materialRaw,
        materialContent: record.content
      }
    });
  }

  const reviewSample = evidenceItems.find(item => item.result === 'error') || evidenceItems[0];

  const report = {
    reportType: '法务证据报告',
    rerunMarker,
    generatedAt: new Date().toISOString(),
    reviewSample: {
      title: '复核样例 - 用于审计和法务查证',
      description: '此样例展示了完整的处理链路，可用于追溯输入、动作和结论',
      data: reviewSample
    },
    fullTrace: evidenceItems,
    statistics: {
      totalRecords: traceData.length,
      successCount: traceData.filter(r => r.result === 'success').length,
      errorCount: traceData.filter(r => r.result === 'error').length,
      initiatedCount: traceData.filter(r => r.result === 'initiated').length,
      createdCount: traceData.filter(r => r.result === 'created').length,
      existingCount: traceData.filter(r => r.result === 'existing').length
    },
    disclaimer: '本报告中的所有数据均来自系统自动记录，原始输入已完整保存，可用于法务查证和审计追溯。'
  };

  const filePath = path.join(config.paths.reports, `legal_evidence_${rerunMarker}_${Date.now()}.json`);
  await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8');
  
  return {
    generated: true,
    filePath,
    report
  };
}

export async function generateSummaryReport() {
  const abnormalMaterials = await getAbnormalMaterials();
  const suppliers = await getAllSuppliers();

  const report = {
    reportType: '数据废弃处理总览报告',
    generatedAt: new Date().toISOString(),
    summary: {
      totalSuppliers: suppliers.length,
      totalAbnormal: abnormalMaterials.length,
      abnormalDetails: abnormalMaterials.map(m => ({
        materialId: m.id,
        batchId: m.batch_id,
        error: m.error_message,
        createdAt: new Date(m.created_at).toISOString()
      }))
    }
  };

  const filePath = path.join(config.paths.reports, `summary_${Date.now()}.json`);
  await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8');
  
  return {
    generated: true,
    filePath,
    report
  };
}
