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

function importBatch({ batchName, createdBy, nodeCsvPath, photoJsonPath, rectificationFormPath, remark }) {
  const nodeRows = parseNodeCsv(nodeCsvPath);
  const photoList = parsePhotoJson(photoJsonPath);
  const rectForm = parseRectificationForm(rectificationFormPath);

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

      const recordId = RecordModel.create(
        batchId,
        siteNode,
        supervisorSignature,
        row,
        matchedPhoto,
        rectForm
      );

      AuditLogModel.create(recordId, 'created', '批次导入生成记录', createdBy, {
        batch_id: batchId,
        batch_name: batchName,
        site_node: siteNode,
        supervisor_signature: supervisorSignature
      });

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