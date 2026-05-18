const { Appeal, STATUS } = require('../models/appeal');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const moment = require('moment');

exports.create = (req, res) => {
  try {
    const appeal = Appeal.create(req.body);
    res.status(201).json({
      success: true,
      data: appeal
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.update = (req, res) => {
  try {
    const appeal = Appeal.update(req.params.id, req.body);
    if (!appeal) {
      return res.status(404).json({
        success: false,
        error: '申诉记录不存在'
      });
    }
    res.json({
      success: true,
      data: appeal
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.findById = (req, res) => {
  const appeal = Appeal.findById(req.params.id);
  if (!appeal) {
    return res.status(404).json({
      success: false,
      error: '申诉记录不存在'
    });
  }
  res.json({
    success: true,
    data: appeal
  });
};

exports.findAll = (req, res) => {
  const filters = {
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    status: req.query.status,
    handler: req.query.handler,
    storeId: req.query.storeId,
    storeName: req.query.storeName
  };

  const appeals = Appeal.findAll(filters);
  res.json({
    success: true,
    data: appeals,
    total: appeals.length
  });
};

exports.batchImport = (req, res) => {
  try {
    const { data } = req.body;
    if (!Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        error: '数据必须是数组格式'
      });
    }

    const results = Appeal.batchImport(data);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const warningCount = results.filter(r => r.warning).length;

    res.json({
      success: true,
      data: {
        results,
        summary: {
        total: data.length,
        success: successCount,
        fail: failCount,
        warning: warningCount
      }
    }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.exportCsv = (req, res) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      status: req.query.status,
      handler: req.query.handler,
      storeId: req.query.storeId,
      storeName: req.query.storeName
    };

    const appeals = Appeal.findAll(filters);

    const csvWriter = createCsvWriter({
      path: `/tmp/appeals_${moment().format('YYYYMMDDHHmmss')}.csv`,
      header: [
        {id: 'id', title: 'ID'},
        {id: 'trackingNumber', title: '快递单号'},
        {id: 'recipientName', title: '收件人姓名'},
        {id: 'recipientPhone', title: '收件人电话'},
        {id: 'storeId', title: '门店ID'},
        {id: 'storeName', title: '门店名称'},
        {id: 'pickupCode', title: '取件码'},
        {id: 'pickupTime', title: '取件时间'},
        {id: 'pickupPerson', title: '取件人'},
        {id: 'pickupPersonPhone', title: '取件人电话'},
        {id: 'pickupPersonRelation', title: '取件人关系'},
        {id: 'applicantName', title: '申诉人'},
        {id: 'applicantPhone', title: '申诉人电话'},
        {id: 'appealTime', title: '申诉时间'},
        {id: 'appealReason', title: '申诉原因'},
        {id: 'status', title: '状态'},
        {id: 'handler', title: '处理人'},
        {id: 'handleTime', title: '处理时间'},
        {id: 'handleRemark', title: '处理备注'}
      ]
    });

    csvWriter.writeRecords(appeals)
      .then(() => {
        res.download(csvWriter.path);
      });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.getStatusList = (req, res) => {
  res.json({
    success: true,
    data: Object.values(STATUS)
  });
};
