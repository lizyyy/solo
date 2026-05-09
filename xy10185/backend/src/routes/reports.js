const express = require('express');
const XLSX = require('xlsx');
const dayjs = require('dayjs');
const { queryAll, queryOne } = require('../utils/db');
const { success, error, handleAsync } = require('../utils/response');

const router = express.Router();

router.get('/project/:projectId', handleAsync(async (req, res) => {
  const { projectId } = req.params;
  
  const project = queryOne('SELECT * FROM projects WHERE id = ?', [projectId]);
  if (!project) {
    return res.status(404).json(error('项目不存在', 404));
  }
  
  const milestones = queryAll(`
    SELECT * FROM milestones 
    WHERE project_id = ? 
    ORDER BY sequence ASC
  `, [projectId]);
  
  const deliverables = queryAll(`
    SELECT d.*, m.name as milestone_name, m.sequence as milestone_sequence
    FROM deliverables d 
    JOIN milestones m ON d.milestone_id = m.id 
    WHERE m.project_id = ?
    ORDER BY m.sequence ASC, d.created_at DESC
  `, [projectId]);
  
  const acceptanceRecords = queryAll(`
    SELECT ar.*, d.name as deliverable_name, d.version as deliverable_version
    FROM acceptance_records ar
    JOIN deliverables d ON ar.deliverable_id = d.id
    JOIN milestones m ON d.milestone_id = m.id
    WHERE m.project_id = ?
    ORDER BY ar.created_at DESC
  `, [projectId]);
  
  const reworkRecords = queryAll(`
    SELECT r.*, d.name as deliverable_name, d.version as deliverable_version
    FROM rework_records r
    JOIN deliverables d ON r.deliverable_id = d.id
    JOIN milestones m ON d.milestone_id = m.id
    WHERE m.project_id = ?
    ORDER BY r.created_at DESC
  `, [projectId]);
  
  res.json(success({
    project,
    milestones,
    deliverables,
    acceptance_records: acceptanceRecords,
    rework_records: reworkRecords
  }));
}));

router.get('/project/:projectId/export', handleAsync(async (req, res) => {
  const { projectId } = req.params;
  
  const project = queryOne('SELECT * FROM projects WHERE id = ?', [projectId]);
  if (!project) {
    return res.status(404).json(error('项目不存在', 404));
  }
  
  const milestones = queryAll(`
    SELECT * FROM milestones 
    WHERE project_id = ? 
    ORDER BY sequence ASC
  `, [projectId]);
  
  const deliverables = queryAll(`
    SELECT d.*, m.name as milestone_name, m.sequence as milestone_sequence
    FROM deliverables d 
    JOIN milestones m ON d.milestone_id = m.id 
    WHERE m.project_id = ?
    ORDER BY m.sequence ASC, d.created_at DESC
  `, [projectId]);
  
  const acceptanceRecords = queryAll(`
    SELECT ar.*, d.name as deliverable_name, d.version as deliverable_version, m.name as milestone_name
    FROM acceptance_records ar
    JOIN deliverables d ON ar.deliverable_id = d.id
    JOIN milestones m ON d.milestone_id = m.id
    WHERE m.project_id = ?
    ORDER BY ar.created_at DESC
  `, [projectId]);
  
  const reworkRecords = queryAll(`
    SELECT r.*, d.name as deliverable_name, d.version as deliverable_version, m.name as milestone_name
    FROM rework_records r
    JOIN deliverables d ON r.deliverable_id = d.id
    JOIN milestones m ON d.milestone_id = m.id
    WHERE m.project_id = ?
    ORDER BY r.created_at DESC
  `, [projectId]);
  
  const statusMap = {
    pending: '待开始',
    in_progress: '进行中',
    completed: '已完成',
    cancelled: '已取消',
    active: '进行中'
  };
  
  const deliverableStatusMap = {
    submitted: '已提交',
    reviewing: '审核中',
    accepted: '已通过',
    rejected: '已驳回'
  };
  
  const paymentStatusMap = {
    unpaid: '未付款',
    partial: '部分付款',
    paid: '已付款'
  };
  
  const projectData = [
    ['项目名称', project.name],
    ['供应商', project.vendor],
    ['项目描述', project.description || ''],
    ['开始日期', project.start_date || ''],
    ['结束日期', project.end_date || ''],
    ['项目金额', project.total_amount ? `¥${project.total_amount.toLocaleString()}` : ''],
    ['项目状态', statusMap[project.status] || project.status],
    ['创建时间', project.created_at]
  ];
  
  const milestonesData = [
    ['序号', '里程碑名称', '描述', '计划日期', '实际日期', '状态', '付款比例', '付款金额', '付款状态']
  ];
  milestones.forEach(ms => {
    milestonesData.push([
      ms.sequence,
      ms.name,
      ms.description || '',
      ms.planned_date || '',
      ms.actual_date || '',
      statusMap[ms.status] || ms.status,
      ms.payment_percentage ? `${ms.payment_percentage}%` : '',
      ms.payment_amount ? `¥${ms.payment_amount.toLocaleString()}` : '',
      paymentStatusMap[ms.payment_status] || ms.payment_status
    ]);
  });
  
  const deliverablesData = [
    ['里程碑', '交付物名称', '版本', '描述', '文件名', '上传人', '状态', '创建时间', '更新时间']
  ];
  deliverables.forEach(d => {
    deliverablesData.push([
      d.milestone_name,
      d.name,
      d.version,
      d.description || '',
      d.file_name || '',
      d.uploader || '',
      deliverableStatusMap[d.status] || d.status,
      d.created_at,
      d.updated_at
    ]);
  });
  
  const acceptanceData = [
    ['里程碑', '交付物', '版本', '验收结果', '验收意见', '验收人', '验收时间']
  ];
  acceptanceRecords.forEach(ar => {
    acceptanceData.push([
      ar.milestone_name,
      ar.deliverable_name,
      ar.deliverable_version,
      ar.result === 'accepted' ? '通过' : '驳回',
      ar.opinion || '',
      ar.reviewer || '',
      ar.created_at
    ]);
  });
  
  const reworkData = [
    ['里程碑', '交付物', '版本', '返工描述', '要求', '预计完成日期', '状态', '实际完成日期', '创建时间']
  ];
  reworkRecords.forEach(r => {
    reworkData.push([
      r.milestone_name,
      r.deliverable_name,
      r.deliverable_version,
      r.description,
      r.requirements || '',
      r.expected_date || '',
      statusMap[r.status] || r.status,
      r.actual_date || '',
      r.created_at
    ]);
  });
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(projectData), '项目信息');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(milestonesData), '里程碑');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(deliverablesData), '交付物');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(acceptanceData), '验收记录');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(reworkData), '返工记录');
  
  const fileName = `${project.name}_验收报告_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(fileName)}`);
  
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.send(buffer);
}));

router.get('/overview/export', handleAsync(async (req, res) => {
  const projects = queryAll('SELECT * FROM projects ORDER BY created_at DESC');
  
  const statusMap = {
    pending: '待开始',
    in_progress: '进行中',
    completed: '已完成',
    cancelled: '已取消',
    active: '进行中'
  };
  
  const paymentStatusMap = {
    unpaid: '未付款',
    partial: '部分付款',
    paid: '已付款'
  };
  
  const overviewData = [
    ['项目名称', '供应商', '项目金额', '项目状态', '开始日期', '结束日期', '创建时间']
  ];
  
  projects.forEach(p => {
    const milestones = queryAll('SELECT * FROM milestones WHERE project_id = ?', [p.id]);
    const paidAmount = milestones.filter(m => m.payment_status === 'paid').reduce((sum, m) => sum + m.payment_amount, 0);
    
    overviewData.push([
      p.name,
      p.vendor,
      p.total_amount ? `¥${p.total_amount.toLocaleString()}` : '',
      statusMap[p.status] || p.status,
      p.start_date || '',
      p.end_date || '',
      p.created_at
    ]);
  });
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(overviewData), '项目概览');
  
  projects.forEach(p => {
    const milestones = queryAll('SELECT * FROM milestones WHERE project_id = ? ORDER BY sequence ASC', [p.id]);
    const milestonesData = [
      ['序号', '里程碑名称', '描述', '计划日期', '实际日期', '状态', '付款比例', '付款金额', '付款状态']
    ];
    milestones.forEach(ms => {
      milestonesData.push([
        ms.sequence,
        ms.name,
        ms.description || '',
        ms.planned_date || '',
        ms.actual_date || '',
        statusMap[ms.status] || ms.status,
        ms.payment_percentage ? `${ms.payment_percentage}%` : '',
        ms.payment_amount ? `¥${ms.payment_amount.toLocaleString()}` : '',
        paymentStatusMap[ms.payment_status] || ms.payment_status
      ]);
    });
    const sheetName = p.name.length > 30 ? p.name.substring(0, 30) : p.name;
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(milestonesData), sheetName);
  });
  
  const fileName = `项目验收总览_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(fileName)}`);
  
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.send(buffer);
}));

module.exports = router;