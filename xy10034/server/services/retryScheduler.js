const cron = require('node-cron');
const RetryHandler = require('../utils/retryHandler');
const LogService = require('./logService');

class RetryScheduler {
    constructor() {
        this.isRunning = false;
        this.job = null;
    }

    start() {
        if (this.isRunning) {
            console.log('重试调度器已在运行');
            return;
        }

        console.log('启动重试调度器 - 每 1 分钟执行一次');
        
        this.job = cron.schedule('* * * * *', async () => {
            if (this.isProcessing) {
                return;
            }
            
            await this.processFailedOperations();
        });

        this.isRunning = true;
    }

    stop() {
        if (this.job) {
            this.job.stop();
            this.job = null;
        }
        this.isRunning = false;
        console.log('重试调度器已停止');
    }

    async processFailedOperations() {
        this.isProcessing = true;
        
        try {
            const pendingOps = await RetryHandler.getPendingOperations();
            
            if (pendingOps.length === 0) {
                return;
            }

            console.log(`发现 ${pendingOps.length} 个待重试的操作`);

            for (const operation of pendingOps) {
                await this.retryOperation(operation);
            }
        } catch (error) {
            console.error('处理失败操作时出错:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    async retryOperation(operation) {
        console.log(`重试操作: ${operation.id} (类型: ${operation.operation_type})`);
        
        try {
            await RetryHandler.updateOperationForRetry(operation.id);

            const data = JSON.parse(operation.data);
            
            let result;
            switch (operation.operation_type) {
                case 'create_log':
                    result = await LogService.createLog(data);
                    break;
                
                default:
                    throw new Error(`未知的操作类型: ${operation.operation_type}`);
            }

            await RetryHandler.markOperationSuccess(operation.id);
            console.log(`操作 ${operation.id} 重试成功`);
            
            return result;
        } catch (error) {
            console.error(`操作 ${operation.id} 重试失败:`, error.message);
            await RetryHandler.markOperationFailed(operation.id, error.message);
            throw error;
        }
    }
}

module.exports = new RetryScheduler();
