const db = require('../database');
class ExportService {
 static async exportHealthSummary(vendorId = null) {
 return new Promise((resolve, reject) => {
 let vendorWhere = '';
 let params = [];
 if (vendorId) {
 vendorWhere = 'AND i.vendor_id = ?';
 params.push(vendorId);
 }
 const query = `SELECT 
 v.id as vendor_id,
 v.name as vendor_name,
 i.id as interface_id,
 i.name as interface_name,
 hs.score,
 hs.failure_rate,
 hs.total_requests,
 hs.failure_count,
 hs.timeout_count,
 datetime(hs.period_start/1000, 'unixepoch', 'localtime') as period_start,
 datetime(hs.period_end/1000, 'unixepoch', 'localtime') as period_end,
 datetime(hs.created_at/1000, 'unixepoch', 'localtime') as calculated_at
 FROM interfaces i
 JOIN vendors v ON i.vendor_id = v.id
 LEFT JOIN health_scores hs ON hs.interface_id = i.id
 AND hs.created_at = (
 SELECT MAX(created_at) FROM health_scores hs2 
 WHERE hs2.interface_id = i.id
 )
 WHERE 1=1 ${vendorWhere}
 ORDER BY v.name, hs.score ASC`;
 db.all(query, params, async (err, scores) => {
 if (err)
 return reject(err);
 for (const item of scores) {
 item.exceptions = await this.getExceptionExplanation(item.interface_id);
 }
 resolve({
 generated_at: new Date().toISOString(),
 total_interfaces: scores.length,
 summary: scores
 });
 });
 });
 }
 static async getExceptionExplanation(interfaceId) {
 return new Promise((resolve, reject) => {
 const oneHourAgo = Date.now() - 60 * 60 * 1000;
 db.all(`SELECT 
 error_type,
 error_message,
 COUNT(*) as count,
 datetime(MIN(request_time)/1000, 'unixepoch', 'localtime') as first_seen,
 datetime(MAX(request_time)/1000, 'unixepoch', 'localtime') as last_seen,
 raw_input,
 processing_evidence,
 final_conclusion
 FROM failure_records 
 WHERE interface_id = ? AND request_time >= ?
 GROUP BY error_type, error_message
 ORDER BY count DESC`, [interfaceId, oneHourAgo], (err, results) => {
 if (err)
 reject(err);
 else
 resolve(results.map(r => ({
 error_type: r.error_type,
 error_message: r.error_message,
 occurrence_count: r.count,
 first_seen: r.first_seen,
 last_seen: r.last_seen,
 explanation: `${r.error_type}: ${r.error_message || '未提供错误信息'}，共发生${r.count}次，时间范围: ${r.first_seen} ~ ${r.last_seen}`,
 raw_input: r.raw_input,
 processing_evidence: r.processing_evidence,
 final_conclusion: r.final_conclusion
 })));
 });
 });
 }
 static async exportVendorDetail(vendorId) {
 return new Promise(async (resolve, reject) => {
 try {
 const vendor = await new Promise((res, rej) => {
 db.get(`SELECT * FROM vendors WHERE id = ?`, [vendorId], (err, result) => {
 if (err)
 rej(err);
 else
 res(result);
 });
 });
 const interfaces = await new Promise((res, rej) => {
 db.all(`SELECT * FROM interfaces WHERE vendor_id = ?`, [vendorId], (err, result) => {
 if (err)
 rej(err);
 else
 res(result);
 });
 });
 const healthSummary = await this.exportHealthSummary(vendorId);
 const actions = await new Promise((res, rej) => {
 db.all(`SELECT * FROM disposal_actions 
 WHERE vendor_id = ? 
 ORDER BY created_at DESC LIMIT 100`, [vendorId], (err, result) => {
 if (err)
 rej(err);
 else
 res(result);
 });
 });
 const recentFailures = await new Promise((res, rej) => {
 db.all(`SELECT * FROM failure_records 
 WHERE vendor_id = ? 
 ORDER BY request_time DESC LIMIT 100`, [vendorId], (err, result) => {
 if (err)
 rej(err);
 else
 res(result);
 });
 });
 resolve({
 vendor,
 interfaces,
 health_summary: healthSummary,
 recent_disposal_actions: actions,
 recent_failures: recentFailures,
 exported_at: new Date().toISOString()
 });
 }
 catch (err) {
 reject(err);
 }
 });
 }
}
module.exports = ExportService;
