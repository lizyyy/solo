import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs/promises';
import path from 'path';
import { getAbnormalMaterials, getMaterialRawInput } from '../models/material.js';
import { getSupplierRawInput } from '../models/supplier.js';
import { getFullTraceByRerunMarker } from '../models/processingRecord.js';
import config from '../config.js';

export async function exportAbnormalSamples(outputPath = null) {
  const abnormalMaterials = await getAbnormalMaterials();
  
  if (!abnormalMaterials || abnormalMaterials.length === 0) {
    return { exported: 0, message: '没有异常样本需要导出' };
  }

  const exportData = [];
  
  for (const material of abnormalMaterials) {
    const rawInput = await getMaterialRawInput(material.id);
    const supplierRawInput = rawInput?.supplier ? 
      JSON.stringify(rawInput.supplier, null, 2) : 'N/A';
    const materialRawInput = rawInput?.material ?
      JSON.stringify(rawInput.material, null, 2) : 'N/A';
    
    exportData.push({
      material_id: material.id,
      supplier_id: material.supplier_id,
      batch_id: material.batch_id,
      material_type: material.material_type,
      status: material.status,
      error_message: material.error_message,
      cache_version: material.cache_version,
      created_at: new Date(material.created_at).toISOString(),
      supplier_raw_input: supplierRawInput,
      material_raw_input: materialRawInput,
      material_content: material.content.substring(0, 500)
    });
  }

  const filePath = outputPath || path.join(config.paths.exports, `abnormal_samples_${Date.now()}.csv`);
  
  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'material_id', title: '材料ID' },
      { id: 'supplier_id', title: '供应商ID' },
      { id: 'batch_id', title: '批次ID' },
      { id: 'material_type', title: '材料类型' },
      { id: 'status', title: '状态' },
      { id: 'error_message', title: '错误信息' },
      { id: 'cache_version', title: '缓存版本' },
      { id: 'created_at', title: '创建时间' },
      { id: 'supplier_raw_input', title: '供应商原始输入' },
      { id: 'material_raw_input', title: '材料原始输入' },
      { id: 'material_content', title: '材料内容' }
    ]
  });

  await csvWriter.writeRecords(exportData);
  
  return {
    exported: exportData.length,
    filePath,
    data: exportData
  };
}

export async function exportByRerunMarker(rerunMarker, outputPath = null) {
  const traceData = await getFullTraceByRerunMarker(rerunMarker);
  
  if (!traceData || traceData.length === 0) {
    return { exported: 0, message: '未找到该重跑标记的数据' };
  }

  const exportData = traceData.map(record => {
    let materialRaw = {};
    let supplierRaw = {};
    
    if (record.material_raw_input) {
      try {
        const parsed = JSON.parse(record.material_raw_input);
        materialRaw = parsed.material || parsed;
        supplierRaw = parsed.supplier || {};
      } catch (e) {
        materialRaw = {};
      }
    }
    
    if (Object.keys(supplierRaw).length === 0 && record.supplier_raw_input) {
      try {
        supplierRaw = JSON.parse(record.supplier_raw_input);
      } catch (e) {
        supplierRaw = {};
      }
    }

    return {
      rerun_marker: record.rerun_marker,
      record_id: record.record_id,
      action: record.action,
      result: record.result,
      conclusion: record.conclusion,
      record_created_at: new Date(record.created_at).toISOString(),
      material_id: record.material_id || 'N/A',
      material_type: record.material_type || 'N/A',
      material_status: record.status || 'N/A',
      supplier_code: record.supplier_code || 'N/A',
      supplier_name: record.supplier_name || 'N/A',
      supplier_raw_input: Object.keys(supplierRaw).length > 0 ? JSON.stringify(supplierRaw, null, 2) : 'N/A',
      material_raw_input: Object.keys(materialRaw).length > 0 ? JSON.stringify(materialRaw, null, 2) : 'N/A',
      material_content: record.content ? record.content.substring(0, 500) : 'N/A'
    };
  });

  const filePath = outputPath || path.join(config.paths.exports, `rerun_${rerunMarker}_${Date.now()}.csv`);
  
  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'rerun_marker', title: '重跑标记' },
      { id: 'record_id', title: '处理记录ID' },
      { id: 'action', title: '动作' },
      { id: 'result', title: '结果' },
      { id: 'conclusion', title: '结论' },
      { id: 'record_created_at', title: '处理时间' },
      { id: 'material_id', title: '材料ID' },
      { id: 'material_type', title: '材料类型' },
      { id: 'material_status', title: '材料状态' },
      { id: 'supplier_code', title: '供应商编码' },
      { id: 'supplier_name', title: '供应商名称' },
      { id: 'supplier_raw_input', title: '供应商原始输入' },
      { id: 'material_raw_input', title: '材料原始输入' },
      { id: 'material_content', title: '材料内容' }
    ]
  });

  await csvWriter.writeRecords(exportData);
  
  return {
    exported: exportData.length,
    filePath,
    data: exportData
  };
}
