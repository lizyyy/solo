const { get, all, run, STATUS_LABELS, STATUS_FLOW } = require('../database/database');
const { AppError } = require('../middleware/errorHandler');
const { 
  validateCreateLead, 
  validateUpdateLead, 
  validateFilters,
  validateStatusFlow,
  getValidStatuses,
  COURSES,
  RESPONSIBLES
} = require('../utils/validators');
const moment = require('moment');

const getAllLeads = async (req, res, next) => {
  try {
    const { error, value } = validateFilters(req.query);
    if (error) {
      return next(new AppError(error.details[0].message, 400, 'VALIDATION_ERROR'));
    }

    const { status, responsible, page, limit } = value;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let params = [];

    if (status && status !== '') {
      whereConditions.push('status = ?');
      params.push(status);
    }

    if (responsible && responsible !== '') {
      whereConditions.push('responsible = ?');
      params.push(responsible);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const countQuery = `SELECT COUNT(*) as total FROM leads ${whereClause}`;
    const countResult = await get(countQuery, params);
    const total = countResult.total;
    const totalPages = Math.ceil(total / limit);

    const query = `
      SELECT id, name, phone, course, appointment_time, status, responsible, notes, created_at, updated_at
      FROM leads ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const leads = await all(query, [...params, limit, offset]);

    const formattedLeads = leads.map(lead => ({
      ...lead,
      status_label: STATUS_LABELS[lead.status] || lead.status,
      summary: `${lead.name} - ${lead.course}`,
      appointment_time_formatted: moment(lead.appointment_time).format('YYYY-MM-DD HH:mm'),
      created_at_formatted: moment(lead.created_at).format('YYYY-MM-DD HH:mm'),
      updated_at_formatted: moment(lead.updated_at).format('YYYY-MM-DD HH:mm')
    }));

    res.json({
      success: true,
      data: {
        leads: formattedLeads,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

const getLeadById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const lead = await get(`
      SELECT id, name, phone, course, appointment_time, status, responsible, notes, created_at, updated_at
      FROM leads WHERE id = ?
    `, [id]);

    if (!lead) {
      return next(new AppError(`未找到ID为 ${id} 的线索`, 404, 'LEAD_NOT_FOUND'));
    }

    const history = await all(`
      SELECT id, field_name, old_value, new_value, changed_at
      FROM lead_history 
      WHERE lead_id = ?
      ORDER BY changed_at DESC
    `, [id]);

    const formattedLead = {
      ...lead,
      status_label: STATUS_LABELS[lead.status] || lead.status,
      appointment_time_formatted: moment(lead.appointment_time).format('YYYY-MM-DD HH:mm'),
      created_at_formatted: moment(lead.created_at).format('YYYY-MM-DD HH:mm'),
      updated_at_formatted: moment(lead.updated_at).format('YYYY-MM-DD HH:mm')
    };

    const formattedHistory = history.map(item => ({
      ...item,
      old_value_label: item.field_name === '状态' ? (STATUS_LABELS[item.old_value] || item.old_value) : item.old_value,
      new_value_label: item.field_name === '状态' ? (STATUS_LABELS[item.new_value] || item.new_value) : item.new_value,
      changed_at_formatted: moment(item.changed_at).format('YYYY-MM-DD HH:mm')
    }));

    res.json({
      success: true,
      data: {
        lead: formattedLead,
        history: formattedHistory
      }
    });
  } catch (err) {
    next(err);
  }
};

const createLead = async (req, res, next) => {
  try {
    const { error, value } = validateCreateLead(req.body);
    if (error) {
      return next(new AppError(error.details[0].message, 400, 'VALIDATION_ERROR'));
    }

    const { name, phone, course, appointment_time, status, responsible, notes } = value;

    const insertLead = `
      INSERT INTO leads (name, phone, course, appointment_time, status, responsible, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `;

    const result = await run(insertLead, [name, phone, course, appointment_time, status || 'new', responsible, notes]);
    const newLeadId = result.lastID;

    const newLead = await get(`
      SELECT id, name, phone, course, appointment_time, status, responsible, notes, created_at, updated_at
      FROM leads WHERE id = ?
    `, [newLeadId]);

    const formattedLead = {
      ...newLead,
      status_label: STATUS_LABELS[newLead.status] || newLead.status,
      appointment_time_formatted: moment(newLead.appointment_time).format('YYYY-MM-DD HH:mm'),
      created_at_formatted: moment(newLead.created_at).format('YYYY-MM-DD HH:mm'),
      updated_at_formatted: moment(newLead.updated_at).format('YYYY-MM-DD HH:mm')
    };

    res.status(201).json({
      success: true,
      data: {
        lead: formattedLead
      }
    });
  } catch (err) {
    next(err);
  }
};

const updateLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const existingLead = await get(`
      SELECT id, name, phone, course, appointment_time, status, responsible, notes
      FROM leads WHERE id = ?
    `, [id]);

    if (!existingLead) {
      return next(new AppError(`未找到ID为 ${id} 的线索`, 404, 'LEAD_NOT_FOUND'));
    }

    const { error, value } = validateUpdateLead(req.body);
    if (error) {
      return next(new AppError(error.details[0].message, 400, 'VALIDATION_ERROR'));
    }

    if (value.status && value.status !== existingLead.status) {
      if (!validateStatusFlow(existingLead.status, value.status)) {
        return next(new AppError(
          `状态流转无效: 不能从 "${STATUS_LABELS[existingLead.status]}" 改为 "${STATUS_LABELS[value.status]}"`,
          400,
          'INVALID_STATUS_TRANSITION'
        ));
      }
    }

    const changes = [];
    const fieldMappings = {
      'name': '姓名',
      'phone': '手机号',
      'course': '课程',
      'appointment_time': '预约时间',
      'status': '状态',
      'responsible': '负责人',
      'notes': '备注'
    };

    for (const [field, newValue] of Object.entries(value)) {
      const oldValue = existingLead[field];
      if (newValue !== oldValue) {
        changes.push({
          field,
          fieldName: fieldMappings[field] || field,
          oldValue,
          newValue
        });
      }
    }

    if (changes.length === 0) {
      return next(new AppError('没有需要更新的字段', 400, 'NO_CHANGES'));
    }

    const updateFields = changes.map(change => `${change.field} = ?`).join(', ');
    const updateParams = changes.map(change => change.newValue);
    updateParams.push(id);

    const updateLead = `
      UPDATE leads 
      SET ${updateFields}, updated_at = datetime('now')
      WHERE id = ?
    `;

    await run(updateLead, updateParams);

    const insertHistory = `
      INSERT INTO lead_history (lead_id, field_name, old_value, new_value)
      VALUES (?, ?, ?, ?)
    `;

    for (const change of changes) {
      await run(insertHistory, [id, change.fieldName, change.oldValue, change.newValue]);
    }

    const updatedLead = await get(`
      SELECT id, name, phone, course, appointment_time, status, responsible, notes, created_at, updated_at
      FROM leads WHERE id = ?
    `, [id]);

    const formattedLead = {
      ...updatedLead,
      status_label: STATUS_LABELS[updatedLead.status] || updatedLead.status,
      appointment_time_formatted: moment(updatedLead.appointment_time).format('YYYY-MM-DD HH:mm'),
      created_at_formatted: moment(updatedLead.created_at).format('YYYY-MM-DD HH:mm'),
      updated_at_formatted: moment(updatedLead.updated_at).format('YYYY-MM-DD HH:mm')
    };

    res.json({
      success: true,
      data: {
        lead: formattedLead,
        changes: changes.map(c => ({
          field: c.field,
          fieldName: c.fieldName,
          oldValue: c.field === 'status' ? (STATUS_LABELS[c.oldValue] || c.oldValue) : c.oldValue,
          newValue: c.field === 'status' ? (STATUS_LABELS[c.newValue] || c.newValue) : c.newValue
        }))
      }
    });
  } catch (err) {
    next(err);
  }
};

const deleteLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const existingLead = await get('SELECT id FROM leads WHERE id = ?', [id]);
    if (!existingLead) {
      return next(new AppError(`未找到ID为 ${id} 的线索`, 404, 'LEAD_NOT_FOUND'));
    }

    await run('DELETE FROM leads WHERE id = ?', [id]);

    res.json({
      success: true,
      message: `线索 ID ${id} 已成功删除`
    });
  } catch (err) {
    next(err);
  }
};

const getMetadata = (req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        statuses: getValidStatuses.map(key => ({
          value: key,
          label: STATUS_LABELS[key]
        })),
        courses: COURSES,
        responsibles: RESPONSIBLES,
        status_flow: STATUS_FLOW
      }
    });
  } catch (err) {
    next(err);
  }
};

const exportMarkdownReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const lead = await get(`
      SELECT id, name, phone, course, appointment_time, status, responsible, notes, created_at, updated_at
      FROM leads WHERE id = ?
    `, [id]);

    if (!lead) {
      return next(new AppError(`未找到ID为 ${id} 的线索`, 404, 'LEAD_NOT_FOUND'));
    }

    const history = await all(`
      SELECT id, field_name, old_value, new_value, changed_at
      FROM lead_history 
      WHERE lead_id = ?
      ORDER BY changed_at ASC
    `, [id]);

    const formatTime = (time) => {
      if (!time) return '-';
      return moment(time).format('YYYY-MM-DD HH:mm');
    };

    let markdown = `# 线索核对报告

## 基本信息

| 字段 | 内容 |
|------|------|
| **ID** | ${lead.id} |
| **学员姓名** | ${lead.name} |
| **手机号** | ${lead.phone} |
| **课程** | ${lead.course} |
| **预约时间** | ${formatTime(lead.appointment_time)} |
| **当前状态** | ${STATUS_LABELS[lead.status]} |
| **负责人** | ${lead.responsible} |
| **备注** | ${lead.notes || '-'} |
| **创建时间** | ${formatTime(lead.created_at)} |
| **最后更新** | ${formatTime(lead.updated_at)} |

## 修改历史

`;

    if (history.length === 0) {
      markdown += `*暂无修改记录*\n`;
    } else {
      history.forEach((item, index) => {
        const oldValue = item.field_name === '状态' ? (STATUS_LABELS[item.old_value] || item.old_value) : (item.old_value || '(空)');
        const newValue = item.field_name === '状态' ? (STATUS_LABELS[item.new_value] || item.new_value) : (item.new_value || '(空)');
        markdown += `### 修改记录 ${index + 1} - ${formatTime(item.changed_at)}\n\n`;
        markdown += `- **字段**: ${item.field_name}\n`;
        markdown += `- **修改前**: ${oldValue}\n`;
        markdown += `- **修改后**: ${newValue}\n\n`;
      });
    }

    markdown += `\n---\n*报告生成时间: ${moment().format('YYYY-MM-DD HH:mm:ss')}*\n`;

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="lead_${id}_report.md"`);
    res.send(markdown);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  getMetadata,
  exportMarkdownReport
};
