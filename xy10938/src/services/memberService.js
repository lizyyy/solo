const { runQuery, getOne, getAll } = require('../db');

function generateMemberNo() {
  const lastMember = getOne(`SELECT member_no FROM members ORDER BY id DESC LIMIT 1`);
  let seq = 1;
  if (lastMember) {
    const match = lastMember.member_no.match(/M(\d{6})/);
    if (match) {
      seq = parseInt(match[1]) + 1;
    }
  }
  return `M${String(seq).padStart(6, '0')}`;
}

function createMember(data) {
  const { name, phone, level = '普通会员', balance = 0 } = data;

  if (!name || !phone) {
    throw { status: 400, message: '姓名和手机号不能为空', conclusion: '必填参数缺失' };
  }

  const existing = getOne(`SELECT id FROM members WHERE phone = ?`, [phone]);
  if (existing) {
    throw { status: 400, message: '该手机号已注册', conclusion: '拦截重复注册请求' };
  }

  const memberNo = generateMemberNo();
  const result = runQuery(
    `INSERT INTO members (member_no, name, phone, level, balance) VALUES (?, ?, ?, ?, ?)`,
    [memberNo, name, phone, level, balance]
  );

  return getOne(`SELECT * FROM members WHERE id = ?`, [result.lastInsertRowid]);
}

function getMemberList() {
  return getAll(`SELECT * FROM members ORDER BY created_at DESC`);
}

function getMemberById(id) {
  return getOne(`SELECT * FROM members WHERE id = ?`, [id]);
}

function getMemberByPhone(phone) {
  return getOne(`SELECT * FROM members WHERE phone = ?`, [phone]);
}

function updateMember(id, data) {
  const member = getMemberById(id);
  if (!member) {
    throw { status: 404, message: '会员不存在', conclusion: '找不到对应会员记录' };
  }

  const allowedFields = ['name', 'phone', 'level', 'balance'];
  const updates = [];
  const params = [];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(data[field]);
    }
  }

  if (updates.length === 0) {
    throw { status: 400, message: '没有有效更新字段', conclusion: '请求参数无效' };
  }

  params.push(id);
  runQuery(`UPDATE members SET ${updates.join(', ')} WHERE id = ?`, params);

  return getMemberById(id);
}

module.exports = {
  createMember,
  getMemberList,
  getMemberById,
  getMemberByPhone,
  updateMember
};
