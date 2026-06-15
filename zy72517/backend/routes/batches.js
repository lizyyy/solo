var express = require("express");
var router = express.Router();
module.exports = router;
var multer = require("multer");
var csvParser = require("csv-parser");
var Readable = require("stream").Readable;
var Parser = require("json2csv").Parser;

var dataStore = require("../services/dataStore");
var readBatches = dataStore.readBatches;
var writeBatches = dataStore.writeBatches;
var readRecords = dataStore.readRecords;
var writeRecords = dataStore.writeRecords;
var generateId = dataStore.generateId;

var selfCheck = require("../services/selfCheck");
var STATUS = selfCheck.STATUS;
var STATUS_LABELS = selfCheck.STATUS_LABELS;
var IMPORT_SOURCE_LABELS = selfCheck.IMPORT_SOURCE_LABELS;
var buildRecordFingerprint = selfCheck.buildRecordFingerprint;
var calcIncrementalImportDiff = selfCheck.calcIncrementalImportDiff;
var checkDuplicateImport = selfCheck.checkDuplicateImport;
var runFullCheck = selfCheck.runFullCheck;
var applyAutoStatus = selfCheck.applyAutoStatus;

var upload = multer({ storage: multer.memoryStorage() });

router.get("/", function(req, res) {
  var batches = readBatches();
  var records = readRecords();

  var batchesWithStats = batches.map(function(batch) {
    var batchRecords = records.filter(function(r) { return r.batchId === batch.id; });
    var result = {};
    Object.keys(batch).forEach(function(k) { result[k] = batch[k]; });
    result.recordCount = batchRecords.length;
    result.issueCount = batchRecords.filter(function(r) {
      return r.status === STATUS.DUPLICATE_USER || r.status === STATUS.NEEDS_REVIEW;
    }).length;
    return result;
  });

  res.json(batchesWithStats);
});

router.post("/", upload.single("file"), function(req, res) {
  var promise = new Promise(function(resolve, reject) {
    try {
      var batchName = req.body.batchName;
      var operator = req.body.operator;

      if (!batchName) {
        return res.status(400).json({ error: "批次名称不能为空" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "请上传CSV文件" });
      }

      var rows = [];
      var fileContent = req.file.buffer.toString("utf8");

      Readable.from(fileContent)
        .pipe(csvParser())
        .on("data", function(row) { rows.push(row); })
        .on("end", function() {
          try {
            if (rows.length === 0) {
              return res.status(400).json({ error: "CSV文件为空或格式错误" });
            }

            var existingBatches = readBatches();
            var existingRecords = readRecords();
            var existingBatch = existingBatches.find(function(b) { return b.name === batchName; });

            var batchId;
            var isIncremental = false;
            var batch;
            var newRecords = [];
            var reusedCount = 0;
            var newCount = 0;
            var incrementalDiff = null;

            if (existingBatch) {
              isIncremental = true;
              batchId = existingBatch.id;

              var diffResult = calcIncrementalImportDiff(batchId, existingRecords, rows);
              reusedCount = diffResult.reusedCount;
              newCount = diffResult.newCount;
              incrementalDiff = {
                reusedCount: reusedCount,
                newCount: newCount,
                totalBefore: existingRecords.filter(function(r) { return r.batchId === batchId; }).length,
                totalAfter: existingRecords.filter(function(r) { return r.batchId === batchId; }).length + newCount
              };

              var existingBatchRecords = existingRecords.filter(function(r) { return r.batchId === batchId; });
              var startLineNumber = existingBatchRecords.length + 2;

              newRecords = diffResult.newRecords.map(function(item, idx) {
                var row = item.row;
                var fingerprint = item.fingerprint;
                return {
                  id: generateId(),
                  batchId: batchId,
                  originalLineNumber: startLineNumber + idx,
                  importLineNumber: idx + 2,
                  questionText: row.question || row.问题 || "",
                  userId: row.user_id || row.用户ID || row.userId || "",
                  userName: row.user_name || row.用户名 || "",
                  feedbackTime: row.feedback_time || row.反馈时间 || "",
                  originalData: row,
                  status: STATUS.PENDING,
                  statusUpdatedAt: new Date().toISOString(),
                  statusUpdatedBy: "system_import",
                  manualChanges: [],
                  mergedIntoId: null,
                  mergedFromIds: [],
                  annotatorComment: "",
                  reviewComment: "",
                  importFingerprint: fingerprint,
                  importSource: "incremental"
                };
              });

              var batchIdx = existingBatches.findIndex(function(b) { return b.id === batchId; });
              var updatedBatch = {};
              Object.keys(existingBatch).forEach(function(k) { updatedBatch[k] = existingBatch[k]; });
              updatedBatch.rowCount = (existingBatch.rowCount || 0) + newCount;
              updatedBatch.updatedAt = new Date().toISOString();
              updatedBatch.updatedBy = operator || "system";
              batch = updatedBatch;
              existingBatches[batchIdx] = batch;
            } else {
              batchId = generateId();

              newRecords = rows.map(function(row, idx) {
                var fingerprint = buildRecordFingerprint(row);
                return {
                  id: generateId(),
                  batchId: batchId,
                  originalLineNumber: idx + 2,
                  importLineNumber: idx + 2,
                  questionText: row.question || row.问题 || "",
                  userId: row.user_id || row.用户ID || row.userId || "",
                  userName: row.user_name || row.用户名 || "",
                  feedbackTime: row.feedback_time || row.反馈时间 || "",
                  originalData: row,
                  status: STATUS.PENDING,
                  statusUpdatedAt: new Date().toISOString(),
                  statusUpdatedBy: "system_import",
                  manualChanges: [],
                  mergedIntoId: null,
                  mergedFromIds: [],
                  annotatorComment: "",
                  reviewComment: "",
                  importFingerprint: fingerprint,
                  importSource: "initial"
                };
              });

              batch = {
                id: batchId,
                name: batchName,
                createdAt: new Date().toISOString(),
                createdBy: operator || "system",
                fileName: req.file.originalname,
                rowCount: rows.length,
                importNotes: ""
              };

              existingBatches.push(batch);
              newCount = rows.length;
              incrementalDiff = {
                reusedCount: 0,
                newCount: newCount,
                totalBefore: 0,
                totalAfter: newCount
              };
            }

            var allRecords = existingRecords.concat(newRecords);
            allRecords = applyAutoStatus(allRecords, batchId);

            var duplicateIssues = checkDuplicateImport(batchId, existingRecords, rows);

            writeBatches(existingBatches);
            writeRecords(allRecords);

            var checkResult = runFullCheck(batchId);

            res.json({
              success: true,
              batch: batch,
              isIncremental: isIncremental,
              importedCount: newCount,
              reusedCount: reusedCount,
              totalCount: allRecords.filter(function(r) { return r.batchId === batchId; }).length,
              duplicateIssues: duplicateIssues,
              incrementalDiff: incrementalDiff,
              checkResult: checkResult
            });

            resolve();
          } catch (innerErr) {
            reject(innerErr);
          }
        })
        .on("error", reject);
    } catch (error) {
      reject(error);
    }
  });

  promise.catch(function(error) {
    console.error("导入失败:", error);
    res.status(500).json({ error: "导入失败: " + error.message });
  });
});

router.get("/:batchId", function(req, res) {
  var batchId = req.params.batchId;
  var batches = readBatches();
  var batch = batches.find(function(b) { return b.id === batchId; });

  if (!batch) {
    return res.status(404).json({ error: "批次不存在" });
  }

  var records = readRecords().filter(function(r) { return r.batchId === batchId; });
  var checkResult = runFullCheck(batchId);

  res.json({
    batch: batch,
    records: records,
    checkResult: checkResult
  });
});

router.get("/:batchId/records", function(req, res) {
  var batchId = req.params.batchId;
  var status = req.query.status;
  var userId = req.query.userId;
  var page = parseInt(req.query.page || 1);
  var pageSize = parseInt(req.query.pageSize || 50);

  var records = readRecords().filter(function(r) { return r.batchId === batchId; });

  if (status) {
    records = records.filter(function(r) { return r.status === status; });
  }
  if (userId) {
    records = records.filter(function(r) { return r.userId.indexOf(userId) !== -1; });
  }

  var total = records.length;
  var start = (page - 1) * pageSize;
  var paginatedRecords = records.slice(start, start + pageSize);

  res.json({
    total: total,
    page: page,
    pageSize: pageSize,
    records: paginatedRecords
  });
});

router.put("/:batchId/records/:recordId", function(req, res) {
  var batchId = req.params.batchId;
  var recordId = req.params.recordId;
  var status = req.body.status;
  var annotatorComment = req.body.annotatorComment;
  var reviewComment = req.body.reviewComment;
  var operator = req.body.operator;
  var reason = req.body.reason || "";

  var records = readRecords();
  var recordIndex = records.findIndex(function(r) { return r.id === recordId && r.batchId === batchId; });

  if (recordIndex === -1) {
    return res.status(404).json({ error: "记录不存在" });
  }

  var oldRecord = records[recordIndex];
  var changes = [];

  if (status && status !== oldRecord.status) {
    changes.push({
      field: "status",
      oldValue: oldRecord.status,
      newValue: status,
      changedAt: new Date().toISOString(),
      changedBy: operator || "unknown",
      reason: reason || "手动更新状态"
    });
  }

  if (annotatorComment !== undefined && annotatorComment !== oldRecord.annotatorComment) {
    changes.push({
      field: "annotatorComment",
      oldValue: oldRecord.annotatorComment,
      newValue: annotatorComment,
      changedAt: new Date().toISOString(),
      changedBy: operator || "unknown",
      reason: reason || "手动更新标注员留言"
    });
  }

  if (reviewComment !== undefined && reviewComment !== oldRecord.reviewComment) {
    changes.push({
      field: "reviewComment",
      oldValue: oldRecord.reviewComment,
      newValue: reviewComment,
      changedAt: new Date().toISOString(),
      changedBy: operator || "unknown",
      reason: reason || "手动更新复核意见"
    });
  }

  var newRecord = {};
  Object.keys(oldRecord).forEach(function(k) { newRecord[k] = oldRecord[k]; });
  if (status) newRecord.status = status;
  if (annotatorComment !== undefined) newRecord.annotatorComment = annotatorComment;
  if (reviewComment !== undefined) newRecord.reviewComment = reviewComment;
  newRecord.statusUpdatedAt = new Date().toISOString();
  newRecord.statusUpdatedBy = operator || "unknown";
  newRecord.manualChanges = (oldRecord.manualChanges || []).concat(changes);

  records[recordIndex] = newRecord;

  writeRecords(records);

  var checkResult = runFullCheck(batchId);

  res.json({
    success: true,
    record: records[recordIndex],
    checkResult: checkResult
  });
});

router.post("/:batchId/merge", function(req, res) {
  var batchId = req.params.batchId;
  var sourceRecordIds = req.body.sourceRecordIds;
  var targetRecordId = req.body.targetRecordId;
  var operator = req.body.operator;

  if (!targetRecordId || !sourceRecordIds || sourceRecordIds.length === 0) {
    return res.status(400).json({ error: "归并参数不完整" });
  }

  var records = readRecords();

  var targetRecord = records.find(function(r) { return r.id === targetRecordId && r.batchId === batchId; });
  if (!targetRecord) {
    return res.status(404).json({ error: "目标记录不存在" });
  }

  var updatedRecords = records.slice();

  sourceRecordIds.forEach(function(sourceId) {
    var sourceIdx = updatedRecords.findIndex(function(r) { return r.id === sourceId && r.batchId === batchId; });
    if (sourceIdx !== -1 && sourceId !== targetRecordId) {
      var sourceRecord = updatedRecords[sourceIdx];
      var newSourceRecord = {};
      Object.keys(sourceRecord).forEach(function(k) { newSourceRecord[k] = sourceRecord[k]; });
      newSourceRecord.status = STATUS.MERGED;
      newSourceRecord.mergedIntoId = targetRecordId;
      newSourceRecord.statusUpdatedAt = new Date().toISOString();
      newSourceRecord.statusUpdatedBy = operator || "unknown";
      newSourceRecord.manualChanges = (sourceRecord.manualChanges || []).concat([{
        field: "mergedIntoId",
        oldValue: null,
        newValue: targetRecordId,
        changedAt: new Date().toISOString(),
        changedBy: operator || "unknown",
        reason: "手动归并到目标记录"
      }]);
      updatedRecords[sourceIdx] = newSourceRecord;

      var targetIdx = updatedRecords.findIndex(function(r) { return r.id === targetRecordId; });
      if (targetIdx !== -1) {
        var newTargetRecord = {};
        Object.keys(updatedRecords[targetIdx]).forEach(function(k) { newTargetRecord[k] = updatedRecords[targetIdx][k]; });
        newTargetRecord.mergedFromIds = (newTargetRecord.mergedFromIds || []).concat([sourceId]);
        updatedRecords[targetIdx] = newTargetRecord;
      }
    }
  });

  writeRecords(updatedRecords);

  var checkResult = runFullCheck(batchId);

  res.json({
    success: true,
    checkResult: checkResult
  });
});

router.get("/:batchId/export", function(req, res) {
  var batchId = req.params.batchId;
  var format = req.query.format || "csv";

  var batches = readBatches();
  var batch = batches.find(function(b) { return b.id === batchId; });

  if (!batch) {
    return res.status(404).json({ error: "批次不存在" });
  }

  var allRecords = readRecords();
  var batchRecords = allRecords.filter(function(r) { return r.batchId === batchId; });

  var exportData = batchRecords.map(function(r) {
    return {
      "原始行号": r.originalLineNumber,
      "导入来源": IMPORT_SOURCE_LABELS[r.importSource] || r.importSource || "",
      "本次导入行号": r.importLineNumber || "",
      "用户ID": r.userId,
      "用户名": r.userName,
      "问题文本": r.questionText,
      "反馈时间": r.feedbackTime,
      "当前状态": STATUS_LABELS[r.status] || r.status,
      "标注员留言": r.annotatorComment,
      "复核意见": r.reviewComment,
      "是否已归并": r.status === STATUS.MERGED ? "是" : "否",
      "归并目标ID": r.mergedIntoId || "",
      "状态更新时间": r.statusUpdatedAt,
      "状态更新人": r.statusUpdatedBy
    };
  });

  var safeFileName = encodeURIComponent(batch.name + "_明细");

  if (format === "json") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename*=UTF-8''" + safeFileName + ".json");
    res.json(exportData);
  } else {
    var fields = exportData.length > 0 ? Object.keys(exportData[0]) : [];
    var parser = new Parser({ fields: fields });
    var csv = parser.parse(exportData);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename*=UTF-8''" + safeFileName + ".csv");
    res.send("\uFEFF" + csv);
  }
});

router.put("/:batchId/rename", function(req, res) {
  var batchId = req.params.batchId;
  var name = req.body.newName || req.body.name;
  var operator = req.body.operator;

  if (!name) {
    return res.status(400).json({ error: "批次名称不能为空" });
  }

  var batches = readBatches();
  var batchIdx = batches.findIndex(function(b) { return b.id === batchId; });

  if (batchIdx === -1) {
    return res.status(404).json({ error: "批次不存在" });
  }

  var duplicateBatch = batches.find(function(b) { return b.name === name && b.id !== batchId; });
  if (duplicateBatch) {
    return res.status(400).json({ error: "批次名称已存在，请换个名称" });
  }

  var newBatch = {};
  Object.keys(batches[batchIdx]).forEach(function(k) { newBatch[k] = batches[batchIdx][k]; });
  newBatch.name = name;
  newBatch.updatedAt = new Date().toISOString();
  newBatch.updatedBy = operator || "unknown";
  batches[batchIdx] = newBatch;

  writeBatches(batches);

  var checkResult = runFullCheck(batchId);

  res.json({
    success: true,
    batch: batches[batchIdx],
    checkResult: checkResult
  });
});

router.get("/:batchId/check", function(req, res) {
  var batchId = req.params.batchId;
  var result = runFullCheck(batchId);
  res.json(result);
});

router.post("/:batchId/recheck", function(req, res) {
  var batchId = req.params.batchId;
  var operator = req.body.operator;

  var records = readRecords();
  records = applyAutoStatus(records, batchId);
  writeRecords(records);

  var checkResult = runFullCheck(batchId);

  res.json({
    success: true,
    message: "补录后重算完成，已自动更新异常状态",
    checkResult: checkResult
  });
});

router.post("/:batchId/notes", function(req, res) {
  var batchId = req.params.batchId;
  var importNotes = req.body.importNotes;
  var operator = req.body.operator;

  var batches = readBatches();
  var batchIdx = batches.findIndex(function(b) { return b.id === batchId; });

  if (batchIdx === -1) {
    return res.status(404).json({ error: "批次不存在" });
  }

  var newBatch = {};
  Object.keys(batches[batchIdx]).forEach(function(k) { newBatch[k] = batches[batchIdx][k]; });
  newBatch.importNotes = importNotes;
  newBatch.notesUpdatedAt = new Date().toISOString();
  newBatch.notesUpdatedBy = operator || "unknown";
  batches[batchIdx] = newBatch;

  writeBatches(batches);

  res.json({
    success: true,
    batch: batches[batchIdx]
  });
});

module.exports = router;
