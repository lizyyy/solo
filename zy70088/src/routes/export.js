const express = require('express');
const router = express.Router();
const { createObjectCsvStringifier } = require('csv-writer');

const { getDb } = require('../database/init');

function getStatusLabel(status) {
  const labels = {
    pending: '待处理',
    assigned: '已分派',
    merged: '已合并',
    closed: '已办结',
    withdrawn: '已撤回'
  };
  return labels[status] || status;
}

function getUrgencyLabel(level) {
  const labels = {
    low: '低',
    normal: '普通',
    high: '高',
    urgent: '紧急'
  };
  return labels[level] || level;
}

function getSupervisionLevelLabel(level) {
  const labels = {
    remind: '提醒',
    warning: '警告',
    urgent: '紧急督办'
  };
  return labels[level] || level;
}

router.get('/tickets.csv', (req, res) => {
  const db = getDb();
  
  const tickets = db.prepare(`
    SELECT 
      t.id, t.ticket_no, t.status,
      c.title as cluster_title, c.complaint_count,
      d.name as department_name, d.code as department_code,
      t.assigned_at, t.deadline, t.closed_at, t.closed_by,
      t.created_at, t.updated_at
    FROM tickets t
    LEFT JOIN clusters c ON c.id = t.cluster_id
    LEFT JOIN departments d ON d.id = t.assigned_department_id
    ORDER BY t.created_at DESC
  `).all();
  
  const records = tickets.map(t => {
    const replies = db.prepare(
      'SELECT COUNT(*) as cnt FROM replies WHERE ticket_id = ?'
    ).get(t.id).cnt;
    
    const officialReplies = db.prepare(
      'SELECT COUNT(*) as cnt FROM replies WHERE ticket_id = ? AND is_official = 1'
    ).get(t.id).cnt;
    
    const supervisions = db.prepare(
      'SELECT COUNT(*) as cnt FROM supervision_records WHERE ticket_id = ?'
    ).get(t.id).cnt;
    
    return {
      id: t.id,
      ticket_no: t.ticket_no,
      status: getStatusLabel(t.status),
      cluster_title: t.cluster_title || '',
      complaint_count: t.complaint_count || 0,
      department: t.department_name || '未分派',
      department_code: t.department_code || '',
      assigned_at: t.assigned_at || '',
      deadline: t.deadline || '',
      closed_at: t.closed_at || '',
      closed_by: t.closed_by || '',
      reply_count: replies,
      official_reply_count: officialReplies,
      supervision_count: supervisions,
      created_at: t.created_at,
      updated_at: t.updated_at
    };
  });
  
  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: 'id', title: '工单ID' },
      { id: 'ticket_no', title: '工单编号' },
      { id: 'status', title: '状态' },
      { id: 'cluster_title', title: '聚类标题' },
      { id: 'complaint_count', title: '投诉数量' },
      { id: 'department', title: '负责部门' },
      { id: 'department_code', title: '部门编码' },
      { id: 'assigned_at', title: '分派时间' },
      { id: 'deadline', title: '截止时间' },
      { id: 'closed_at', title: '办结时间' },
      { id: 'closed_by', title: '办结人' },
      { id: 'reply_count', title: '答复次数' },
      { id: 'official_reply_count', title: '官方答复次数' },
      { id: 'supervision_count', title: '督办次数' },
      { id: 'created_at', title: '创建时间' },
      { id: 'updated_at', title: '更新时间' }
    ]
  });
  
  const csvContent = '\uFEFF' + csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=tickets_${Date.now()}.csv`);
  
  res.send(csvContent);
});

router.get('/clusters.csv', (req, res) => {
  const db = getDb();
  
  const clusters = db.prepare(`
    SELECT 
      c.*,
      (SELECT COUNT(*) FROM cluster_members cm WHERE cm.cluster_id = c.id) as member_count
    FROM clusters c
    ORDER BY c.created_at DESC
  `).all();
  
  const records = [];
  
  for (const cluster of clusters) {
    const members = db.prepare(`
      SELECT 
        cm.similarity_score,
        c.complaint_no, c.citizen_name, c.citizen_phone,
        c.content, c.area, c.location, c.category, c.urgency_level,
        c.created_at
      FROM cluster_members cm
      JOIN complaints c ON c.id = cm.complaint_id
      WHERE cm.cluster_id = ?
      ORDER BY cm.joined_at ASC
    `).all(cluster.id);
    
    for (const [index, member] of members.entries()) {
      records.push({
        cluster_id: cluster.id,
        cluster_title: cluster.title,
        cluster_key: cluster.cluster_key,
        primary_keyword: cluster.primary_keyword || '',
        member_count: cluster.member_count,
        member_index: index + 1,
        is_first: index === 0 ? '是' : '否',
        similarity_score: member.similarity_score ? member.similarity_score.toFixed(3) : '',
        complaint_no: member.complaint_no,
        citizen_name: member.citizen_name,
        citizen_phone: member.citizen_phone || '',
        content_preview: member.content.substring(0, 100),
        area: member.area || '',
        location: member.location || '',
        category: member.category || '',
        urgency: getUrgencyLabel(member.urgency_level),
        complaint_time: member.created_at
      });
    }
  }
  
  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: 'cluster_id', title: '聚类ID' },
      { id: 'cluster_title', title: '聚类标题' },
      { id: 'cluster_key', title: '聚类标识' },
      { id: 'primary_keyword', title: '主要关键词' },
      { id: 'member_count', title: '聚类成员数' },
      { id: 'member_index', title: '成员序号' },
      { id: 'is_first', title: '是否首条' },
      { id: 'similarity_score', title: '相似度得分' },
      { id: 'complaint_no', title: '投诉编号' },
      { id: 'citizen_name', title: '投诉人' },
      { id: 'citizen_phone', title: '联系电话' },
      { id: 'content_preview', title: '投诉内容摘要' },
      { id: 'area', title: '所属区域' },
      { id: 'location', title: '具体位置' },
      { id: 'category', title: '投诉类别' },
      { id: 'urgency', title: '紧急程度' },
      { id: 'complaint_time', title: '投诉时间' }
    ]
  });
  
  const csvContent = '\uFEFF' + csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=clusters_${Date.now()}.csv`);
  
  res.send(csvContent);
});

router.get('/replies.csv', (req, res) => {
  const db = getDb();
  
  const replies = db.prepare(`
    SELECT 
      r.*,
      t.ticket_no,
      c.title as cluster_title
    FROM replies r
    JOIN tickets t ON t.id = r.ticket_id
    LEFT JOIN clusters c ON c.id = t.cluster_id
    ORDER BY r.created_at DESC
  `).all();
  
  const records = replies.map(r => ({
    id: r.id,
    ticket_no: r.ticket_no,
    cluster_title: r.cluster_title || '',
    version: r.version,
    content: r.content,
    author: r.author,
    is_official: r.is_official ? '是' : '否',
    created_at: r.created_at
  }));
  
  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: 'id', title: '答复ID' },
      { id: 'ticket_no', title: '工单编号' },
      { id: 'cluster_title', title: '聚类标题' },
      { id: 'version', title: '版本号' },
      { id: 'content', title: '答复内容' },
      { id: 'author', title: '答复人' },
      { id: 'is_official', title: '是否官方答复' },
      { id: 'created_at', title: '答复时间' }
    ]
  });
  
  const csvContent = '\uFEFF' + csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=replies_${Date.now()}.csv`);
  
  res.send(csvContent);
});

router.get('/supervision.csv', (req, res) => {
  const db = getDb();
  
  const supervisions = db.prepare(`
    SELECT 
      sr.*,
      t.ticket_no, t.status as ticket_status, t.deadline,
      c.title as cluster_title,
      d.name as department_name
    FROM supervision_records sr
    JOIN tickets t ON t.id = sr.ticket_id
    LEFT JOIN clusters c ON c.id = t.cluster_id
    LEFT JOIN departments d ON d.id = t.assigned_department_id
    ORDER BY sr.created_at DESC
  `).all();
  
  const records = supervisions.map(s => ({
    id: s.id,
    ticket_no: s.ticket_no,
    ticket_status: getStatusLabel(s.ticket_status),
    cluster_title: s.cluster_title || '',
    department: s.department_name || '',
    level: getSupervisionLevelLabel(s.level),
    reason: s.reason || '',
    supervisor: s.supervisor,
    deadline: s.deadline || '',
    created_at: s.created_at
  }));
  
  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: 'id', title: '督办记录ID' },
      { id: 'ticket_no', title: '工单编号' },
      { id: 'ticket_status', title: '工单状态' },
      { id: 'cluster_title', title: '聚类标题' },
      { id: 'department', title: '负责部门' },
      { id: 'level', title: '督办级别' },
      { id: 'reason', title: '督办原因' },
      { id: 'supervisor', title: '督办人' },
      { id: 'deadline', title: '工单截止时间' },
      { id: 'created_at', title: '督办时间' }
    ]
  });
  
  const csvContent = '\uFEFF' + csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=supervision_${Date.now()}.csv`);
  
  res.send(csvContent);
});

router.get('/history.csv', (req, res) => {
  const db = getDb();
  
  const { entityType, entityId } = req.query;
  
  let sql = `
    SELECT * FROM history_logs
    WHERE 1=1
  `;
  const params = [];
  
  if (entityType) {
    sql += ' AND entity_type = ?';
    params.push(entityType);
  }
  
  if (entityId) {
    sql += ' AND entity_id = ?';
    params.push(parseInt(entityId));
  }
  
  sql += ' ORDER BY created_at DESC, id DESC LIMIT 1000';
  
  const logs = db.prepare(sql).all(...params);
  
  const records = logs.map(l => ({
    id: l.id,
    entity_type: l.entity_type,
    entity_id: l.entity_id,
    action: l.action,
    operator: l.operator,
    old_value: l.old_value || '',
    new_value: l.new_value || '',
    created_at: l.created_at
  }));
  
  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: 'id', title: '日志ID' },
      { id: 'entity_type', title: '实体类型' },
      { id: 'entity_id', title: '实体ID' },
      { id: 'action', title: '操作类型' },
      { id: 'operator', title: '操作人' },
      { id: 'old_value', title: '变更前值' },
      { id: 'new_value', title: '变更后值' },
      { id: 'created_at', title: '操作时间' }
    ]
  });
  
  const csvContent = '\uFEFF' + csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=history_${Date.now()}.csv`);
  
  res.send(csvContent);
});

module.exports = router;
