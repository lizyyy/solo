const { v4: uuidv4 } = require('uuid');
const db = require('../database');
class HealthScoreService {
 static calculateScore(failureRate, timeoutRate = 0) {
 const baseScore = 100;
 const failurePenalty = failureRate * 80;
 const timeoutPenalty = timeoutRate * 40;
 let score = baseScore - failurePenalty - timeoutPenalty;
 return Math.max(0, Math.min(100, score));
 }
 static async generateScore(interfaceId, periodHours = 1) {
 return new Promise((resolve, reject) => {
 const now = Date.now();
 const periodStart = now - periodHours * 60 * 60 * 1000;
 db.get('SELECT vendor_id FROM interfaces WHERE id = ?', [interfaceId], (err, iface) => {
 if (err)
 return reject(err);
 if (!iface)
 return reject(new Error('Interface not found'));
 db.get(`SELECT 
 COUNT(*) as total_requests,
 SUM(CASE WHEN error_type != 'success' THEN 1 ELSE 0 END) as failure_count,
 SUM(CASE WHEN error_type = 'timeout' THEN 1 ELSE 0 END) as timeout_count
 FROM failure_records 
 WHERE interface_id = ? AND request_time >= ?`, [interfaceId, periodStart], (err, stats) => {
 if (err)
 return reject(err);
 const totalRequests = stats.total_requests || 0;
 const failureCount = stats.failure_count || 0;
 const timeoutCount = stats.timeout_count || 0;
 const failureRate = totalRequests > 0 ? failureCount / totalRequests : 0;
 const timeoutRate = totalRequests > 0 ? timeoutCount / totalRequests : 0;
 const score = this.calculateScore(failureRate, timeoutRate);
 const scoreId = uuidv4();
 db.run(`INSERT INTO health_scores 
 (id, interface_id, vendor_id, score, failure_rate, total_requests, 
 failure_count, timeout_count, period_start, period_end, created_at)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [scoreId, interfaceId, iface.vendor_id, score, failureRate, totalRequests,
 failureCount, timeoutCount, periodStart, now, now], (err) => {
 if (err)
 return reject(err);
 db.get(`SELECT * FROM health_scores WHERE id = ?`, [scoreId], (err, result) => {
 if (err)
 return reject(err);
 resolve(result);
 });
 });
 });
 });
 });
 }
 static async getLatestScore(interfaceId) {
 return new Promise((resolve, reject) => {
 db.get(`SELECT * FROM health_scores 
 WHERE interface_id = ? 
 ORDER BY created_at DESC LIMIT 1`, [interfaceId], (err, result) => {
 if (err)
 reject(err);
 else
 resolve(result);
 });
 });
 }
 static async getVendorAggregatedScore(vendorId) {
 return new Promise((resolve, reject) => {
 db.all(`SELECT 
 i.id as interface_id,
 i.name as interface_name,
 hs.score,
 hs.failure_rate,
 hs.total_requests,
 hs.failure_count
 FROM interfaces i
 LEFT JOIN health_scores hs ON hs.interface_id = i.id 
 AND hs.created_at = (
 SELECT MAX(created_at) FROM health_scores hs2 
 WHERE hs2.interface_id = i.id
 )
 WHERE i.vendor_id = ?`, [vendorId], (err, interfaceScores) => {
 if (err)
 return reject(err);
 const withScore = interfaceScores.filter(item => item.score !== null);
 if (withScore.length === 0) {
 resolve({ vendor_id: vendorId, aggregated_score: 100, interfaces: interfaceScores });
 return;
 }
 const aggregatedScore = withScore.reduce((sum, item) => sum + item.score, 0) / withScore.length;
 resolve({
 vendor_id: vendorId,
 aggregated_score: Math.round(aggregatedScore * 100) / 100,
 interfaces: interfaceScores
 });
 });
 });
 }
}
module.exports = HealthScoreService;
