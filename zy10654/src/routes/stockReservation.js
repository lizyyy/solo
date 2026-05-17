const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const stockReservationService = require('../services/stockReservationService');
const { ERROR_CODES } = require('../constants/status');

router.post('/create', async (req, res) => {
  try {
    const { productCode, memberNo, quantity } = req.body;
    
    if (!productCode || !memberNo) {
      return res.status(400).json({
        code: ERROR_CODES.PARAM_ERROR,
        message: '商品编码和会员编号不能为空'
      });
    }

    const result = await stockReservationService.createReservation(
      productCode,
      memberNo,
      quantity || 1,
      req.ip || 'unknown'
    );

    res.json({
      code: 0,
      message: '创建成功',
      data: result
    });
  } catch (error) {
    console.error('创建预占单失败:', error);
    res.status(error.code >= 1000 ? 400 : 500).json({
      code: error.code || ERROR_CODES.SYSTEM_ERROR,
      message: error.message || '系统错误'
    });
  }
});

router.post('/reserve', async (req, res) => {
  try {
    const { reservationNo } = req.body;
    
    if (!reservationNo) {
      return res.status(400).json({
        code: ERROR_CODES.PARAM_ERROR,
        message: '预占单号不能为空'
      });
    }

    const result = await stockReservationService.reserveStock(
      reservationNo,
      req.ip || 'unknown'
    );

    res.json({
      code: 0,
      message: '预占成功',
      data: result
    });
  } catch (error) {
    console.error('预占库存失败:', error);
    res.status(error.code >= 1000 ? 400 : 500).json({
      code: error.code || ERROR_CODES.SYSTEM_ERROR,
      message: error.message || '系统错误'
    });
  }
});

router.post('/release', async (req, res) => {
  try {
    const { reservationNo, releaseReasonCode, remark } = req.body;
    
    if (!reservationNo || !releaseReasonCode) {
      return res.status(400).json({
        code: ERROR_CODES.PARAM_ERROR,
        message: '预占单号和释放原因不能为空'
      });
    }

    const result = await stockReservationService.releaseStock(
      reservationNo,
      releaseReasonCode,
      remark || '',
      req.ip || 'unknown'
    );

    if (result.needManual) {
      return res.status(200).json({
        code: result.code,
        message: result.message,
        data: result,
        action: result.action
      });
    }

    res.json({
      code: 0,
      message: '释放成功',
      data: result
    });
  } catch (error) {
    console.error('释放库存失败:', error);
    res.status(error.code >= 1000 ? 400 : 500).json({
      code: error.code || ERROR_CODES.SYSTEM_ERROR,
      message: error.message || '系统错误'
    });
  }
});

router.post('/exchange', async (req, res) => {
  try {
    const { reservationNo } = req.body;
    
    if (!reservationNo) {
      return res.status(400).json({
        code: ERROR_CODES.PARAM_ERROR,
        message: '预占单号不能为空'
      });
    }

    const result = await stockReservationService.exchangeStock(
      reservationNo,
      req.ip || 'unknown'
    );

    res.json({
      code: 0,
      message: '兑换成功',
      data: result
    });
  } catch (error) {
    console.error('兑换失败:', error);
    res.status(error.code >= 1000 ? 400 : 500).json({
      code: error.code || ERROR_CODES.SYSTEM_ERROR,
      message: error.message || '系统错误'
    });
  }
});

router.get('/list', async (req, res) => {
  try {
    const { page, pageSize, status, memberNo, productCode, startDate, endDate } = req.query;
    
    const result = await stockReservationService.getReservationList({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
      status,
      memberNo,
      productCode,
      startDate,
      endDate
    });

    res.json({
      code: 0,
      message: 'success',
      data: result
    });
  } catch (error) {
    console.error('查询列表失败:', error);
    res.status(500).json({
      code: ERROR_CODES.SYSTEM_ERROR,
      message: '系统错误'
    });
  }
});

router.get('/detail/:reservationNo', async (req, res) => {
  try {
    const { reservationNo } = req.params;
    
    const detail = await stockReservationService.getReservationDetail(reservationNo);
    
    if (!detail) {
      return res.status(404).json({
        code: ERROR_CODES.RESERVATION_NOT_FOUND,
        message: '预占单不存在'
      });
    }

    res.json({
      code: 0,
      message: 'success',
      data: detail
    });
  } catch (error) {
    console.error('查询详情失败:', error);
    res.status(500).json({
      code: ERROR_CODES.SYSTEM_ERROR,
      message: '系统错误'
    });
  }
});

router.get('/history/:reservationNo', async (req, res) => {
  try {
    const { reservationNo } = req.params;
    
    const history = await stockReservationService.getReservationHistory(reservationNo);

    res.json({
      code: 0,
      message: 'success',
      data: history
    });
  } catch (error) {
    console.error('查询历史失败:', error);
    res.status(500).json({
      code: ERROR_CODES.SYSTEM_ERROR,
      message: '系统错误'
    });
  }
});

router.get('/export', async (req, res) => {
  try {
    const { status, memberNo, productCode, startDate, endDate } = req.query;
    
    const data = await stockReservationService.exportReservations({
      status,
      memberNo,
      productCode,
      startDate,
      endDate
    });

    const parser = new Parser();
    const csv = parser.parse(data);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=stock_reservations_${Date.now()}.csv`);
    
    res.send('\uFEFF' + csv);
  } catch (error) {
    console.error('导出失败:', error);
    res.status(500).json({
      code: ERROR_CODES.SYSTEM_ERROR,
      message: '系统错误'
    });
  }
});

module.exports = router;
