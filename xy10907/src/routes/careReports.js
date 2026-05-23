const express = require('express');
const router = express.Router();
const Joi = require('joi');
const moment = require('moment');
const { Parser } = require('json2csv');
const DBUtils = require('../utils/dbUtils');
const ResponseUtil = require('../utils/response');

const reportSchema = Joi.object({
  order_id: Joi.string().required(),
  pet_id: Joi.string().required(),
  report_date: Joi.date().required(),
  content: Joi.string().required(),
  generated_by: Joi.string().allow('')
});

router.post('/', async (req, res, next) => {
  try {
    const { error, value } = reportSchema.validate(req.body);
    if (error) {
      return await ResponseUtil.invalidInput(req, res, '参数验证失败', error.details);
    }

    const id = await DBUtils.insert('care_reports', value);
    const report = await DBUtils.getOne('SELECT * FROM care_reports WHERE id = ?', [id]);
    ResponseUtil.success(res, report, '护理报告创建成功', 201);
  } catch (err) {
    next(err);
  }
});

router.post('/generate', async (req, res, next) => {
  try {
    const { order_id, pet_id, start_date, end_date, generated_by } = req.body;

    if (!order_id || !pet_id) {
      return await ResponseUtil.invalidInput(req, res, '订单ID和宠物ID不能为空');
    }

    const order = await DBUtils.getOne('SELECT * FROM orders WHERE id = ?', [order_id]);
    if (!order) {
      return await ResponseUtil.notFound(req, res, '寄养订单不存在');
    }

    const pet = await DBUtils.getOne('SELECT * FROM pets WHERE id = ?', [pet_id]);
    if (!pet) {
      return await ResponseUtil.notFound(req, res, '宠物档案不存在');
    }

    const start = start_date ? moment(start_date) : moment(order.check_in_date);
    const end = end_date ? moment(end_date) : moment();
    const reports = [];

    let current = start.clone().startOf('day');
    while (current.isSameOrBefore(end, 'day')) {
      const dateStr = current.format('YYYY-MM-DD');

      const executions = await DBUtils.getAll(`
        SELECT se.*, mp.medication_name
        FROM shift_executions se
        JOIN medication_plans mp ON se.medication_plan_id = mp.id
        WHERE mp.order_id = ? AND mp.pet_id = ? AND DATE(se.scheduled_time) = ?
        ORDER BY se.scheduled_time
      `, [order_id, pet_id, dateStr]);

      const changeConfirmations = await DBUtils.getAll(`
        SELECT * FROM change_confirmations
        WHERE resource_type = 'medication_plan' AND DATE(created_at) = ?
        ORDER BY created_at
      `, [dateStr]);

      let content = `【${dateStr} 护理报告】\n`;
      content += `宠物：${pet.name} (${pet.species})\n`;
      content += `房间：${order.room_number || '未分配'}\n\n`;

      if (executions.length > 0) {
        content += `喂药记录：\n`;
        executions.forEach(exec => {
          const time = moment(exec.scheduled_time).format('HH:mm');
          const statusText = exec.status === 'completed' ? '已执行' : 
                            exec.status === 'missed' ? '漏喂' : '待执行';
          content += `  - ${time} ${exec.medication_name}: ${statusText}`;
          if (exec.actual_dosage) {
            content += ` (剂量: ${exec.actual_dosage})`;
          }
          if (exec.has_alarm && !exec.alarm_acknowledged) {
            content += ` ⚠️ 有待确认告警`;
          }
          content += `\n`;
        });
      } else {
        content += `喂药记录：当日无喂药计划\n`;
      }

      if (changeConfirmations.length > 0) {
        content += `\n变更记录：\n`;
        changeConfirmations.forEach(cc => {
          content += `  - ${moment(cc.created_at).format('HH:mm')}: 剂量变更${cc.status === 'approved' ? '已批准' : cc.status === 'rejected' ? '已驳回' : '待复核'}\n`;
        });
      }

      const existing = await DBUtils.getOne(
        'SELECT * FROM care_reports WHERE order_id = ? AND pet_id = ? AND report_date = ?',
        [order_id, pet_id, dateStr]
      );

      if (existing) {
        await DBUtils.update('care_reports', {
          content,
          generated_by: generated_by || existing.generated_by
        }, existing.id);
        reports.push(await DBUtils.getOne('SELECT * FROM care_reports WHERE id = ?', [existing.id]));
      } else {
        const id = await DBUtils.insert('care_reports', {
          order_id,
          pet_id,
          report_date: dateStr,
          content,
          generated_by: generated_by || ''
        });
        reports.push(await DBUtils.getOne('SELECT * FROM care_reports WHERE id = ?', [id]));
      }

      current.add(1, 'day');
    }

    ResponseUtil.success(res, reports, `护理报告已生成，共 ${reports.length} 天`);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { order_id, pet_id, start_date, end_date, page = 1, limit = 20 } = req.query;
    let sql = `
      SELECT cr.*, p.name as pet_name, o.room_number
      FROM care_reports cr
      JOIN pets p ON cr.pet_id = p.id
      JOIN orders o ON cr.order_id = o.id
      WHERE 1=1
    `;
    const params = [];

    if (order_id) {
      sql += ' AND cr.order_id = ?';
      params.push(order_id);
    }
    if (pet_id) {
      sql += ' AND cr.pet_id = ?';
      params.push(pet_id);
    }
    if (start_date) {
      sql += ' AND cr.report_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND cr.report_date <= ?';
      params.push(end_date);
    }

    sql += ' ORDER BY cr.report_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const reports = await DBUtils.getAll(sql, params);
    const countResult = await DBUtils.getOne('SELECT COUNT(*) as total FROM care_reports');

    ResponseUtil.success(res, {
      items: reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/export/csv', async (req, res, next) => {
  try {
    const { order_id, pet_id, start_date, end_date } = req.query;
    let sql = `
      SELECT 
        cr.report_date as 报告日期,
        p.name as 宠物名称,
        p.species as 宠物种类,
        o.room_number as 房间号,
        cr.content as 报告内容,
        cr.generated_by as 生成人,
        cr.created_at as 创建时间
      FROM care_reports cr
      JOIN pets p ON cr.pet_id = p.id
      JOIN orders o ON cr.order_id = o.id
      WHERE 1=1
    `;
    const params = [];

    if (order_id) {
      sql += ' AND cr.order_id = ?';
      params.push(order_id);
    }
    if (pet_id) {
      sql += ' AND cr.pet_id = ?';
      params.push(pet_id);
    }
    if (start_date) {
      sql += ' AND cr.report_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND cr.report_date <= ?';
      params.push(end_date);
    }

    sql += ' ORDER BY cr.report_date';

    const reports = await DBUtils.getAll(sql, params);

    if (reports.length === 0) {
      return await ResponseUtil.notFound(req, res, '没有可导出的报告数据');
    }

    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(reports);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="care_report_${moment().format('YYYYMMDDHHmmss')}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const report = await DBUtils.getOne(`
      SELECT cr.*, p.name as pet_name, o.room_number
      FROM care_reports cr
      JOIN pets p ON cr.pet_id = p.id
      JOIN orders o ON cr.order_id = o.id
      WHERE cr.id = ?
    `, [req.params.id]);

    if (!report) {
      return await ResponseUtil.notFound(req, res, '护理报告不存在');
    }

    ResponseUtil.success(res, report);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
