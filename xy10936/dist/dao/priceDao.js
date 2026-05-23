"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllDeductionRatios = exports.getCurrentDeductionRatio = exports.createDeductionRatio = exports.getPriceVersionsByCategory = exports.getCurrentPrice = exports.getLatestVersion = exports.createPriceVersion = void 0;
const db_1 = require("../database/db");
const createPriceVersion = async (price) => {
    const maxVersion = await (0, exports.getLatestVersion)(price.category_id);
    const newVersion = (maxVersion || 0) + 1;
    const sql = `INSERT INTO price_versions (category_id, price, effective_date, version, created_by) VALUES (?, ?, ?, ?, ?)`;
    return (0, db_1.run)(sql, [price.category_id, price.price, price.effective_date, newVersion, price.created_by || null]);
};
exports.createPriceVersion = createPriceVersion;
const getLatestVersion = async (categoryId) => {
    const sql = `SELECT MAX(version) as max_version FROM price_versions WHERE category_id = ?`;
    const result = await (0, db_1.get)(sql, [categoryId]);
    return result?.max_version;
};
exports.getLatestVersion = getLatestVersion;
const getCurrentPrice = async (categoryId, date) => {
    const sql = `SELECT * FROM price_versions WHERE category_id = ? AND effective_date <= ? ORDER BY version DESC LIMIT 1`;
    return (0, db_1.get)(sql, [categoryId, date]);
};
exports.getCurrentPrice = getCurrentPrice;
const getPriceVersionsByCategory = async (categoryId) => {
    const sql = `SELECT * FROM price_versions WHERE category_id = ? ORDER BY version DESC`;
    return (0, db_1.all)(sql, [categoryId]);
};
exports.getPriceVersionsByCategory = getPriceVersionsByCategory;
const createDeductionRatio = async (ratio) => {
    const sql = `INSERT INTO deduction_ratios (category_id, ratio, effective_date, description) VALUES (?, ?, ?, ?)`;
    return (0, db_1.run)(sql, [ratio.category_id, ratio.ratio, ratio.effective_date || new Date().toISOString(), ratio.description || null]);
};
exports.createDeductionRatio = createDeductionRatio;
const getCurrentDeductionRatio = async (categoryId) => {
    const sql = `SELECT * FROM deduction_ratios WHERE category_id = ? ORDER BY effective_date DESC LIMIT 1`;
    return (0, db_1.get)(sql, [categoryId]);
};
exports.getCurrentDeductionRatio = getCurrentDeductionRatio;
const getAllDeductionRatios = async () => {
    const sql = `SELECT * FROM deduction_ratios ORDER BY effective_date DESC`;
    return (0, db_1.all)(sql);
};
exports.getAllDeductionRatios = getAllDeductionRatios;
