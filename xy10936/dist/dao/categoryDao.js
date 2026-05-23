"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllCategories = exports.getCategoryByCode = exports.getCategoryById = exports.createCategory = void 0;
const db_1 = require("../database/db");
const createCategory = async (category) => {
    const sql = `INSERT INTO categories (name, code, description) VALUES (?, ?, ?)`;
    return (0, db_1.run)(sql, [category.name, category.code, category.description || null]);
};
exports.createCategory = createCategory;
const getCategoryById = async (id) => {
    const sql = `SELECT * FROM categories WHERE id = ?`;
    return (0, db_1.get)(sql, [id]);
};
exports.getCategoryById = getCategoryById;
const getCategoryByCode = async (code) => {
    const sql = `SELECT * FROM categories WHERE code = ?`;
    return (0, db_1.get)(sql, [code]);
};
exports.getCategoryByCode = getCategoryByCode;
const getAllCategories = async () => {
    const sql = `SELECT * FROM categories ORDER BY name`;
    return (0, db_1.all)(sql);
};
exports.getAllCategories = getAllCategories;
