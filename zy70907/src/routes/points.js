const express = require("express");
const router = express.Router();
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const PointService = require("../services/pointService");
const BatchService = require("../services/batchService");
const WriteBackService = require("../services/writeBackService");
const ReportService = require("../services/reportService");

const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) { fs.mkdirSync(uploadDir, { recursive: true }); }
const storage = multer.diskStorage({ destination: (req, file, cb) => cb(null, uploadDir), filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname) });
const upload = multer({ storage });

router.post("/:batchId/upload", upload.single("file"), async (req, res) => {
  try {
    const batchId = req.params.batchId;
    const batch = await BatchService.getBatchById(batchId);
    if (!batch) { return res.status(404).json({ success: false, error: "批次不存在" }); }
    if (!req.file) { return res.status(400).json({ success: false, error: "请上传文件" }); }
    const dataList = [];
    fs.createReadStream(req.file.path).pipe(csv()).on("data", (row) => dataList.push(row)).on("end", async () => {
      try { const result = await PointService.processBatchData(batchId, dataList, req.file.originalname); res.json({ success: true, message: "文件上传并处理完成", data: result }); }
      catch (error) { res.status(500).json({ success: false, error: error.message }); }
    });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post("/:batchId/register", async (req, res) => {
  try {
    const batchId = req.params.batchId;
    const batch = await BatchService.getBatchById(batchId);
    if (!batch) { return res.status(404).json({ success: false, error: "批次不存在" }); }
    const { data } = req.body;
    if (!data || !Array.isArray(data) || data.length === 0) { return res.status(400).json({ success: false, error: "请提供有效的数据数组" }); }
    const result = await PointService.processBatchData(batchId, data, "manual_register");
    res.json({ success: true, message: "数据登记并处理完成", data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.get("/:batchId/details", async (req, res) => {
  try {
    const { status } = req.query;
    const details = await PointService.getDetailsByBatch(req.params.batchId, status);
    res.json({ success: true, data: details });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.get("/detail/:detailId", async (req, res) => {
  try {
    const detail = await PointService.getDetailWithRawMaterial(req.params.detailId);
    if (!detail) { return res.status(404).json({ success: false, error: "明细不存在" }); }
    detail.raw_data = JSON.parse(detail.raw_data);
    res.json({ success: true, data: detail });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.get("/detail/:detailId/traces", async (req, res) => {
  try {
    const traces = await PointService.getDetailTraces(req.params.detailId);
    res.json({ success: true, data: traces });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post("/:batchId/writeback", async (req, res) => {
  try {
    const { operator } = req.body;
    const result = await WriteBackService.triggerBatchWriteBack(req.params.batchId, operator || "system");
    res.json({ success: true, message: "回写流程触发完成", data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.get("/:batchId/report", async (req, res) => {
  try {
    const report = await ReportService.generateBatchReport(req.params.batchId);
    res.json({ success: true, data: report });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.get("/:batchId/report/download", async (req, res) => {
  try {
    const reportInfo = await ReportService.getReportFilePath(req.params.batchId);
    res.download(reportInfo.file_path, reportInfo.file_name, (err) => { if (err) { res.status(500).json({ success: false, error: "下载失败" }); } });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.get("/:batchId/errors", async (req, res) => {
  try {
    const errors = await ReportService.getErrorReport(req.params.batchId);
    res.json({ success: true, data: errors });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

module.exports = router;
