const express = require('express');
const router = express.Router();
const { PriceVersionDAO, ProductDAO } = require('../database/dao');
const { validate } = require('../utils/validation');
const { successResponse, createdResponse, notFoundResponse, duplicateResponse, pendingReviewResponse } = require('../utils/response');
const { logException } = require('../middleware/exceptionHandler');

const priceVersionDAO = new PriceVersionDAO();
const productDAO = new ProductDAO();

router.post('/', validate('priceVersion'), async (req, res, next) => {
  try {
    const product = await productDAO.findByBarcode(req.body.barcode);
    if (!product) {
      return notFoundResponse(res, '商品不存在');
    }

    const existing = await priceVersionDAO.findByVersionCode(req.body.version_code);
    if (existing) {
      return duplicateResponse(res, '价签版本编码已存在');
    }

    req.body.status = 'pending';
    const result = await priceVersionDAO.create(req.body);
    const priceVersion = await priceVersionDAO.findById(result.lastID);
    return pendingReviewResponse(res, priceVersion, '价签版本创建成功，待审核生效');
  } catch (err) {
    await logException(req, err, 'create_price_version_failed');
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { status, barcode, price_type } = req.query;
    let where = '';
    let params = [];

    if (status) {
      where += 'status = ?';
      params.push(status);
    }

    if (barcode) {
      where += where ? ' AND ' : '';
      where += 'barcode = ?';
      params.push(barcode);
    }

    if (price_type) {
      where += where ? ' AND ' : '';
      where += 'price_type = ?';
      params.push(price_type);
    }

    const priceVersions = await priceVersionDAO.findAll(where, params);
    return successResponse(res, priceVersions);
  } catch (err) {
    await logException(req, err, 'list_price_versions_failed');
    next(err);
  }
});

router.get('/active', async (req, res, next) => {
  try {
    const activeVersions = await priceVersionDAO.findActiveVersions();
    return successResponse(res, activeVersions);
  } catch (err) {
    await logException(req, err, 'get_active_versions_failed');
    next(err);
  }
});

router.get('/:code', async (req, res, next) => {
  try {
    const priceVersion = await priceVersionDAO.findByVersionCode(req.params.code);
    if (!priceVersion) {
      return notFoundResponse(res, '价签版本不存在');
    }
    return successResponse(res, priceVersion);
  } catch (err) {
    await logException(req, err, 'get_price_version_failed');
    next(err);
  }
});

router.patch('/:code/activate', async (req, res, next) => {
  try {
    const priceVersion = await priceVersionDAO.findByVersionCode(req.params.code);
    if (!priceVersion) {
      return notFoundResponse(res, '价签版本不存在');
    }

    await priceVersionDAO.update(priceVersion.id, {
      status: 'active',
      updated_at: new Date().toISOString()
    });

    const updated = await priceVersionDAO.findById(priceVersion.id);
    return successResponse(res, updated, '价签版本已激活');
  } catch (err) {
    await logException(req, err, 'activate_price_version_failed');
    next(err);
  }
});

router.patch('/:code/deactivate', async (req, res, next) => {
  try {
    const priceVersion = await priceVersionDAO.findByVersionCode(req.params.code);
    if (!priceVersion) {
      return notFoundResponse(res, '价签版本不存在');
    }

    await priceVersionDAO.update(priceVersion.id, {
      status: 'inactive',
      updated_at: new Date().toISOString()
    });

    const updated = await priceVersionDAO.findById(priceVersion.id);
    return successResponse(res, updated, '价签版本已停用');
  } catch (err) {
    await logException(req, err, 'deactivate_price_version_failed');
    next(err);
  }
});

router.patch('/:code/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({
        success: false,
        status: 'validation_error',
        message: '状态参数必填'
      });
    }

    const priceVersion = await priceVersionDAO.findByVersionCode(req.params.code);
    if (!priceVersion) {
      return notFoundResponse(res, '价签版本不存在');
    }

    await priceVersionDAO.update(priceVersion.id, {
      status,
      updated_at: new Date().toISOString()
    });

    const updated = await priceVersionDAO.findById(priceVersion.id);
    
    let message = '状态更新成功';
    if (status === 'pending_review') message = '已提交复核';
    else if (status === 'rejected') message = '已驳回';
    else if (status === 'active') message = '已激活生效';
    
    return successResponse(res, updated, message);
  } catch (err) {
    await logException(req, err, 'update_price_version_status_failed');
    next(err);
  }
});

module.exports = router;
