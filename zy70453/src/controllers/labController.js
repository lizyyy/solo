const { v4: uuidv4 } = require('uuid');
const { runQuery, getQuery, allQuery } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');

async function getLabSamples(req, res) {
  try {
    const { member_id, status, has_manual_remark, page = 1, pageSize = 20 } = req.query;
    
    let sql = `
      SELECT 
        ls.*,
        m.name as member_name,
        m.phone as member_phone
      FROM lab_samples ls
      LEFT JOIN members m ON ls.member_id = m.id
      WHERE 1=1
    `;
    const params = [];
    
    if (member_id) {
      sql += ' AND ls.member_id = ?';
      params.push(member_id);
    }
    
    if (status) {
      sql += ' AND ls.status = ?';
      params.push(status);
    }
    
    if (has_manual_remark === 'true') {
      sql += ' AND ls.manual_remark IS NOT NULL';
    }
    
    sql += ' ORDER BY ls.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
    
    const samples = await allQuery(sql, params);
    res.json(successResponse({
      list: samples,
      pagination: { page: parseInt(page), pageSize: parseInt(pageSize) }
    }));
  } catch (error) {
    res.status(500).json(errorResponse('获取样本列表失败', error.message));
  }
}

async function updateLabSampleRemark(req, res) {
  try {
    const { id } = req.params;
    const { manual_remark, operator_id } = req.body;
    
    if (manual_remark === undefined) {
      return res.status(400).json(errorResponse('备注内容不能为空'));
    }
    
    const sample = await getQuery('SELECT * FROM lab_samples WHERE id = ?', [id]);
    if (!sample) {
      return res.status(404).json(errorResponse('样本不存在'));
    }
    
    await runQuery(
      `UPDATE lab_samples 
       SET manual_remark = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [manual_remark, id]
    );
    
    const updated = await getQuery(`
      SELECT 
        ls.*,
        m.name as member_name,
        m.phone as member_phone
      FROM lab_samples ls
      LEFT JOIN members m ON ls.member_id = m.id
      WHERE ls.id = ?
    `, [id]);
    
    res.json(successResponse(updated, '人工备注更新成功'));
  } catch (error) {
    res.status(500).json(errorResponse('更新人工备注失败', error.message));
  }
}

async function searchLabSamples(req, res) {
  try {
    const { keyword, sample_no, member_name, operator_id } = req.query;
    
    let sql = `
      SELECT 
        ls.*,
        m.name as member_name,
        m.phone as member_phone
      FROM lab_samples ls
      LEFT JOIN members m ON ls.member_id = m.id
      WHERE 1=1
    `;
    const params = [];
    
    if (sample_no) {
      sql += ' AND ls.sample_no LIKE ?';
      params.push(`%${sample_no}%`);
    }
    
    if (member_name) {
      sql += ' AND m.name LIKE ?';
      params.push(`%${member_name}%`);
    }
    
    if (keyword) {
      sql += ` AND (
        ls.sample_no LIKE ? 
        OR m.name LIKE ? 
        OR ls.manual_remark LIKE ?
      )`;
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    
    if (operator_id) {
      sql += ' AND ls.operator_id = ?';
      params.push(operator_id);
    }
    
    sql += ' ORDER BY ls.created_at DESC LIMIT 100';
    
    const samples = await allQuery(sql, params);
    res.json(successResponse(samples, '样本搜索成功'));
  } catch (error) {
    res.status(500).json(errorResponse('搜索样本失败', error.message));
  }
}

module.exports = {
  getLabSamples,
  updateLabSampleRemark,
  searchLabSamples
};