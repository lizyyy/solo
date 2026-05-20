import { Request, Response } from 'express';
import riskEngine from '../services/riskEngine';
import { getAll, getOne, runQuery } from '../database';
import { EventStatus } from '../types';
import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';

export async function checkPromoCodeRisk(req: Request, res: Response) {
  try {
    const { promoCode, deviceId, userId, ipAddress, userAgent } = req.body;

    if (!promoCode || !deviceId || !ipAddress || !userAgent) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    const result = await riskEngine.checkRisk({
      promoCode,
      deviceId,
      userId,
      ipAddress,
      userAgent
    });

    if (!result.allowed && result.promoCodeId) {
      await riskEngine.recordBlockEvent({
        promoCodeId: result.promoCodeId,
        promoCode,
        deviceId,
        userId,
        ipAddress,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        triggeredRules: result.triggeredRules,
        reason: result.reason
      });
    } else if (result.allowed && result.promoCodeId) {
      await riskEngine.recordAllowRecord({
        promoCodeId: result.promoCodeId,
        promoCode,
        deviceId,
        userId,
        ipAddress,
        riskScore: result.riskScore,
        isManual: false
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getBlockEvents(req: Request, res: Response) {
  try {
    const { page = 1, pageSize = 20, status } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    const events = await getAll(
      `SELECT * FROM block_events ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(pageSize), offset]
    );

    const totalResult = await getOne<any>(
      `SELECT COUNT(*) as count FROM block_events ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        items: events.map(e => ({
          ...e,
          triggeredRules: JSON.parse(e.triggered_rules)
        })),
        total: totalResult?.count || 0,
        page: Number(page),
        pageSize: Number(pageSize)
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getBlockEventDetail(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const event = await getOne('SELECT * FROM block_events WHERE id = ?', [id]);

    if (!event) {
      return res.status(404).json({
        success: false,
        error: '事件不存在'
      });
    }

    res.json({
      success: true,
      data: {
        ...event,
        triggeredRules: JSON.parse(event.triggered_rules)
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function manualAllow(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { approvedBy, note } = req.body;

    const event = await getOne('SELECT * FROM block_events WHERE id = ?', [id]);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: '事件不存在'
      });
    }

    const now = new Date().toISOString();
    await runQuery(
      `UPDATE block_events SET status = ?, updated_at = ?, compensated_at = ?, compensated_by = ?, compensated_note = ? WHERE id = ?`,
      [EventStatus.MANUAL_ALLOWED, now, now, approvedBy || 'system', note || '人工放行', id]
    );

    await riskEngine.recordAllowRecord({
      promoCodeId: event.promo_code_id,
      promoCode: event.promo_code,
      deviceId: event.device_id,
      userId: event.user_id,
      ipAddress: event.ip_address,
      riskScore: event.risk_score,
      isManual: true,
      approvedBy: approvedBy || 'system'
    });

    res.json({
      success: true,
      message: '人工放行成功'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function compensate(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { compensatedBy, note } = req.body;

    const event = await getOne('SELECT * FROM block_events WHERE id = ?', [id]);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: '事件不存在'
      });
    }

    const now = new Date().toISOString();
    await runQuery(
      `UPDATE block_events SET status = ?, updated_at = ?, compensated_at = ?, compensated_by = ?, compensated_note = ? WHERE id = ?`,
      [EventStatus.COMPENSATED, now, now, compensatedBy || 'system', note || '已补偿', id]
    );

    res.json({
      success: true,
      message: '补偿成功'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function exportBlockEvents(req: Request, res: Response) {
  try {
    const events = await getAll('SELECT * FROM block_events ORDER BY created_at DESC');

    const exportPath = path.join(__dirname, '../../exports');
    const fileName = `block-events-${Date.now()}.csv`;
    const filePath = path.join(exportPath, fileName);

    const fs = require('fs');
    if (!fs.existsSync(exportPath)) {
      fs.mkdirSync(exportPath, { recursive: true });
    }

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: '事件ID' },
        { id: 'promo_code', title: '优惠码' },
        { id: 'device_id', title: '设备ID' },
        { id: 'user_id', title: '用户ID' },
        { id: 'ip_address', title: 'IP地址' },
        { id: 'risk_score', title: '风险评分' },
        { id: 'risk_level', title: '风险等级' },
        { id: 'triggered_rules', title: '触发规则' },
        { id: 'status', title: '状态' },
        { id: 'reason', title: '拦截原因' },
        { id: 'created_at', title: '创建时间' },
        { id: 'compensated_at', title: '补偿时间' },
        { id: 'compensated_note', title: '补偿备注' }
      ]
    });

    const records = events.map(e => ({
      ...e,
      triggered_rules: JSON.parse(e.triggered_rules).join('; ')
    }));

    await csvWriter.writeRecords(records);

    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('下载文件失败:', err);
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getDashboardStats(req: Request, res: Response) {
  try {
    const totalBlocked = await getOne<any>('SELECT COUNT(*) as count FROM block_events');
    const todayBlocked = await getOne<any>(
      `SELECT COUNT(*) as count FROM block_events WHERE created_at >= date('now')`
    );
    const totalAllowed = await getOne<any>('SELECT COUNT(*) as count FROM allow_records');
    const manualAllowed = await getOne<any>('SELECT COUNT(*) as count FROM allow_records WHERE is_manual = 1');
    const pendingReview = await getOne<any>(
      `SELECT COUNT(*) as count FROM block_events WHERE status = 'blocked'`
    );

    const recentEvents = await getAll(
      `SELECT * FROM block_events ORDER BY created_at DESC LIMIT 10`
    );

    const dailyStats = await getAll(`
      SELECT 
        DATE(created_at) as date,
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked,
        SUM(CASE WHEN status IN ('manual_allowed', 'compensated') THEN 1 ELSE 0 END) as resolved
      FROM block_events
      WHERE created_at >= date('now', '-7 days')
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    res.json({
      success: true,
      data: {
        totalBlocked: totalBlocked?.count || 0,
        todayBlocked: todayBlocked?.count || 0,
        totalAllowed: totalAllowed?.count || 0,
        manualAllowed: manualAllowed?.count || 0,
        pendingReview: pendingReview?.count || 0,
        recentEvents: recentEvents.map(e => ({
          ...e,
          triggeredRules: JSON.parse(e.triggered_rules)
        })),
        dailyStats
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getAllowRecords(req: Request, res: Response) {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);

    const records = await getAll(
      `SELECT * FROM allow_records ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [Number(pageSize), offset]
    );

    const totalResult = await getOne<any>('SELECT COUNT(*) as count FROM allow_records');

    res.json({
      success: true,
      data: {
        items: records,
        total: totalResult?.count || 0,
        page: Number(page),
        pageSize: Number(pageSize)
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
