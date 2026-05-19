const callModel = require('../models/callModel');
const inspectionModel = require('../models/inspectionModel');
const inspectionService = require('../services/inspectionService');
const userModel = require('../models/userModel');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

async function importCalls(req, res) {
  const { calls } = req.body;
  
  if (!Array.isArray(calls) || calls.length === 0) {
    return res.status(400).json({ error: '请提供有效的通话记录数组' });
  }

  const successIds = [];
  const failedIds = [];
  const errorDetails = {};

  for (let i = 0; i < calls.length; i++) {
    const callData = calls[i];
    
    try {
      if (!callData.call_id || !callData.transcript || !callData.call_time) {
        throw new Error('缺少必填字段: call_id, transcript, call_time');
      }

      const existingCall = await callModel.getCallByCallId(callData.call_id);
      if (existingCall) {
        throw new Error(`call_id ${callData.call_id} 已存在`);
      }

      let agentId = callData.agent_id;
      if (callData.agent_name && !agentId) {
        let agent = await userModel.getUserByName(callData.agent_name);
        if (!agent) {
          agent = await userModel.createUser({ name: callData.agent_name, role: 'agent' });
        }
        agentId = agent.id;
      }

      const call = await callModel.createCall({
        ...callData,
        agent_id: agentId
      });

      const inspection = inspectionService.inspectTranscript(callData.transcript);
      await inspectionModel.createInspectionResult({
        call_id: call.id,
        has_apology: inspection.hasApology,
        has_refund_promise: inspection.hasRefundPromise,
        has_sensitive_word: inspection.hasSensitiveWord,
        sensitive_words: inspection.sensitiveWords,
        summary: inspection.summary,
        anomaly_types: inspection.anomalyTypes
      });

      successIds.push(callData.call_id);
    } catch (error) {
      failedIds.push(callData.call_id || `index_${i}`);
      errorDetails[callData.call_id || `index_${i}`] = error.message;
    }
  }

  const batchOperation = await inspectionModel.createBatchOperation({
    operation_type: 'import',
    total_count: calls.length,
    success_count: successIds.length,
    failed_count: failedIds.length,
    success_ids: successIds,
    failed_ids: failedIds,
    error_details: errorDetails
  });

  res.json({
    batch_id: batchOperation.id,
    total: calls.length,
    success: successIds.length,
    failed: failedIds.length,
    success_ids: successIds,
    failed_ids: failedIds,
    error_details: errorDetails
  });
}

async function getCalls(req, res) {
  try {
    const filters = {
      agent_id: req.query.agent_id,
      start_time: req.query.start_time,
      end_time: req.query.end_time,
      status: req.query.status,
      review_status: req.query.review_status,
      anomaly_type: req.query.anomaly_type,
      limit: parseInt(req.query.limit) || 100,
      offset: parseInt(req.query.offset) || 0
    };

    const calls = await callModel.getCalls(filters);
    
    const formattedCalls = calls.map(call => ({
      ...call,
      sensitive_words: call.sensitive_words ? JSON.parse(call.sensitive_words) : [],
      anomaly_types: call.anomaly_types ? JSON.parse(call.anomaly_types) : []
    }));

    res.json({
      total: formattedCalls.length,
      data: formattedCalls
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getCallDetail(req, res) {
  try {
    const { id } = req.params;
    const call = await callModel.getCallById(id);
    
    if (!call) {
      return res.status(404).json({ error: '通话记录不存在' });
    }

    const inspection = await inspectionModel.getInspectionByCallId(id);
    
    res.json({
      call,
      inspection: inspection ? {
        ...inspection,
        sensitive_words: JSON.parse(inspection.sensitive_words || '[]'),
        anomaly_types: JSON.parse(inspection.anomaly_types || '[]')
      } : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function reviewCall(req, res) {
  try {
    const { id } = req.params;
    const { reviewed_by, review_status } = req.body;

    if (!review_status || !['approved', 'rejected', 'corrected'].includes(review_status)) {
      return res.status(400).json({ error: 'review_status 必须是 approved, rejected, 或 corrected' });
    }

    const call = await callModel.getCallById(id);
    if (!call) {
      return res.status(404).json({ error: '通话记录不存在' });
    }

    await inspectionModel.updateReview(id, { reviewed_by, review_status });

    res.json({ message: '复核完成', call_id: id, review_status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function batchReview(req, res) {
  const { call_ids, reviewed_by, review_status } = req.body;
  
  if (!Array.isArray(call_ids) || call_ids.length === 0) {
    return res.status(400).json({ error: '请提供有效的 call_ids 数组' });
  }

  if (!review_status || !['approved', 'rejected', 'corrected'].includes(review_status)) {
    return res.status(400).json({ error: 'review_status 必须是 approved, rejected, 或 corrected' });
  }

  const successIds = [];
  const failedIds = [];
  const errorDetails = {};

  for (const callId of call_ids) {
    try {
      const call = await callModel.getCallById(callId);
      if (!call) {
        throw new Error('通话记录不存在');
      }

      await inspectionModel.updateReview(callId, { reviewed_by, review_status });
      successIds.push(callId);
    } catch (error) {
      failedIds.push(callId);
      errorDetails[callId] = error.message;
    }
  }

  const batchOperation = await inspectionModel.createBatchOperation({
    operation_type: 'review',
    total_count: call_ids.length,
    success_count: successIds.length,
    failed_count: failedIds.length,
    success_ids: successIds,
    failed_ids: failedIds,
    error_details: errorDetails
  });

  res.json({
    batch_id: batchOperation.id,
    total: call_ids.length,
    success: successIds.length,
    failed: failedIds.length,
    success_ids: successIds,
    failed_ids: failedIds,
    error_details: errorDetails
  });
}

async function exportCalls(req, res) {
  try {
    const filters = {
      agent_id: req.query.agent_id,
      start_time: req.query.start_time,
      end_time: req.query.end_time,
      status: req.query.status,
      review_status: req.query.review_status,
      anomaly_type: req.query.anomaly_type
    };

    const calls = await callModel.getCalls(filters);
    
    const exportPath = '/tmp/qa_inspection_export.csv';
    const csvWriter = createCsvWriter({
      path: exportPath,
      header: [
        { id: 'call_id', title: '通话ID' },
        { id: 'agent_name', title: '负责人' },
        { id: 'call_time', title: '通话时间' },
        { id: 'duration', title: '通话时长(秒)' },
        { id: 'has_apology', title: '是否有道歉' },
        { id: 'has_refund_promise', title: '是否有退款承诺' },
        { id: 'has_sensitive_word', title: '是否有敏感词' },
        { id: 'summary', title: '摘要' },
        { id: 'review_status', title: '复核状态' },
        { id: 'anomaly_types', title: '异常类型' }
      ]
    });

    const records = calls.map(call => ({
      call_id: call.call_id,
      agent_name: call.agent_name || '',
      call_time: call.call_time,
      duration: call.duration || '',
      has_apology: call.has_apology ? '是' : '否',
      has_refund_promise: call.has_refund_promise ? '是' : '否',
      has_sensitive_word: call.has_sensitive_word ? '是' : '否',
      summary: call.summary || '',
      review_status: call.review_status || 'pending',
      anomaly_types: call.anomaly_types ? JSON.parse(call.anomaly_types).join(', ') : ''
    }));

    await csvWriter.writeRecords(records);

    res.download(exportPath, 'qa_inspection_export.csv', (err) => {
      if (err) {
        res.status(500).json({ error: '导出失败' });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getBatchOperation(req, res) {
  try {
    const { id } = req.params;
    const operation = await inspectionModel.getBatchOperationById(id);
    
    if (!operation) {
      return res.status(404).json({ error: '批量操作记录不存在' });
    }

    res.json(operation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  importCalls,
  getCalls,
  getCallDetail,
  reviewCall,
  batchReview,
  exportCalls,
  getBatchOperation
};
