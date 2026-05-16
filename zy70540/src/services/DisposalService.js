const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const DISPOSAL_STATUS = {
 PENDING: 'pending',
 IN_PROGRESS: 'in_progress',
 RESOLVED: 'resolved',
 CANCELLED: 'cancelled'
};
const ACTION_TYPES = {
 ALERT: 'alert',
 DEGRADE: 'degrade',
 FUSE: 'fuse',
 ROLLBACK: 'rollback',
 RETRY: 'retry',
 MANUAL: 'manual'
};
class DisposalService {
 static async checkDuplicateAction(interfaceId, actionType, statusList = [DISPOSAL_STATUS.PENDING, DISPOSAL_STATUS.IN_PROGRESS]) {
 return new Promise((resolve, reject) => {
 const placeholders = statusList.map(() => '?').join(',');
 db.get(`SELECT * FROM disposal_actions 
 WHERE interface_id = ? AND action_type = ? AND status IN (${placeholders})
 ORDER BY created_at DESC LIMIT 1`, [interfaceId, actionType, ...statusList], (err, result) => {
 if (err)
 reject(err);
 else
 resolve(result);
 });
 });
 }
 static async createAction(data) {
 return new Promise(async (resolve, reject) => {
 const { interface_id, vendor_id, health_score_id, action_type, action_reason, triggered_by, raw_input, processing_evidence, final_conclusion } = data;
 const duplicate = await this.checkDuplicateAction(interface_id, action_type);
 if (duplicate) {
 return reject(new Error(`相同类型的处置动作已存在: ${action_type}, 当前状态: ${duplicate.status}`));
 }
 const id = uuidv4();
 const now = Date.now();
 const status = DISPOSAL_STATUS.PENDING;
 db.run(`INSERT INTO disposal_actions 
 (id, interface_id, vendor_id, health_score_id, action_type, action_reason, 
 status, triggered_by, raw_input, processing_evidence, final_conclusion, 
 created_at, updated_at)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, interface_id, vendor_id, health_score_id, action_type, action_reason,
 status, triggered_by || 'system', raw_input, processing_evidence, final_conclusion,
 now, now], (err) => {
 if (err)
 return reject(err);
 db.get(`SELECT * FROM disposal_actions WHERE id = ?`, [id], (err, result) => {
 if (err)
 reject(err);
 else
 resolve(result);
 });
 });
 });
 }
 static async advanceStatus(actionId, newStatus, actionResult = null) {
 return new Promise((resolve, reject) => {
 if (!Object.values(DISPOSAL_STATUS).includes(newStatus)) {
 return reject(new Error(`无效的状态: ${newStatus}`));
 }
 db.get(`SELECT * FROM disposal_actions WHERE id = ?`, [actionId], (err, action) => {
 if (err)
 return reject(err);
 if (!action) {
 return reject(new Error('处置动作不存在'));
 }
 if (action.status === DISPOSAL_STATUS.RESOLVED || action.status === DISPOSAL_STATUS.CANCELLED) {
 return reject(new Error(`无法推进已结束的状态: ${action.status}`));
 }
 const now = Date.now();
 db.run(`UPDATE disposal_actions SET status = ?, action_result = ?, updated_at = ?
 WHERE id = ?`, [newStatus, actionResult, now, actionId], (err) => {
 if (err)
 return reject(err);
 db.get(`SELECT * FROM disposal_actions WHERE id = ?`, [actionId], (err, result) => {
 if (err)
 reject(err);
 else
 resolve(result);
 });
 });
 });
 });
 }
 static async getActionsByInterface(interfaceId, status = null) {
 return new Promise((resolve, reject) => {
 let query = `SELECT * FROM disposal_actions WHERE interface_id = ?`;
 let params = [interfaceId];
 if (status) {
 query += ` AND status = ?`;
 params.push(status);
 }
 query += ` ORDER BY created_at DESC`;
 db.all(query, params, (err, results) => {
 if (err)
 reject(err);
 else
 resolve(results);
 });
 });
 }
 static async generateSuggestion(healthScore) {
 const { score, failure_rate, interface_id } = healthScore;
 let actionType = null;
 let reason = '';
 if (score < 30) {
 actionType = ACTION_TYPES.FUSE;
 reason = `健康评分${score.toFixed(1)}分，失败率${(failure_rate * 100).toFixed(1)}%，建议熔断`;
 }
 else if (score < 60) {
 actionType = ACTION_TYPES.DEGRADE;
 reason = `健康评分${score.toFixed(1)}分，失败率${(failure_rate * 100).toFixed(1)}%，建议降级`;
 }
 else if (score < 80) {
 actionType = ACTION_TYPES.ALERT;
 reason = `健康评分${score.toFixed(1)}分，失败率${(failure_rate * 100).toFixed(1)}%，建议告警关注`;
 }
 if (actionType) {
 return {
 interface_id,
 action_type: actionType,
 action_reason: reason,
 processing_evidence: JSON.stringify({ score, failure_rate, threshold: score < 60 ? 60 : 80 }),
 final_conclusion: `建议执行${actionType}`
 };
 }
 return null;
 }
}
module.exports = { DisposalService, DISPOSAL_STATUS, ACTION_TYPES };
