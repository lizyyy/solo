const express = require('express');
const router = express.Router();
const moment = require('moment');
const { PromotionWindowDAO, PriceVersionDAO, StoreDAO } = require('../database/dao');
const { validate } = require('../utils/validation');
const { successResponse, createdResponse, notFoundResponse, duplicateResponse } = require('../utils/response');
const { logException } = require('../middleware/exceptionHandler');

const promotionWindowDAO = new PromotionWindowDAO();
const priceVersionDAO = new PriceVersionDAO();
const storeDAO = new StoreDAO();

router.post('/', validate('promotionWindow'), async (req, res, next) => {
  try {
    const priceVersion = await priceVersionDAO.findById(req.body.price_version_id);
    if (!priceVersion) {
      return notFoundResponse(res, '价签版本不存在');
    }

    const existing = await promotionWindowDAO.findByCode(req.body.promotion_code);
    if (existing) {
      return duplicateResponse(res, '促销编码已存在');
    }

    req.body.status = 'scheduled';
    const result = await promotionWindowDAO.create(req.body);
    const promotion = await promotionWindowDAO.findById(result.lastID);
    return createdResponse(res, promotion, '促销窗口创建成功');
  } catch (err) {
    await logException(req, err, 'create_promotion_failed');
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { status, store_code } = req.query;
    let where = '';
    let params = [];

    if (status) {
      where += 'status = ?';
      params.push(status);
    }

    if (store_code) {
      where += where ? ' AND ' : '';
      where += 'store_codes LIKE ?';
      params.push(`%${store_code}%`);
    }

    const promotions = await promotionWindowDAO.findAll(where, params);
    return successResponse(res, promotions);
  } catch (err) {
    await logException(req, err, 'list_promotions_failed');
    next(err);
  }
});

router.get('/check-expired', async (req, res, next) => {
  try {
    const now = moment().format('YYYY-MM-DD HH:mm:ss');
    const expiredPromotions = await promotionWindowDAO.findExpiredPromotions(now);
    
    for (const promo of expiredPromotions) {
      await promotionWindowDAO.update(promo.id, {
        status: 'expired',
        updated_at: new Date().toISOString()
      });
    }

    return successResponse(res, {
      count: expiredPromotions.length,
      promotions: expiredPromotions
    }, `已检查并更新 ${expiredPromotions.length} 个过期促销`);
  } catch (err) {
    await logException(req, err, 'check_expired_promotions_failed');
    next(err);
  }
});

router.get('/:code', async (req, res, next) => {
  try {
    const promotion = await promotionWindowDAO.findByCode(req.params.code);
    if (!promotion) {
      return notFoundResponse(res, '促销窗口不存在');
    }
    return successResponse(res, promotion);
  } catch (err) {
    await logException(req, err, 'get_promotion_failed');
    next(err);
  }
});

router.patch('/:code/start', async (req, res, next) => {
  try {
    const promotion = await promotionWindowDAO.findByCode(req.params.code);
    if (!promotion) {
      return notFoundResponse(res, '促销窗口不存在');
    }

    await promotionWindowDAO.update(promotion.id, {
      status: 'active',
      updated_at: new Date().toISOString()
    });

    const updated = await promotionWindowDAO.findById(promotion.id);
    return successResponse(res, updated, '促销已开始');
  } catch (err) {
    await logException(req, err, 'start_promotion_failed');
    next(err);
  }
});

router.patch('/:code/end', async (req, res, next) => {
  try {
    const promotion = await promotionWindowDAO.findByCode(req.params.code);
    if (!promotion) {
      return notFoundResponse(res, '促销窗口不存在');
    }

    await promotionWindowDAO.update(promotion.id, {
      status: 'ended',
      updated_at: new Date().toISOString()
    });

    const updated = await promotionWindowDAO.findById(promotion.id);
    return successResponse(res, updated, '促销已结束');
  } catch (err) {
    await logException(req, err, 'end_promotion_failed');
    next(err);
  }
});

module.exports = router;
