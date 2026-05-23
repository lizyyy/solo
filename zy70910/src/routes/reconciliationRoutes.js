const express = require('express');
const router = express.Router();
const ReconciliationService = require('../services/reconciliationService');
const ReconciliationTask = require('../models/reconciliationTask');
const Order = require('../models/order');
const PaymentRecord = require('../models/paymentRecord');
const ChargerLog = require('../models/chargerLog');
const { validate, schemas } = require('../middleware/validator');
const { AppError } = require('../middleware/errorHandler');

router.post('/', validate(schemas.createTask), async (req, res, next) => {
  try {
    const { name, dateRange } = req.body;
    const result = await ReconciliationService.createReconciliationTask(name, dateRange);

    res.status(201).json({
      success: true,
      message: '对账任务创建成功',
      data: {
        taskId: result.taskId,
        task: result.task,
        traceId: result.traceId
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    ReconciliationTask.findAll((err, tasks) => {
      if (err) {
        return next(new AppError('获取任务列表失败', 500));
      }

      const formattedTasks = tasks.map(task => ({
        ...task,
        statistics: task.statistics ? JSON.parse(task.statistics) : null
      }));

      res.status(200).json({
        success: true,
        message: '获取任务列表成功',
        data: {
          tasks: formattedTasks,
          total: formattedTasks.length
        }
      });
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:taskId', async (req, res, next) => {
  try {
    const { taskId } = req.params;

    ReconciliationTask.findById(taskId, (err, task) => {
      if (err) {
        return next(new AppError('获取任务详情失败', 500));
      }

      if (!task) {
        return next(new AppError('任务不存在', 404));
      }

      res.status(200).json({
        success: true,
        message: '获取任务详情成功',
        data: {
          ...task,
          statistics: task.statistics ? JSON.parse(task.statistics) : null
        }
      });
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:taskId/execute', validate(schemas.executeReconciliation), async (req, res, next) => {
  try {
    const { taskId } = req.params;

    ReconciliationTask.findById(taskId, async (err, task) => {
      if (err) {
        return next(new AppError('获取任务失败', 500));
      }

      if (!task) {
        return next(new AppError('任务不存在', 404));
      }

      Order.findAll(async (orderErr, orders) => {
        if (orderErr) {
          return next(new AppError('获取订单数据失败', 500));
        }

        PaymentRecord.findAll(async (paymentErr, payments) => {
          if (paymentErr) {
            return next(new AppError('获取支付数据失败', 500));
          }

          ChargerLog.findAll(async (logErr, logs) => {
            if (logErr) {
              return next(new AppError('获取充电日志失败', 500));
            }

            try {
              const result = await ReconciliationService.detectDiscrepancies(
                taskId,
                orders,
                payments,
                logs
              );

              ReconciliationTask.updateStatus(taskId, 'COMPLETED', (updateErr) => {
                if (updateErr) {
                  console.warn('更新任务状态失败:', updateErr);
                }
              });

              res.status(200).json({
                success: true,
                message: '对账执行完成',
                data: {
                  taskId,
                  discrepancyCount: result.discrepancies.length,
                  discrepancies: result.discrepancies
                }
              });
            } catch (detectErr) {
              next(detectErr);
            }
          });
        });
      });
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
