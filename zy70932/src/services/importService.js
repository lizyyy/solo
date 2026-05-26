const { parse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');
const { getDb } = require('../db');
const { BatchModel, RecordModel, AuditLogModel, RectificationModel } = require('../models');

const db = getDb();

function parseNodeCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const rows = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
  return rows;
}

function parsePhotoJson(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function parseRectificationForm(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function buildRectificationMap(rectForm) {
  const map = {};
  if (!rectForm) return map;

  if (Array.isArray(rectForm)) {
    rectForm.forEach(item => {
      const key = item.node || item.site_node || item['工地节点'];
      if (key) {
        map[key] = item.rectifications || [item];
      }
    });
  } else if (typeof rectForm === 'object') {
    Object.keys(rectForm).forEach(key => {
      const val = rectForm[key];
      if (val && Array.isArray(val)) {
        map[key] = val;
      } else if (val && typeof val === 'object') {
        map[key] = val.rectifications || [val];
      }
    });
  }

  return map;
}

function importBatch({ batchName, createdBy, nodeCsvPath, photoJsonPath, rectificationFormPath, remark }) {
  const nodeRows = parseNodeCsv(nodeCsvPath);
  const photoList = parsePhotoJson(photoJsonPath);
  const rectForm = parseRectificationForm(rectificationFormPath);
  const rectMap = buildRectificationMap(rectForm);

  const photoMap = {};
  if (Array.isArray(photoList)) {
    photoList.forEach(item => {
      const key = item.node || item.site_node || item.id;
      if (key) photoMap[key] = item;
    });
  } else if (photoList && typeof photoList === 'object') {
    Object.assign(photoMap, photoList);
  }

  const tx = db.transaction(() => {
    const batchId = BatchModel.create(
      batchName,
      createdBy,
      nodeCsvPath,
      photoJsonPath,
      rectificationFormPath,
      remark
    );

    const recordIds = [];

    for (const row of nodeRows) {
      const siteNode = row['工地节点'] || row['site_node'] || row['node'] || row['Node'] || Object.values(row)[0];
      const supervisorSignature = row['监理签字'] || row['supervisor_signature'] || row['signature'] || row['监理'] || null;

      const photoKey = siteNode;
      const matchedPhoto = photoMap[photoKey] || null;

      const rectEntries = rectMap[siteNode] || [];

      const recordId = RecordModel.create(
        batchId,
        siteNode,
        supervisorSignature,
        row,
        matchedPhoto,
        rectEntries.length > 0 ? rectForm : null
      );

      AuditLogModel.create(recordId, 'created', '批次导入生成记录', createdBy, {
        batch_id: batchId,
        batch_name: batchName,
        site_node: siteNode,
        supervisor_signature: supervisorSignature
      });

      if (rectEntries.length > 0) {
        const sorted = rectEntries.slice().sort((a, b) => {
          const ca = a.rectification_count || a.count || 1;
          const cb = b.rectification_count || b.count || 1;
          return ca - cb;
        });

        let previousRectId = null;
        for (const entry of sorted) {
          const rectCount = entry.rectification_count || entry.count || 1;
          const rectNo = entry.rectification_no || entry.no || null;
          const handler = entry.handler || entry['处理人'] || createdBy;
          const formData = entry.form_data || entry.content || entry['整改内容'] || entry;

          const newRectId = RectificationModel.create(
            recordId,
            rectNo,
            rectCount,
            formData,
            previousRectId,
            null,
            handler
          );

          AuditLogModel.create(recordId, 'rectification_imported', `导入第${rectCount}次整改`, handler, {
            rectification_count: rectCount,
            rectification_no: rectNo,
            source_rectification_id: previousRectId,
            batch_import: true
          });

          previousRectId = newRectId;
        }

        const maxCount = sorted[sorted.length - 1].rectification_count || sorted[sorted.length - 1].count || sorted.length;
        RecordModel.setRectificationCount(recordId, maxCount);
        RecordModel.updateStatus(recordId, 'returned', `导入时已有${maxCount}次整改`);
      }

      recordIds.push(recordId);
    }

    if (recordIds.length > 0) {
      BatchModel.updateStatus(batchId, 'completed');
    }

    return { batchId, recordIds, recordCount: recordIds.length };
  });

  return tx();
}

module.exports = { importBatch, parseNodeCsv, parsePhotoJson, parseRectificationForm };