const { v4: uuidv4 } = require('uuid');
const db = require('../database');
class VendorService {
 static async createVendor(data) {
 return new Promise((resolve, reject) => {
 const { name, description, contact_info } = data;
 const id = uuidv4();
 const now = Date.now();
 db.run(`INSERT INTO vendors (id, name, description, contact_info, status, created_at, updated_at)
 VALUES (?, ?, ?, ?, 'active', ?, ?)`, [id, name, description, contact_info, now, now], function (err) {
 if (err) {
 if (err.message.includes('UNIQUE constraint failed')) {
 return reject(new Error(`供应商名称已存在: ${name}`));
 }
 return reject(err);
 }
 db.get(`SELECT * FROM vendors WHERE id = ?`, [id], (err, result) => {
 if (err)
 reject(err);
 else
 resolve(result);
 });
 });
 });
 }
 static async getVendor(id) {
 return new Promise((resolve, reject) => {
 db.get(`SELECT * FROM vendors WHERE id = ?`, [id], (err, result) => {
 if (err)
 reject(err);
 else
 resolve(result);
 });
 });
 }
 static async listVendors() {
 return new Promise((resolve, reject) => {
 db.all(`SELECT * FROM vendors ORDER BY created_at DESC`, (err, results) => {
 if (err)
 reject(err);
 else
 resolve(results);
 });
 });
 }
 static async createInterface(data) {
 return new Promise((resolve, reject) => {
 const { vendor_id, name, endpoint, method, timeout_threshold, failure_threshold } = data;
 const id = uuidv4();
 const now = Date.now();
 db.run(`INSERT INTO interfaces 
 (id, vendor_id, name, endpoint, method, timeout_threshold, failure_threshold, created_at, updated_at)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, vendor_id, name, endpoint, method, timeout_threshold || 5000, failure_threshold || 0.1, now, now], function (err) {
 if (err) {
 if (err.message.includes('UNIQUE constraint failed')) {
 return reject(new Error(`接口名称已存在: ${name}`));
 }
 return reject(err);
 }
 db.get(`SELECT * FROM interfaces WHERE id = ?`, [id], (err, result) => {
 if (err)
 reject(err);
 else
 resolve(result);
 });
 });
 });
 }
 static async getInterface(id) {
 return new Promise((resolve, reject) => {
 db.get(`SELECT * FROM interfaces WHERE id = ?`, [id], (err, result) => {
 if (err)
 reject(err);
 else
 resolve(result);
 });
 });
 }
 static async listInterfaces(vendorId = null) {
 return new Promise((resolve, reject) => {
 let query = `SELECT i.*, v.name as vendor_name FROM interfaces i JOIN vendors v ON i.vendor_id = v.id`;
 let params = [];
 if (vendorId) {
 query += ` WHERE i.vendor_id = ?`;
 params.push(vendorId);
 }
 query += ` ORDER BY i.created_at DESC`;
 db.all(query, params, (err, results) => {
 if (err)
 reject(err);
 else
 resolve(results);
 });
 });
 }
 static async createManualCorrection(data) {
 return new Promise((resolve, reject) => {
 const { interface_id, vendor_id, correction_type, old_value, new_value, reason, operator } = data;
 const id = uuidv4();
 const now = Date.now();
 db.run(`INSERT INTO manual_corrections 
 (id, interface_id, vendor_id, correction_type, old_value, new_value, reason, operator, created_at)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, interface_id, vendor_id, correction_type, old_value, new_value, reason, operator, now], (err) => {
 if (err)
 return reject(err);
 db.get(`SELECT * FROM manual_corrections WHERE id = ?`, [id], (err, result) => {
 if (err)
 reject(err);
 else
 resolve(result);
 });
 });
 });
 }
 static async getManualCorrections(interfaceId = null) {
 return new Promise((resolve, reject) => {
 let query = `SELECT * FROM manual_corrections`;
 let params = [];
 if (interfaceId) {
 query += ` WHERE interface_id = ?`;
 params.push(interfaceId);
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
}
module.exports = VendorService;
