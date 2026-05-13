"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPointRuleVersionById = getPointRuleVersionById;
exports.getPointRuleVersionByVersion = getPointRuleVersionByVersion;
exports.createPointRuleVersion = createPointRuleVersion;
exports.freezePointRuleVersion = freezePointRuleVersion;
exports.unfreezePointRuleVersion = unfreezePointRuleVersion;
exports.getAllPointRuleVersions = getAllPointRuleVersions;
exports.getMultiplierForCategory = getMultiplierForCategory;
exports.calculatePointsForTransaction = calculatePointsForTransaction;
const uuid_1 = require("uuid");
const database_1 = require("../database");
function dbRowToPointRuleVersion(row) {
    return {
        id: row.id,
        version: row.version,
        name: row.name,
        description: row.description || '',
        rules: JSON.parse(row.rules),
        effectiveAt: row.effective_at,
        isFrozen: row.is_frozen === 1,
        createdAt: row.created_at
    };
}
async function getPointRuleVersionById(id) {
    const row = await (0, database_1.getDbOne)('SELECT * FROM point_rule_versions WHERE id = ?', [id]);
    return row ? dbRowToPointRuleVersion(row) : undefined;
}
async function getPointRuleVersionByVersion(version) {
    const row = await (0, database_1.getDbOne)('SELECT * FROM point_rule_versions WHERE version = ?', [version]);
    return row ? dbRowToPointRuleVersion(row) : undefined;
}
async function createPointRuleVersion(version, name, rules, effectiveAt, description) {
    const now = new Date().toISOString();
    const id = (0, uuid_1.v4)();
    await (0, database_1.runDb)('INSERT INTO point_rule_versions (id, version, name, description, rules, effective_at, is_frozen, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, version, name, description || '', JSON.stringify(rules), effectiveAt, 0, now]);
    const ruleVersion = await getPointRuleVersionById(id);
    if (!ruleVersion) {
        throw new Error('Failed to create point rule version');
    }
    return ruleVersion;
}
async function freezePointRuleVersion(id) {
    await (0, database_1.runDb)('UPDATE point_rule_versions SET is_frozen = 1 WHERE id = ?', [id]);
}
async function unfreezePointRuleVersion(id) {
    await (0, database_1.runDb)('UPDATE point_rule_versions SET is_frozen = 0 WHERE id = ?', [id]);
}
async function getAllPointRuleVersions() {
    const rows = await (0, database_1.getDbAll)('SELECT * FROM point_rule_versions ORDER BY created_at DESC');
    return rows.map(dbRowToPointRuleVersion);
}
async function getMultiplierForCategory(rules, category) {
    const rule = rules.find(r => r.category === category);
    return rule ? rule.multiplier : 1;
}
async function calculatePointsForTransaction(amount, category, rules) {
    const multiplier = await getMultiplierForCategory(rules, category);
    return Math.floor(amount * multiplier);
}
