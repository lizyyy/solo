const express = require('express');
const { Parser } = require('json2csv');
const db = require('../database');
const { authMiddleware, requireRoles } = require('../middleware/auth');
const { createLog, logModules } = require('../utils/logger');

const router = express.Router();

const STATUS_NAMES = {
  pending: '待处理',
  processing: '处理中',
  reviewing: '待复核',
  completed: '已通过',
  rejected: '已驳回'
};

const CONTENT_TYPE_NAMES = {
  text: '文本',
  image: '图片',
  video: '视频',
  audio: '音频',
  link: '链接',
  other: '其他'
};

router.get('/appeals', authMiddleware, (req, res) => {
  const { 
    status, 
    content_type, 
    keyword, 
    start_time, 
    end_time,
    operator_id
  } = req.query;
  
  const user = req.user;
  
  let whereClause = 'WHERE 1=1';
  const params = [];
  
  if (status) {
    whereClause += ' AND a.status = ?';
    params.push(status);
  }
  
  if (content_type) {
    whereClause += ' AND a.content_type = ?';
    params.push(content_type);
  }
  
  if (keyword) {
    whereClause += ' AND (a.title LIKE ? OR a.appeal_no LIKE ? OR a.content LIKE ?)';
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw);
  }
  
  if (start_time) {
    whereClause += ' AND a.created_at >= ?';
    params.push(start_time);
  }
  
  if (end_time) {
    whereClause += ' AND a.created_at <= ?';
    params.push(end_time);
  }
  
  if (operator_id) {
    if (operator_id === 'self') {
      whereClause += ' AND a.operator_id = ?';
      params.push(user.id);
    } else {
      whereClause += ' AND a.operator_id = ?';
      params.push(operator_id);
    }
  }
  
  if (user.role === 'operator') {
    whereClause += ' AND (a.operator_id = ? OR a.status = ?)';
    params.push(user.id, 'pending');
  } else if (user.role === 'reviewer') {
    whereClause += ' AND a.status IN (?, ?, ?, ?)';
    params.push('reviewing', 'completed', 'rejected', 'processing');
  }
  
  const appeals = db.prepare(`
    SELECT 
      a.id,
      a.appeal_no,
      a.title,
      a.content,
      a.content_type,
      a.source_platform,
      a.source_id,
      a.status,
      a.result,
      a.result_reason,
      op.name as operator_name,
      rv.name as reviewer_name,
      a.created_at,
      a.updated_at
    FROM appeals a
    LEFT JOIN users op ON a.operator_id = op.id
    LEFT JOIN users rv ON a.reviewer_id = rv.id
    ${whereClause}
    ORDER BY a.created_at DESC
  `).all(...params);
  
  const processedData = appeals.map(item => ({
    ...item,
    status_name: STATUS_NAMES[item.status] || item.status,
    content_type_name: CONTENT_TYPE_NAMES[item.content_type] || item.content_type,
    result_name: item.result === 'pass' ? '建议通过' : item.result === 'reject' ? '建议驳回' : ''
  }));
  
  const fields = [
    { label: '申诉编号', value: 'appeal_no' },
    { label: '标题', value: 'title' },
    { label: '申诉内容', value: 'content' },
    { label: '内容类型', value: 'content_type_name' },
    { label: '来源平台', value: 'source_platform' },
    { label: '来源ID', value: 'source_id' },
    { label: '当前状态', value: 'status_name' },
    { label: '操作员', value: 'operator_name' },
    { label: '复核员', value: 'reviewer_name' },
    { label: '处理结果', value: 'result_name' },
    { label: '结果说明', value: 'result_reason' },
    { label: '创建时间', value: 'created_at' },
    { label: '更新时间', value: 'updated_at' }
  ];
  
  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(processedData);
  
  createLog(req, 'EXPORT', logModules.EXPORT, `导出申诉数据 ${processedData.length} 条`);
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=appeals_${Date.now()}.csv`);
  res.send('\uFEFF' + csv);
});

router.get('/appeal/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  
  const appeal = db.prepare(`
    SELECT 
      a.id,
      a.appeal_no,
      a.title,
      a.content,
      a.content_type,
      a.source_platform,
      a.source_id,
      a.status,
      a.result,
      a.result_reason,
      op.name as operator_name,
      rv.name as reviewer_name,
      a.created_at,
      a.updated_at
    FROM appeals a
    LEFT JOIN users op ON a.operator_id = op.id
    LEFT JOIN users rv ON a.reviewer_id = rv.id
    WHERE a.id = ?
  `).get(id);
  
  if (!appeal) {
    return res.status(404).json({ error: '申诉不存在' });
  }
  
  const user = req.user;
  if (user.role === 'operator' && appeal.operator_id !== user.id && appeal.status === 'pending') {
    return res.status(403).json({ error: '无权限导出该申诉' });
  }
  
  const history = db.prepare(`
    SELECT from_status, to_status, action, remark, operator_name, created_at
    FROM appeal_history 
    WHERE appeal_id = ?
    ORDER BY created_at ASC
  `).all(id);
  
  const attachments = db.prepare(`
    SELECT original_name, uploaded_by_name, file_size, created_at
    FROM attachments 
    WHERE appeal_id = ?
    ORDER BY created_at DESC
  `).all(id);
  
  const mainFields = [
    { label: '申诉编号', value: 'appeal_no' },
    { label: '标题', value: 'title' },
    { label: '申诉内容', value: 'content' },
    { label: '内容类型', value: 'content_type' },
    { label: '来源平台', value: 'source_platform' },
    { label: '来源ID', value: 'source_id' },
    { label: '当前状态', value: 'status' },
    { label: '操作员', value: 'operator_name' },
    { label: '复核员', value: 'reviewer_name' },
    { label: '处理结果', value: 'result' },
    { label: '结果说明', value: 'result_reason' },
    { label: '创建时间', value: 'created_at' },
    { label: '更新时间', value: 'updated_at' }
  ];
  
  const processedAppeal = {
    ...appeal,
    status: STATUS_NAMES[appeal.status] || appeal.status,
    content_type: CONTENT_TYPE_NAMES[appeal.content_type] || appeal.content_type,
    result: appeal.result === 'pass' ? '建议通过' : appeal.result === 'reject' ? '建议驳回' : ''
  };
  
  let csvOutput = '=== 申诉基本信息 ===\n';
  const mainParser = new Parser({ fields: mainFields });
  csvOutput += mainParser.parse([processedAppeal]);
  
  if (history.length > 0) {
    const historyFields = [
      { label: '原状态', value: 'from_status' },
      { label: '新状态', value: 'to_status' },
      { label: '操作', value: 'action' },
      { label: '备注', value: 'remark' },
      { label: '操作人', value: 'operator_name' },
      { label: '操作时间', value: 'created_at' }
    ];
    const historyParser = new Parser({ fields: historyFields });
    csvOutput += '\n\n=== 状态流转记录 ===\n';
    csvOutput += historyParser.parse(history.map(h => ({
      ...h,
      from_status: h.from_status ? STATUS_NAMES[h.from_status] || h.from_status : '-',
      to_status: STATUS_NAMES[h.to_status] || h.to_status
    })));
  }
  
  if (attachments.length > 0) {
    const attachmentFields = [
      { label: '文件名', value: 'original_name' },
      { label: '上传人', value: 'uploaded_by_name' },
      { label: '文件大小(字节)', value: 'file_size' },
      { label: '上传时间', value: 'created_at' }
    ];
    const attachmentParser = new Parser({ fields: attachmentFields });
    csvOutput += '\n\n=== 附件列表 ===\n';
    csvOutput += attachmentParser.parse(attachments);
  }
  
  createLog(req, 'EXPORT', logModules.EXPORT, `导出申诉详情: ${appeal.appeal_no}`, Number(id));
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=appeal_${appeal.appeal_no}_${Date.now()}.csv`);
  res.send('\uFEFF' + csvOutput);
});

module.exports = router;
