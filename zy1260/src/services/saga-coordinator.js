const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const WarehouseService = require('./warehouse-service');
const AccountingService = require('./accounting-service');
const LogisticsService = require('./logistics-service');
const FailureInjector = require('../utils/failure-injector');
const TimelineManager = require('../utils/timeline');
const RetryManager = require('../utils/retry-manager');

const TRANSACTION_STATES = {
  INIT: 'INIT',
  PREPARING: 'PREPARING',
  PREPARED: 'PREPARED',
  CONFIRMING: 'CONFIRMING',
  CONFIRMED: 'CONFIRMED',
  CANCELLING: 'CANCELLING',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED'
};

const STEPS = {
  WAREHOUSE_PREPARE: 'WAREHOUSE_PREPARE',
  ACCOUNT_PREPARE: 'ACCOUNT_PREPARE',
  LOGISTICS_PREPARE: 'LOGISTICS_PREPARE',
  WAREHOUSE_CONFIRM: 'WAREHOUSE_CONFIRM',
  ACCOUNT_CONFIRM: 'ACCOUNT_CONFIRM',
  LOGISTICS_CONFIRM: 'LOGISTICS_CONFIRM',
  WAREHOUSE_CANCEL: 'WAREHOUSE_CANCEL',
  ACCOUNT_CANCEL: 'ACCOUNT_CANCEL',
  LOGISTICS_CANCEL: 'LOGISTICS_CANCEL'
};

class SagaCoordinator {
  constructor() {
    this.transactionStates = TRANSACTION_STATES;
    this.steps = STEPS;
  }

  createTransaction(payload, idempotencyKey = null) {
    const transactionId = uuidv4();
    
    db.prepare(`
      INSERT INTO transactions (id, business_type, status, payload, idempotency_key, created_at, updated_at)
      VALUES (?, 'TRANSFER', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(transactionId, TRANSACTION_STATES.INIT, JSON.stringify(payload), idempotencyKey);

    TimelineManager.record(transactionId, 'TRANSACTION_CREATE', 'START', '创建跨仓调拨事务');

    return {
      transactionId,
      status: TRANSACTION_STATES.INIT,
      payload
    };
  }

  updateTransactionStatus(transactionId, status) {
    db.prepare(`
      UPDATE transactions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(status, transactionId);
  }

  getTransaction(transactionId) {
    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId);
    if (!tx) return null;
    
    return {
      ...tx,
      payload: JSON.parse(tx.payload)
    };
  }

  async executeWithRetry(transactionId, step, operation, maxRetries = 3) {
    let attempt = 0;
    
    while (attempt < maxRetries) {
      attempt++;
      
      TimelineManager.record(transactionId, step, 'START', `第 ${attempt} 次尝试执行 ${step}`);
      
      try {
        const injectionResult = FailureInjector.simulate(step);
        
        if (!injectionResult.proceed) {
          if (injectionResult.action === 'timeout') {
            TimelineManager.record(transactionId, step, 'FAILED', `${step} 模拟超时`);
            RetryManager.recordRetry(transactionId, step, attempt, 'FAILED_TIMEOUT');
            
            if (attempt < maxRetries) {
              TimelineManager.record(transactionId, step, 'RETRY', `准备重试 ${step}`);
              continue;
            }
            throw new Error(injectionResult.message);
          }
          
          TimelineManager.record(transactionId, step, 'FAILED', `${step} 模拟失败`);
          RetryManager.recordRetry(transactionId, step, attempt, 'FAILED_ERROR');
          throw new Error(injectionResult.message);
        }

        const result = await operation();
        TimelineManager.record(transactionId, step, 'SUCCESS', `${step} 执行成功`);
        RetryManager.recordRetry(transactionId, step, attempt, 'SUCCESS');
        
        return result;
      } catch (error) {
        TimelineManager.record(transactionId, step, 'FAILED', `${step} 执行失败: ${error.message}`);
        RetryManager.recordRetry(transactionId, step, attempt, 'FAILED_ERROR');
        
        if (attempt < maxRetries) {
          TimelineManager.record(transactionId, step, 'RETRY', `准备重试 ${step}`);
          continue;
        }
        
        throw error;
      }
    }
  }

  async preparePhase(transactionId, payload) {
    this.updateTransactionStatus(transactionId, TRANSACTION_STATES.PREPARING);
    TimelineManager.record(transactionId, 'PREPARE_PHASE', 'START', '开始 Prepare 阶段');

    const preparedSteps = [];

    try {
      const warehouseResult = await this.executeWithRetry(
        transactionId,
        STEPS.WAREHOUSE_PREPARE,
        () => WarehouseService.prepare(
          transactionId,
          payload.sku,
          payload.fromLocation,
          payload.toLocation,
          payload.quantity
        )
      );
      preparedSteps.push({ step: STEPS.WAREHOUSE_PREPARE, result: warehouseResult });

      const accountResult = await this.executeWithRetry(
        transactionId,
        STEPS.ACCOUNT_PREPARE,
        () => AccountingService.prepare(
          transactionId,
          payload.payerAccount,
          payload.amount
        )
      );
      preparedSteps.push({ step: STEPS.ACCOUNT_PREPARE, result: accountResult });

      const logisticsResult = await this.executeWithRetry(
        transactionId,
        STEPS.LOGISTICS_PREPARE,
        () => LogisticsService.prepare(
          transactionId,
          payload.fromAddress,
          payload.toAddress,
          { sku: payload.sku, quantity: payload.quantity }
        )
      );
      preparedSteps.push({ step: STEPS.LOGISTICS_PREPARE, result: logisticsResult });

      this.updateTransactionStatus(transactionId, TRANSACTION_STATES.PREPARED);
      TimelineManager.record(transactionId, 'PREPARE_PHASE', 'SUCCESS', 'Prepare 阶段完成');

      return {
        success: true,
        status: TRANSACTION_STATES.PREPARED,
        preparedSteps,
        shipmentNo: logisticsResult.shipmentNo
      };
    } catch (error) {
      TimelineManager.record(transactionId, 'PREPARE_PHASE', 'FAILED', `Prepare 阶段失败: ${error.message}`);
      
      await this.compensatePrepare(transactionId, payload, preparedSteps);
      
      this.updateTransactionStatus(transactionId, TRANSACTION_STATES.FAILED);
      TimelineManager.record(transactionId, 'TRANSACTION', 'FAILED', `事务失败: ${error.message}`);

      return {
        success: false,
        status: TRANSACTION_STATES.FAILED,
        error: error.message,
        compensatedSteps: preparedSteps
      };
    }
  }

  async compensatePrepare(transactionId, payload, preparedSteps) {
    TimelineManager.record(transactionId, 'COMPENSATION', 'START', '开始补偿 Prepare 阶段');

    for (const prepared of preparedSteps.reverse()) {
      try {
        switch (prepared.step) {
          case STEPS.LOGISTICS_PREPARE:
            await this.executeWithRetry(
              transactionId,
              STEPS.LOGISTICS_CANCEL,
              () => LogisticsService.cancel(
                transactionId,
                prepared.result.shipmentNo
              )
            );
            break;

          case STEPS.ACCOUNT_PREPARE:
            await this.executeWithRetry(
              transactionId,
              STEPS.ACCOUNT_CANCEL,
              () => AccountingService.cancel(
                transactionId,
                payload.payerAccount,
                payload.amount
              )
            );
            break;

          case STEPS.WAREHOUSE_PREPARE:
            await this.executeWithRetry(
              transactionId,
              STEPS.WAREHOUSE_CANCEL,
              () => WarehouseService.cancel(
                transactionId,
                payload.sku,
                payload.fromLocation,
                payload.toLocation,
                payload.quantity
              )
            );
            break;
        }
      } catch (compError) {
        TimelineManager.record(
          transactionId,
          'COMPENSATION',
          'FAILED',
          `补偿 ${prepared.step} 失败: ${compError.message}`
        );
      }
    }

    TimelineManager.record(transactionId, 'COMPENSATION', 'SUCCESS', '补偿完成');
  }

  async confirmPhase(transactionId, payload, shipmentNo) {
    this.updateTransactionStatus(transactionId, TRANSACTION_STATES.CONFIRMING);
    TimelineManager.record(transactionId, 'CONFIRM_PHASE', 'START', '开始 Confirm 阶段');

    try {
      await this.executeWithRetry(
        transactionId,
        STEPS.WAREHOUSE_CONFIRM,
        () => WarehouseService.confirm(
          transactionId,
          payload.sku,
          payload.fromLocation,
          payload.toLocation,
          payload.quantity
        )
      );

      await this.executeWithRetry(
        transactionId,
        STEPS.ACCOUNT_CONFIRM,
        () => AccountingService.confirm(
          transactionId,
          payload.payerAccount,
          payload.payeeAccount,
          payload.amount
        )
      );

      await this.executeWithRetry(
        transactionId,
        STEPS.LOGISTICS_CONFIRM,
        () => LogisticsService.confirm(
          transactionId,
          shipmentNo
        )
      );

      this.updateTransactionStatus(transactionId, TRANSACTION_STATES.CONFIRMED);
      TimelineManager.record(transactionId, 'CONFIRM_PHASE', 'SUCCESS', 'Confirm 阶段完成');
      TimelineManager.record(transactionId, 'TRANSACTION', 'SUCCESS', '事务执行成功');

      return {
        success: true,
        status: TRANSACTION_STATES.CONFIRMED,
        message: '跨仓调拨事务执行成功'
      };
    } catch (error) {
      TimelineManager.record(transactionId, 'CONFIRM_PHASE', 'FAILED', `Confirm 阶段失败: ${error.message}`);
      
      this.updateTransactionStatus(transactionId, TRANSACTION_STATES.FAILED);
      TimelineManager.record(transactionId, 'TRANSACTION', 'FAILED', `事务失败，需要人工介入: ${error.message}`);

      return {
        success: false,
        status: TRANSACTION_STATES.FAILED,
        error: error.message,
        requiresManualIntervention: true
      };
    }
  }

  async cancelTransaction(transactionId, payload, shipmentNo) {
    this.updateTransactionStatus(transactionId, TRANSACTION_STATES.CANCELLING);
    TimelineManager.record(transactionId, 'CANCEL_PHASE', 'START', '开始 Cancel 阶段');

    try {
      await this.executeWithRetry(
        transactionId,
        STEPS.WAREHOUSE_CANCEL,
        () => WarehouseService.cancel(
          transactionId,
          payload.sku,
          payload.fromLocation,
          payload.toLocation,
          payload.quantity
        )
      );

      await this.executeWithRetry(
        transactionId,
        STEPS.ACCOUNT_CANCEL,
        () => AccountingService.cancel(
          transactionId,
          payload.payerAccount,
          payload.amount
        )
      );

      await this.executeWithRetry(
        transactionId,
        STEPS.LOGISTICS_CANCEL,
        () => LogisticsService.cancel(
          transactionId,
          shipmentNo
        )
      );

      this.updateTransactionStatus(transactionId, TRANSACTION_STATES.CANCELLED);
      TimelineManager.record(transactionId, 'CANCEL_PHASE', 'SUCCESS', 'Cancel 阶段完成');
      TimelineManager.record(transactionId, 'TRANSACTION', 'CANCELLED', '事务已取消');

      return {
        success: true,
        status: TRANSACTION_STATES.CANCELLED,
        message: '事务已成功取消'
      };
    } catch (error) {
      TimelineManager.record(transactionId, 'CANCEL_PHASE', 'FAILED', `Cancel 阶段失败: ${error.message}`);
      
      this.updateTransactionStatus(transactionId, TRANSACTION_STATES.FAILED);

      return {
        success: false,
        status: TRANSACTION_STATES.FAILED,
        error: error.message,
        requiresManualIntervention: true
      };
    }
  }

  async executeTransfer(payload, idempotencyKey = null) {
    const transaction = this.createTransaction(payload, idempotencyKey);
    const transactionId = transaction.transactionId;

    const prepareResult = await this.preparePhase(transactionId, payload);
    
    if (!prepareResult.success) {
      return {
        transactionId,
        ...prepareResult
      };
    }

    const confirmResult = await this.confirmPhase(
      transactionId,
      payload,
      prepareResult.shipmentNo
    );

    return {
      transactionId,
      ...confirmResult
    };
  }
}

module.exports = new SagaCoordinator();
