const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const HealthScoreService = require('./HealthScoreService');
class FailureService {
 static async recordFailure(data) {
 return new Promise((resolve, reject) => {
 const { interface_id, vendor_id, error_type, error_message, raw_input, processing_evidence, final_conclusion, request_time, duration, is_sample } = data;
 const id = uuidv4();
 const now = Date.now();
 const reqTime = request_time || now;
 const isSample = is_sample ? 1 : 0;
 db.run(`INSERT INTO failure_records 
 (id, interface_id, vendor_id, error_type, error_message, raw_input, 
 processing_evidence, final_conclusion, request_time, duration, is_sample, created_at)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, interface_id, vendor_id, error_type, error_message, raw_input,
 processing_evidence, final_conclusion, reqTime, duration, isSample, now], async (err) => {
 if (err)
 return reject(err);
 try {
 await HealthScoreService.generateScore(interface_id);
 }
 catch (scoreErr) {
 console.warn('生成健康评分失败:', scoreErr.message);
 }
 db.get(`SELECT * FROM failure_records WHERE id = ?`, [id], (err, result) => {
 if (err)
 reject(err);
 else
 resolve(result);
 });
 });
 });
 }
 static async aggregateFailures(interfaceId, startTime, endTime) {
 return new Promise((resolve, reject) => {
 db.all(`SELECT 
 error_type,
 COUNT(*) as count,
 MIN(request_time) as first_occurrence,
 MAX(request_time) as last_occurrence
 FROM failure_records 
 WHERE interface_id = ? AND request_time >= ? AND request_time <= ?
 GROUP BY error_type
 ORDER BY count DESC`, [interfaceId, startTime, endTime], (err, results) => {
 if (err)
 reject(err);
 else
 resolve(results);
 });
 });
 }
 static async getTimeoutSamples(interfaceId, limit = 10) {
 return new Promise((resolve, reject) => {
 db.all(`SELECT * FROM failure_records 
 WHERE interface_id = ? AND error_type = 'timeout' AND is_sample = 1
 ORDER BY request_time DESC LIMIT ?`, [interfaceId, limit], (err, results) => {
 if (err)
 reject(err);
 else
 resolve(results);
 });
 });
 }
 static async getFailureHistory(interfaceId, limit = 50) {
 return new Promise((resolve, reject) => {
 db.all(`SELECT * FROM failure_records 
 WHERE interface_id = ?
 ORDER BY request_time DESC LIMIT ?`, [interfaceId, limit], (err, results) => {
 if (err)
 reject(err);
 else
 resolve(results);
 });
 });
 }
 static async archiveOldSamples(beforeDays = 7) {
 return new Promise((resolve, reject) => {
 const cutoffTime = Date.now() - beforeDays * 24 * 60 * 60 * 1000;
 db.run(`UPDATE failure_records SET is_sample = 0 
 WHERE is_sample = 1 AND request_time < ?`, [cutoffTime], function (err) {
 if (err)
 reject(err);
 else
 resolve({ archived_count: this.changes });
 });
 });
 }
}
module.exports = FailureService;
