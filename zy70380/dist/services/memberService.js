"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMemberById = getMemberById;
exports.getMemberByPhone = getMemberByPhone;
exports.createMember = createMember;
exports.updateMemberPoints = updateMemberPoints;
exports.addMemberPoints = addMemberPoints;
exports.deductMemberPoints = deductMemberPoints;
exports.getAllMembers = getAllMembers;
const uuid_1 = require("uuid");
const database_1 = require("../database");
function dbRowToMember(row) {
    return {
        id: row.id,
        name: row.name,
        phone: row.phone,
        points: row.points,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}
async function getMemberById(id) {
    const row = await (0, database_1.getDbOne)('SELECT * FROM members WHERE id = ?', [id]);
    return row ? dbRowToMember(row) : undefined;
}
async function getMemberByPhone(phone) {
    const row = await (0, database_1.getDbOne)('SELECT * FROM members WHERE phone = ?', [phone]);
    return row ? dbRowToMember(row) : undefined;
}
async function createMember(name, phone) {
    const now = new Date().toISOString();
    const id = (0, uuid_1.v4)();
    await (0, database_1.runDb)('INSERT INTO members (id, name, phone, points, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [id, name, phone, 0, now, now]);
    const member = await getMemberById(id);
    if (!member) {
        throw new Error('Failed to create member');
    }
    return member;
}
async function updateMemberPoints(memberId, points) {
    const now = new Date().toISOString();
    await (0, database_1.runDb)('UPDATE members SET points = ?, updated_at = ? WHERE id = ?', [points, now, memberId]);
}
async function addMemberPoints(memberId, pointsToAdd) {
    const member = await getMemberById(memberId);
    if (!member) {
        throw new Error('Member not found');
    }
    const newPoints = member.points + pointsToAdd;
    await updateMemberPoints(memberId, newPoints);
}
async function deductMemberPoints(memberId, pointsToDeduct) {
    const member = await getMemberById(memberId);
    if (!member) {
        throw new Error('Member not found');
    }
    if (member.points < pointsToDeduct) {
        throw new Error('Insufficient points');
    }
    const newPoints = member.points - pointsToDeduct;
    await updateMemberPoints(memberId, newPoints);
}
async function getAllMembers() {
    const rows = await (0, database_1.getDbAll)('SELECT * FROM members');
    return rows.map(dbRowToMember);
}
