"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCustomer = exports.getAllCustomers = exports.getCustomerById = exports.createCustomer = void 0;
const db_1 = require("../database/db");
const createCustomer = async (customer) => {
    const sql = `INSERT INTO customers (name, phone, address) VALUES (?, ?, ?)`;
    return (0, db_1.run)(sql, [customer.name, customer.phone || null, customer.address || null]);
};
exports.createCustomer = createCustomer;
const getCustomerById = async (id) => {
    const sql = `SELECT * FROM customers WHERE id = ?`;
    return (0, db_1.get)(sql, [id]);
};
exports.getCustomerById = getCustomerById;
const getAllCustomers = async () => {
    const sql = `SELECT * FROM customers ORDER BY created_at DESC`;
    return (0, db_1.all)(sql);
};
exports.getAllCustomers = getAllCustomers;
const updateCustomer = async (id, customer) => {
    const sql = `UPDATE customers SET name = ?, phone = ?, address = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await (0, db_1.run)(sql, [customer.name, customer.phone || null, customer.address || null, id]);
};
exports.updateCustomer = updateCustomer;
