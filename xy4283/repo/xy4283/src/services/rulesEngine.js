const models = require('../models');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

/**
 * 规则引擎服务
 * 实现召回匹配、漏通知检测、报废检测等核心业务规则
 */

/**
 * 执行召回匹配
 * 将厂家召回清单与器材台账进行匹配
 * @param {string} recallId - 召回清单ID
 * @returns {Promise<{matched: Array, skipped: Array, errors: Array}>}
 */
async function performRecallMatching(recallId) {
  const matched = [];
  const skipped = [];
  const errors = [];
  
  try {
    // 1. 获取召回清单信息
    const recall = await models.recall.getRecallById(recallId);
    
    if (!recall) {
      errors.push(`召回清单不存在: ${recallId}`);
      return { matched, skipped, errors };
    }
    
    // 2. 解析涉及的批次号
    let affectedBatches = [];
    try {
      affectedBatches = JSON.parse(recall.affected_batches);
      if (!Array.isArray(affectedBatches)) {
        affectedBatches = [affectedBatches];
      }
    } catch (e) {
      // 如果不是JSON格式，尝试用分隔符分割
      affectedBatches = recall.affected_batches
        .split(/[,，;；]/)
        .map(b => b.trim())
        .filter(b => b !== '');
    }
    
    if (affectedBatches.length === 0) {
      errors.push('召回清单中没有指定涉及的批次号');
      return { matched, skipped, errors };
    }
    
    // 3. 获取所有未报废的器材
    const activeEquipment = await models.equipment.getActiveEquipment();
    
    // 4. 匹配每个批次
    for (const batchNumber of affectedBatches) {
      // 查找该批次的器材
      const batchEquipment = activeEquipment.filter(
        eq => eq.batch_number === batchNumber || 
              eq.batch_number.includes(batchNumber) ||
              batchNumber.includes(eq.batch_number)
      );
      
      if (batchEquipment.length === 0) {
        skipped.push({
          batch_number: batchNumber,
          reason: '该批次没有匹配的器材'
        });
        continue;
      }
      
      // 为每个匹配的器材创建召回匹配记录
      for (const equipment of batchEquipment) {
        try {
          // 检查是否已存在匹配记录
          const existingMatch = await models.database.getQuery(
            `SELECT * FROM recall_matches WHERE recall_id = ? AND equipment_id = ?`,
            [recallId, equipment.id]
          );
          
          if (existingMatch) {
            skipped.push({
              equipment_code: equipment.equipment_code,
              batch_number: batchNumber,
              reason: '已存在匹配记录'
            });
            continue;
          }
          
          // 创建新的匹配记录
          const matchData = {
            recall_id: recallId,
            equipment_id: equipment.id,
            batch_number: equipment.batch_number,
            is_notified: 0,
            status: 'pending'
          };
          
          const newMatch = await models.recallMatch.createRecallMatch(matchData);
          
          matched.push({
            match_id: newMatch.id,
            equipment_code: equipment.equipment_code,
            batch_number: equipment.batch_number,
            equipment_type: equipment.equipment_type,
            model: equipment.model,
            location: equipment.location
          });
          
        } catch (error) {
          errors.push({
            equipment_code: equipment.equipment_code,
            batch_number: batchNumber,
            error: error.message
          });
        }
      }
    }
    
    return { matched, skipped, errors };
    
  } catch (error) {
    errors.push(`匹配过程出错: ${error.message}`);
    return { matched, skipped, errors };
  }
}

/**
 * 检测漏通知的器材
 * 检查同一批次中是否有器材未被通知
 * @param {string} recallId - 召回清单ID（可选，不提供则检查所有激活的召回）
 * @returns {Promise<{recalls: Array, total_missed: number}>}
 */
async function detectMissedNotifications(recallId = null) {
  const results = [];
  let totalMissed = 0;
  
  try {
    // 1. 获取需要检查的召回清单
    let recalls = [];
    if (recallId) {
      const recall = await models.recall.getRecallById(recallId);
      if (recall) {
        recalls = [recall];
      }
    } else {
      recalls = await models.recall.getActiveRecalls();
    }
    
    if (recalls.length === 0) {
      return { recalls: [], total_missed: 0 };
    }
    
    // 2. 检查每个召回清单
    for (const recall of recalls) {
      // 解析涉及的批次
      let affectedBatches = [];
      try {
        affectedBatches = JSON.parse(recall.affected_batches);
        if (!Array.isArray(affectedBatches)) {
          affectedBatches = [affectedBatches];
        }
      } catch (e) {
        affectedBatches = recall.affected_batches
          .split(/[,，;；]/)
          .map(b => b.trim())
          .filter(b => b !== '');
      }
      
      // 获取该召回已匹配的记录
      const matchedRecords = await models.recallMatch.getRecallMatchesByRecallId(recall.id);
      const matchedEquipmentIds = matchedRecords.map(m => m.equipment_id);
      
      // 获取该批次的所有器材（包括已通知和未通知的）
      const batchEquipmentPromises = affectedBatches.map(batch => 
        models.equipment.getEquipmentByBatch(batch)
      );
      const batchEquipmentArrays = await Promise.all(batchEquipmentPromises);
      const allBatchEquipment = batchEquipmentArrays.flat();
      
      // 去重
      const uniqueEquipmentMap = new Map();
      for (const eq of allBatchEquipment) {
        uniqueEquipmentMap.set(eq.id, eq);
      }
      const uniqueEquipment = Array.from(uniqueEquipmentMap.values());
      
      // 找出未匹配的器材
      const unmatchedEquipment = uniqueEquipment.filter(
        eq => !matchedEquipmentIds.includes(eq.id)
      );
      
      // 找出已匹配但未通知的器材
      const matchedButNotNotified = matchedRecords.filter(
        m => m.is_notified === 0
      );
      
      const missedCount = unmatchedEquipment.length + matchedButNotNotified.length;
      totalMissed += missedCount;
      
      if (missedCount > 0) {
        results.push({
          recall_id: recall.id,
          recall_code: recall.recall_code,
          manufacturer: recall.manufacturer,
          recall_reason: recall.recall_reason,
          affected_batches: affectedBatches,
          total_batch_equipment: uniqueEquipment.length,
          matched_count: matchedRecords.length,
          matched_and_notified: matchedRecords.filter(m => m.is_notified === 1).length,
          unmatched_count: unmatchedEquipment.length,
          matched_but_not_notified: matchedButNotNotified.length,
          total_missed: missedCount,
          unmatched_equipment: unmatchedEquipment.map(eq => ({
            id: eq.id,
            equipment_code: eq.equipment_code,
            batch_number: eq.batch_number,
            equipment_type: eq.equipment_type,
            model: eq.model,
            location: eq.location,
            is_scrapped: eq.is_scrapped
          })),
          not_notified_equipment: matchedButNotNotified.map(m => ({
            match_id: m.id,
            equipment_code: m.equipment_code,
            batch_number: m.batch_number,
            match_date: m.match_date
          }))
        });
      }
    }
    
    return {
      recalls: results,
      total_missed: totalMissed
    };
    
  } catch (error) {
    throw new Error(`检测漏通知失败: ${error.message}`);
  }
}

/**
 * 检测已报废器材是否被派工
 * 检查是否有已报废的器材被错误地派工
 * @returns {Promise<{total: number, items: Array}>}
 */
async function detectScrappedEquipmentWithWorkOrders() {
  try {
    // 1. 获取所有已报废的器材
    const scrappedEquipment = await models.equipment.getScrappedEquipment();
    
    if (scrappedEquipment.length === 0) {
      return { total: 0, items: [] };
    }
    
    const scrappedIds = scrappedEquipment.map(eq => eq.id);
    
    // 2. 查找这些器材是否有活跃的派工单
    const problematicItems = [];
    
    for (const equipment of scrappedEquipment) {
      // 查找该器材的召回匹配记录
      const matches = await models.recallMatch.getRecallMatchesByEquipmentId(equipment.id);
      
      for (const match of matches) {
        // 查找该匹配的派工单
        const workOrders = await models.workOrder.getWorkOrdersByRecallMatchId(match.id);
        
        // 检查是否有未完成的派工单
        const activeWorkOrders = workOrders.filter(
          wo => wo.status !== 'completed' && wo.status !== 'cancelled'
        );
        
        if (activeWorkOrders.length > 0) {
          problematicItems.push({
            equipment: {
              id: equipment.id,
              equipment_code: equipment.equipment_code,
              batch_number: equipment.batch_number,
              equipment_type: equipment.equipment_type,
              model: equipment.model,
              scrapped_date: equipment.scrapped_date
            },
            recall_match: {
              id: match.id,
              recall_id: match.recall_id,
              status: match.status,
              is_notified: match.is_notified
            },
            active_work_orders: activeWorkOrders.map(wo => ({
              id: wo.id,
              order_code: wo.order_code,
              status: wo.status,
              assigned_to: wo.assigned_to,
              deadline_date: wo.deadline_date
            }))
          });
        }
      }
    }
    
    return {
      total: problematicItems.length,
      items: problematicItems
    };
    
  } catch (error) {
    throw new Error(`检测报废器材派工失败: ${error.message}`);
  }
}

/**
 * 检查器材是否在召回批次中
 * @param {string} equipmentCode - 器材编号
 * @returns {Promise<{in_recall: boolean, recalls: Array}>}
 */
async function checkEquipmentInRecall(equipmentCode) {
  try {
    // 1. 获取器材信息
    const equipment = await models.equipment.getEquipmentByCode(equipmentCode);
    
    if (!equipment) {
      return {
        in_recall: false,
        recalls: [],
        error: '器材不存在'
      };
    }
    
    // 2. 获取所有激活的召回清单
    const activeRecalls = await models.recall.getActiveRecalls();
    
    const matchedRecalls = [];
    
    // 3. 检查每个召回清单是否包含该器材的批次
    for (const recall of activeRecalls) {
      let affectedBatches = [];
      try {
        affectedBatches = JSON.parse(recall.affected_batches);
        if (!Array.isArray(affectedBatches)) {
          affectedBatches = [affectedBatches];
        }
      } catch (e) {
        affectedBatches = recall.affected_batches
          .split(/[,，;；]/)
          .map(b => b.trim())
          .filter(b => b !== '');
      }
      
      // 检查批次是否匹配
      const isInBatch = affectedBatches.some(batch => 
        equipment.batch_number === batch ||
        equipment.batch_number.includes(batch) ||
        batch.includes(equipment.batch_number)
      );
      
      if (isInBatch) {
        // 检查是否已创建匹配记录
        const existingMatch = await models.database.getQuery(
          `SELECT * FROM recall_matches WHERE recall_id = ? AND equipment_id = ?`,
          [recall.id, equipment.id]
        );
        
        matchedRecalls.push({
          recall_id: recall.id,
          recall_code: recall.recall_code,
          manufacturer: recall.manufacturer,
          recall_reason: recall.recall_reason,
          recall_date: recall.recall_date,
          deadline_date: recall.deadline_date,
          matched: !!existingMatch,
          match_status: existingMatch?.status || null,
          is_notified: existingMatch?.is_notified || 0
        });
      }
    }
    
    return {
      in_recall: matchedRecalls.length > 0,
      recalls: matchedRecalls,
      equipment: {
        id: equipment.id,
        equipment_code: equipment.equipment_code,
        batch_number: equipment.batch_number,
        equipment_type: equipment.equipment_type,
        model: equipment.model,
        is_scrapped: equipment.is_scrapped
      }
    };
    
  } catch (error) {
    throw new Error(`检查器材召回状态失败: ${error.message}`);
  }
}

/**
 * 执行所有规则检查
 * @returns {Promise<Object>} 所有规则检查的结果
 */
async function runAllRules() {
  try {
    const [
      missedNotifications,
      scrappedWithWorkOrders
    ] = await Promise.all([
      detectMissedNotifications(),
      detectScrappedEquipmentWithWorkOrders()
    ]);
    
    return {
      timestamp: new Date().toISOString(),
      missed_notifications: missedNotifications,
      scrapped_equipment_with_work_orders: scrappedWithWorkOrders,
      summary: {
        total_missed_notifications: missedNotifications.total_missed,
        total_scrapped_with_work_orders: scrappedWithWorkOrders.total,
        risk_level: calculateRiskLevel(
          missedNotifications.total_missed,
          scrappedWithWorkOrders.total
        )
      }
    };
    
  } catch (error) {
    throw new Error(`执行规则检查失败: ${error.message}`);
  }
}

/**
 * 计算风险等级
 * @param {number} missedCount - 漏通知数量
 * @param {number} scrappedCount - 报废器材派工数量
 * @returns {string} 风险等级 (low/medium/high/critical)
 */
function calculateRiskLevel(missedCount, scrappedCount) {
  const totalRisk = missedCount * 2 + scrappedCount * 5;
  
  if (totalRisk === 0) return 'low';
  if (totalRisk <= 5) return 'medium';
  if (totalRisk <= 15) return 'high';
  return 'critical';
}

module.exports = {
  performRecallMatching,
  detectMissedNotifications,
  detectScrappedEquipmentWithWorkOrders,
  checkEquipmentInRecall,
  runAllRules,
  calculateRiskLevel
};
