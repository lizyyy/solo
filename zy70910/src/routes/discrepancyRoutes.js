const express = require('express');
const router = express.Router();
const Discrepancy = require('../models/discrepancy');
const ReconciliationService = require('../services/reconciliationService');
const { validate, schemas } = require('../middleware/validator');
const { AppError } = require('../middleware/errorHandler');

router.get('/', validate(schemas.getDiscrepancies), async (req, res, next) => {
  try {
    const { taskId, status, page, pageSize } = req.query;

    const callback = (err, discrepancies) => {
      if (err) {
        return next(new AppError('获取差异列表失败', 500));
      }

      const pageNum = parseInt(page);
      const size = parseInt(pageSize);
      const startIndex = (pageNum - 1) * size;
      const paginatedItems = discrepancies.slice(startIndex, startIndex + size);

      const formattedItems = paginatedItems.map(d => ({
        ...d,
        description: d.description ? JSON.parse(d.description) : null
      }));

      res.status(200).json({
        success: true,
        message: '获取差异列表成功',
        data: {
          items: formattedItems,
          total: discrepancies.length,
          page: pageNum,
          pageSize: size,
          totalPages: Math.ceil(discrepancies.length / size)
        }
      });
    };

    if (taskId) {
      Discrepancy.findByTaskId(taskId, callback);
    } else if (status) {
      Discrepancy.findByStatus(status, callback);
    } else {
      Discrepancy.findAll(callback);
    }
  } catch (error) {
    next(error);
  }
});

router.get('/:discrepancyId', validate(schemas.discrepancyId), async (req, res, next) => {
  try {
    const { discrepancyId } = req.params;

    Discrepancy.findById(discrepancyId, (err, discrepancy) => {
      if (err) {
        return next(new AppError('获取差异详情失败', 500));
      }

      if (!discrepancy) {
        return next(new AppError('差异记录不存在', 404));
      }

      res.status(200).json({
        success: true,
        message: '获取差异详情成功',
        data: {
          ...discrepancy,
          description: discrepancy.description ? JSON.parse(discrepancy.description) : null
        }
      });
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:discrepancyId/explain', validate(schemas.discrepancyId), async (req, res, next) => {
  try {
    const { discrepancyId } = req.params;

    Discrepancy.findById(discrepancyId, (err, discrepancy) => {
      if (err) {
        return next(new AppError('获取差异记录失败', 500));
      }

      if (!discrepancy) {
        return next(new AppError('差异记录不存在', 404));
      }

      const explanation = ReconciliationService.explainDiscrepancy(discrepancy);

      res.status(200).json({
        success: true,
        message: '获取差异解释成功',
        data: explanation
      });
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
