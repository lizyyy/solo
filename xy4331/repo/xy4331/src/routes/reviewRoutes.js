const express = require('express');
const router = express.Router();
const ValidationViolation = require('../models/ValidationViolation');
const SensorAlert = require('../models/SensorAlert');
const TransferRecord = require('../models/TransferRecord');
const VeterinaryOrder = require('../models/VeterinaryOrder');
const Animal = require('../models/Animal');
const { v4: uuidv4 } = require('uuid');
const { runAsync, allAsync } = require('../config/database');

router.post('/violations/:violationId/review', async (req, res) => {
  try {
    const { violationId } = req.params;
    const { decision, comments, action_items, reviewer } = req.body;

    if (!decision) {
      return res.status(400).json({ 
        success: false, 
        error: '请提供复核决定 (decision)' 
      });
    }

    const validDecisions = ['resolve', 'dismiss', 'review'];
    if (!validDecisions.includes(decision)) {
      return res.status(400).json({ 
        success: false, 
        error: `无效的决定类型，必须是: ${validDecisions.join(', ')}` 
      });
    }

    const violation = await ValidationViolation.findById(violationId);
    
    if (!violation) {
      return res.status(404).json({ 
        success: false, 
        error: '违规记录不存在' 
      });
    }

    const decisionId = await ValidationViolation.addReviewDecision(violationId, {
      reviewer: reviewer || req.user?.username || 'anonymous',
      decision: decision,
      comments: comments,
      action_items: action_items
    });

    const updatedViolation = await ValidationViolation.findById(violationId);

    res.json({
      success: true,
      data: {
        violation: updatedViolation,
        decision_id: decisionId
      },
      message: decision === 'resolve' 
        ? '违规已标记为已解决' 
        : decision === 'dismiss'
          ? '违规已驳回（判定为误报）'
          : '违规需要进一步调查'
    });

  } catch (error) {
    console.error('复核违规记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/violations/batch-review', async (req, res) => {
  try {
    const { violation_ids, decision, comments, reviewer } = req.body;

    if (!violation_ids || !Array.isArray(violation_ids)) {
      return res.status(400).json({ 
        success: false, 
        error: '请提供违规ID数组 (violation_ids)' 
      });
    }

    if (!decision) {
      return res.status(400).json({ 
        success: false, 
        error: '请提供复核决定 (decision)' 
      });
    }

    const validDecisions = ['resolve', 'dismiss', 'review'];
    if (!validDecisions.includes(decision)) {
      return res.status(400).json({ 
        success: false, 
        error: `无效的决定类型，必须是: ${validDecisions.join(', ')}` 
      });
    }

    const results = {
      success: [],
      failed: []
    };

    for (const violationId of violation_ids) {
      try {
        const violation = await ValidationViolation.findById(violationId);
        
        if (!violation) {
          results.failed.push({
            id: violationId,
            error: '违规记录不存在'
          });
          continue;
        }

        await ValidationViolation.addReviewDecision(violationId, {
          reviewer: reviewer || req.user?.username || 'anonymous',
          decision: decision,
          comments: comments
        });

        results.success.push(violationId);
      } catch (error) {
        results.failed.push({
          id: violationId,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      results: {
        total: violation_ids.length,
        success_count: results.success.length,
        failed_count: results.failed.length,
        success_ids: results.success,
        failed: results.failed
      },
      message: `批量复核完成: ${results.success.length} 成功, ${results.failed.length} 失败`
    });

  } catch (error) {
    console.error('批量复核失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/alerts/:alertId/acknowledge', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { acknowledged_by } = req.body;

    const alert = await SensorAlert.findByAlertId(alertId);
    
    if (!alert) {
      return res.status(404).json({ 
        success: false, 
        error: '告警不存在' 
      });
    }

    if (alert.status === 'resolved') {
      return res.status(400).json({ 
        success: false, 
        error: '该告警已被解决' 
      });
    }

    await SensorAlert.acknowledge(alertId, acknowledged_by || req.user?.username || 'anonymous');

    const updatedAlert = await SensorAlert.findByAlertId(alertId);

    res.json({
      success: true,
      data: updatedAlert,
      message: '告警已确认'
    });

  } catch (error) {
    console.error('确认告警失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/alerts/:alertId/resolve', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { resolution_notes, resolved_by } = req.body;

    if (!resolution_notes) {
      return res.status(400).json({ 
        success: false, 
        error: '请提供解决说明 (resolution_notes)' 
      });
    }

    const alert = await SensorAlert.findByAlertId(alertId);
    
    if (!alert) {
      return res.status(404).json({ 
        success: false, 
        error: '告警不存在' 
      });
    }

    await SensorAlert.resolve(
      alertId, 
      resolution_notes, 
      resolved_by || req.user?.username || 'anonymous'
    );

    const updatedAlert = await SensorAlert.findByAlertId(alertId);

    res.json({
      success: true,
      data: updatedAlert,
      message: '告警已解决'
    });

  } catch (error) {
    console.error('解决告警失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/transfers/:transferId/execute', async (req, res) => {
  try {
    const { transferId } = req.params;
    const { verified_by } = req.body;

    const transfer = await TransferRecord.findByTransferId(transferId);
    
    if (!transfer) {
      return res.status(404).json({ 
        success: false, 
        error: '转笼记录不存在' 
      });
    }

    if (transfer.status === 'completed') {
      return res.status(400).json({ 
        success: false, 
        error: '该转笼记录已执行' 
      });
    }

    const executedTransfer = await TransferRecord.executeTransfer(
      transferId, 
      verified_by || req.user?.username || 'anonymous'
    );

    res.json({
      success: true,
      data: executedTransfer,
      message: '转笼已执行，笼位占用已更新'
    });

  } catch (error) {
    console.error('执行转笼失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/veterinary-orders/:orderId/sign', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { veterinarian_signature, signature_date } = req.body;

    if (!veterinarian_signature) {
      return res.status(400).json({ 
        success: false, 
        error: '请提供兽医签名 (veterinarian_signature)' 
      });
    }

    const order = await VeterinaryOrder.findByOrderId(orderId);
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        error: '处置单不存在' 
      });
    }

    if (order.veterinarian_signature) {
      return res.status(400).json({ 
        success: false, 
        error: '该处置单已签署' 
      });
    }

    const signedOrder = await VeterinaryOrder.signOrder(
      orderId, 
      veterinarian_signature, 
      signature_date
    );

    res.json({
      success: true,
      data: signedOrder,
      message: '处置单已签署'
    });

  } catch (error) {
    console.error('签署处置单失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/veterinary-orders/:orderId/start-observation', async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await VeterinaryOrder.findByOrderId(orderId);
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        error: '处置单不存在' 
      });
    }

    if (!order.veterinarian_signature) {
      return res.status(400).json({ 
        success: false, 
        error: '处置单尚未签署，无法开始观察期' 
      });
    }

    if (order.status === 'observing') {
      return res.status(400).json({ 
        success: false, 
        error: '该处置单已在观察期中' 
      });
    }

    const updatedOrder = await VeterinaryOrder.startObservation(orderId);

    res.json({
      success: true,
      data: updatedOrder,
      message: `开始 ${order.observation_period_days} 天观察期`
    });

  } catch (error) {
    console.error('开始观察期失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/veterinary-orders/:orderId/complete-observation', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { outcome_notes, completed_by } = req.body;

    if (!outcome_notes) {
      return res.status(400).json({ 
        success: false, 
        error: '请提供观察结果 (outcome_notes)' 
      });
    }

    const order = await VeterinaryOrder.findByOrderId(orderId);
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        error: '处置单不存在' 
      });
    }

    if (order.status !== 'observing') {
      return res.status(400).json({ 
        success: false, 
        error: '该处置单不在观察期中' 
      });
    }

    const updatedOrder = await VeterinaryOrder.completeObservation(
      orderId, 
      outcome_notes,
      completed_by || req.user?.username || 'anonymous'
    );

    res.json({
      success: true,
      data: updatedOrder,
      message: '观察期已完成'
    });

  } catch (error) {
    console.error('完成观察期失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/animals/:animalId/merge-timeline', async (req, res) => {
  try {
    const { animalId } = req.params;
    const { event_type, event_id, event_time, description, metadata } = req.body;

    if (!event_type || !event_time) {
      return res.status(400).json({ 
        success: false, 
        error: '请提供事件类型 (event_type) 和事件时间 (event_time)' 
      });
    }

    const animal = await Animal.findByAnimalId(animalId);
    
    if (!animal) {
      return res.status(404).json({ 
        success: false, 
        error: '动物不存在' 
      });
    }

    const event = await Animal.addTimelineEvent(animalId, {
      event_type,
      event_id,
      event_time,
      description,
      metadata
    });

    res.json({
      success: true,
      data: event,
      message: '事件已添加到动物时间线'
    });

  } catch (error) {
    console.error('合并时间线失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/resolve-transfer-duplicate', async (req, res) => {
  try {
    const { animal_id, keep_transfer_id, remove_transfer_ids, reason } = req.body;

    if (!animal_id || !keep_transfer_id || !remove_transfer_ids) {
      return res.status(400).json({ 
        success: false, 
        error: '请提供 animal_id, keep_transfer_id 和 remove_transfer_ids' 
      });
    }

    const keepTransfer = await TransferRecord.findByTransferId(keep_transfer_id);
    
    if (!keepTransfer) {
      return res.status(404).json({ 
        success: false, 
        error: '要保留的转笼记录不存在' 
      });
    }

    if (keepTransfer.animal_id !== animal_id) {
      return res.status(400).json({ 
        success: false, 
        error: '要保留的转笼记录不属于指定动物' 
      });
    }

    const results = {
      kept: keep_transfer_id,
      removed: [],
      failed: []
    };

    for (const transferId of remove_transfer_ids) {
      try {
        const transfer = await TransferRecord.findByTransferId(transferId);
        
        if (!transfer) {
          results.failed.push({
            id: transferId,
            error: '转笼记录不存在'
          });
          continue;
        }

        if (transfer.animal_id !== animal_id) {
          results.failed.push({
            id: transferId,
            error: '转笼记录不属于指定动物'
          });
          continue;
        }

        await TransferRecord.update(transferId, {
          status: 'cancelled',
          notes: transfer.notes 
            ? `${transfer.notes}\n重复转笼，已取消。原因: ${reason || '人工判断重复'}`
            : `重复转笼，已取消。原因: ${reason || '人工判断重复'}`
        });

        results.removed.push(transferId);
      } catch (error) {
        results.failed.push({
          id: transferId,
          error: error.message
        });
      }
    }

    await Animal.addTimelineEvent(animal_id, {
      event_type: 'transfer_resolution',
      event_time: new Date().toISOString(),
      description: `解决重复转笼冲突，保留 ${keep_transfer_id}，取消 ${results.removed.length} 条重复记录`,
      metadata: {
        keep_transfer_id,
        removed_transfer_ids: results.removed,
        reason: reason || '人工判断重复'
      }
    });

    res.json({
      success: true,
      results: {
        kept: keep_transfer_id,
        removed_count: results.removed.length,
        failed_count: results.failed.length,
        removed: results.removed,
        failed: results.failed
      },
      message: `重复转笼冲突已解决: 保留 ${keep_transfer_id}，取消 ${results.removed.length} 条记录`
    });

  } catch (error) {
    console.error('解决重复转笼失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
