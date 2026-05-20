import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getAll, getOne, runQuery } from '../database';
import { PromoCodeStatus } from '../types';

export async function createPromoCode(req: Request, res: Response) {
  try {
    const { code, discountType, discountValue, maxUsage, validFrom, validTo } = req.body;

    if (!code || !discountType || !discountValue || !validFrom || !validTo) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    const existing = await getOne('SELECT id FROM promo_codes WHERE code = ?', [code]);
    if (existing) {
      return res.status(400).json({
        success: false,
        error: '优惠码已存在'
      });
    }

    const now = new Date().toISOString();
    await runQuery(
      `INSERT INTO promo_codes (id, code, discount_type, discount_value, max_usage, current_usage, status, valid_from, valid_to, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        code,
        discountType,
        discountValue,
        maxUsage || 1,
        PromoCodeStatus.ACTIVE,
        new Date(validFrom).toISOString(),
        new Date(validTo).toISOString(),
        now,
        now
      ]
    );

    res.json({
      success: true,
      message: '优惠码创建成功'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getPromoCodes(req: Request, res: Response) {
  try {
    const { page = 1, pageSize = 20, status } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    const codes = await getAll(
      `SELECT * FROM promo_codes ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(pageSize), offset]
    );

    const totalResult = await getOne<any>(
      `SELECT COUNT(*) as count FROM promo_codes ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        items: codes,
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

export async function getPromoCodeDetail(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const code = await getOne('SELECT * FROM promo_codes WHERE id = ?', [id]);

    if (!code) {
      return res.status(404).json({
        success: false,
        error: '优惠码不存在'
      });
    }

    res.json({
      success: true,
      data: code
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function updatePromoCodeStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const code = await getOne('SELECT * FROM promo_codes WHERE id = ?', [id]);
    if (!code) {
      return res.status(404).json({
        success: false,
        error: '优惠码不存在'
      });
    }

    await runQuery(
      'UPDATE promo_codes SET status = ?, updated_at = ? WHERE id = ?',
      [status, new Date().toISOString(), id]
    );

    res.json({
      success: true,
      message: '优惠码状态更新成功'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
