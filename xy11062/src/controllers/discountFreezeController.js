const discountFreezeService = require('../services/discountFreezeService');

class DiscountFreezeController {
  async createFreeze(req, res) {
    try {
      const { orderId, couponId, userId, deviceId, stationId, freezeAmount, freezeReason } = req.body;

      if (!orderId || !couponId || !userId || !deviceId || !stationId || !freezeAmount) {
        return res.status(400).json({
          success: false,
          errorCode: 'MISSING_PARAMS',
          errorMessage: '缺少必要参数',
          requiredParams: ['orderId', 'couponId', 'userId', 'deviceId', 'stationId', 'freezeAmount']
        });
      }

      const result = await discountFreezeService.processDiscountFreeze(req.body);

      if (!result.success) {
        return res.status(422).json(result);
      }

      res.status(201).json(result);
    } catch (error) {
      console.error('创建优惠冻结失败:', error);
      res.status(500).json({
        success: false,
        errorCode: 'INTERNAL_ERROR',
        errorMessage: '服务器内部错误，请稍后重试',
        action: '请联系技术支持人员'
      });
    }
  }

  async getFreezeList(req, res) {
    try {
      const { status, userId, stationId, page, pageSize } = req.query;
      const result = await discountFreezeService.getFreezeList({
        status,
        userId,
        stationId,
        page: page ? parseInt(page) : 1,
        pageSize: pageSize ? parseInt(pageSize) : 10
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('获取优惠冻结列表失败:', error);
      res.status(500).json({
        success: false,
        errorCode: 'INTERNAL_ERROR',
        errorMessage: '服务器内部错误'
      });
    }
  }

  async getExceptionList(req, res) {
    try {
      const { handleStatus, exceptionType, stationId, page, pageSize } = req.query;
      const result = await discountFreezeService.getExceptionList({
        handleStatus,
        exceptionType,
        stationId,
        page: page ? parseInt(page) : 1,
        pageSize: pageSize ? parseInt(pageSize) : 10
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('获取异常列表失败:', error);
      res.status(500).json({
        success: false,
        errorCode: 'INTERNAL_ERROR',
        errorMessage: '服务器内部错误'
      });
    }
  }

  async auditFreeze(req, res) {
    try {
      const { freezeId } = req.params;
      const { status, operatorId, operatorName, auditRemark } = req.body;

      if (!status || !operatorId || !operatorName) {
        return res.status(400).json({
          success: false,
          errorCode: 'MISSING_PARAMS',
          errorMessage: '缺少必要参数'
        });
      }

      const result = await discountFreezeService.auditFreeze(freezeId, req.body);

      res.json({
        success: true,
        data: result,
        message: status === 'approved' ? '优惠冻结已批准' : '优惠冻结已驳回'
      });
    } catch (error) {
      console.error('审核优惠冻结失败:', error);
      res.status(500).json({
        success: false,
        errorCode: 'INTERNAL_ERROR',
        errorMessage: '服务器内部错误'
      });
    }
  }

  async handleException(req, res) {
    try {
      const { exceptionId } = req.params;
      const { handleStatus, handlerId, handlerName, handleRemark } = req.body;

      if (!handleStatus || !handlerId || !handlerName) {
        return res.status(400).json({
          success: false,
          errorCode: 'MISSING_PARAMS',
          errorMessage: '缺少必要参数'
        });
      }

      const result = await discountFreezeService.handleException(exceptionId, req.body);

      res.json({
        success: true,
        data: result,
        message: handleStatus === 'resolved' ? '异常已解决' : '异常已驳回'
      });
    } catch (error) {
      console.error('处理异常失败:', error);
      res.status(500).json({
        success: false,
        errorCode: 'INTERNAL_ERROR',
        errorMessage: '服务器内部错误'
      });
    }
  }

  async getStats(req, res) {
    try {
      const db = require('../config/database');

      const [freezeStats, exceptionStats] = await Promise.all([
        new Promise((resolve, reject) => {
          db.all('SELECT status, COUNT(*) as count FROM discount_freezes GROUP BY status', (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        }),
        new Promise((resolve, reject) => {
          db.all('SELECT handle_status as status, COUNT(*) as count FROM discount_exceptions GROUP BY handle_status', (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        })
      ]);

      res.json({
        success: true,
        data: {
          freezes: freezeStats,
          exceptions: exceptionStats
        }
      });
    } catch (error) {
      console.error('获取统计数据失败:', error);
      res.status(500).json({
        success: false,
        errorCode: 'INTERNAL_ERROR',
        errorMessage: '服务器内部错误'
      });
    }
  }
}

module.exports = new DiscountFreezeController();
