"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultUsers = void 0;
exports.findUserByUsername = findUserByUsername;
exports.findUserById = findUserById;
exports.defaultUsers = [
    {
        id: 'user_001',
        username: 'zhang_entry',
        role: 'entry',
        name: '张三（录入员）'
    },
    {
        id: 'user_002',
        username: 'li_review',
        role: 'review',
        name: '李四（复核员）'
    },
    {
        id: 'user_003',
        username: 'wang_super',
        role: 'supervisor',
        name: '王五（主管）'
    },
    {
        id: 'user_004',
        username: 'zhao_read',
        role: 'readonly',
        name: '赵六（只读）'
    }
];
function findUserByUsername(username) {
    return exports.defaultUsers.find(u => u.username === username);
}
function findUserById(id) {
    return exports.defaultUsers.find(u => u.id === id);
}
