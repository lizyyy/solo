"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackgroundJobService = void 0;
const helper_1 = require("../database/helper");
class BackgroundJobService {
    constructor(db, snapshotService) {
        this.schedulerInterval = null;
        this.schedulerRunning = false;
        this.db = db;
        this.snapshotService = snapshotService;
    }
    async createSnapshotJob(groupCreditId, snapshotTime) {
        const id = helper_1.DatabaseHelper.generateId();
        const now = helper_1.DatabaseHelper.now();
        const data = {
            groupCreditId,
            snapshotTime: snapshotTime?.toISOString()
        };
        await this.db.run(`INSERT INTO background_jobs (id, job_type, data, status, retry_count, max_retries, created_at, updated_at)
       VALUES (?, 'create_snapshot', ?, 'pending', 0, 3, ?, ?)`, [id, JSON.stringify(data), now, now]);
        return this.getJobById(id);
    }
    async getJobById(id) {
        const row = await this.db.get(`SELECT * FROM background_jobs WHERE id = ?`, [id]);
        if (!row) {
            throw new Error('任务不存在');
        }
        return this.mapToBackgroundJob(row);
    }
    async getPendingJobs() {
        const rows = await this.db.all(`SELECT * FROM background_jobs 
       WHERE status IN ('pending', 'failed') AND retry_count < max_retries
       ORDER BY created_at ASC`, []);
        return rows.map(row => this.mapToBackgroundJob(row));
    }
    async runPendingJobs() {
        const jobs = await this.getPendingJobs();
        const results = [];
        for (const job of jobs) {
            try {
                await this.executeJob(job);
                results.push({
                    jobId: job.id,
                    jobType: job.jobType,
                    status: 'success'
                });
            }
            catch (error) {
                results.push({
                    jobId: job.id,
                    jobType: job.jobType,
                    status: 'failed',
                    message: error instanceof Error ? error.message : '未知错误'
                });
            }
        }
        return {
            total: jobs.length,
            success: results.filter(r => r.status === 'success').length,
            failed: results.filter(r => r.status === 'failed').length,
            details: results
        };
    }
    async executeJob(job) {
        const now = helper_1.DatabaseHelper.now();
        await this.db.run(`UPDATE background_jobs SET status = 'running', updated_at = ? WHERE id = ?`, [now, job.id]);
        try {
            if (job.jobType === 'create_snapshot') {
                await this.executeSnapshotJob(job.data);
            }
            else {
                throw new Error(`未知的任务类型: ${job.jobType}`);
            }
            await this.db.run(`UPDATE background_jobs SET status = 'success', updated_at = ? WHERE id = ?`, [helper_1.DatabaseHelper.now(), job.id]);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            const newRetryCount = job.retryCount + 1;
            const finalStatus = newRetryCount >= job.maxRetries ? 'failed' : 'failed';
            await this.db.run(`UPDATE background_jobs 
         SET status = ?, failure_reason = ?, retry_count = ?, updated_at = ? 
         WHERE id = ?`, [finalStatus, errorMessage, newRetryCount, helper_1.DatabaseHelper.now(), job.id]);
            throw error;
        }
    }
    async executeSnapshotJob(data) {
        const { groupCreditId, snapshotTime } = data;
        if (!groupCreditId) {
            throw new Error('缺少集团额度ID');
        }
        const snapshotDate = snapshotTime ? new Date(snapshotTime) : undefined;
        await this.snapshotService.createSnapshot(groupCreditId, snapshotDate);
    }
    startScheduler(intervalMs = 60000) {
        if (this.schedulerRunning) {
            return;
        }
        this.schedulerRunning = true;
        console.log('后台任务调度器已启动');
        this.schedulerInterval = setInterval(async () => {
            try {
                const result = await this.runPendingJobs();
                if (result.total > 0) {
                    console.log(`执行了 ${result.total} 个任务，成功 ${result.success}，失败 ${result.failed}`);
                }
            }
            catch (error) {
                console.error('后台任务执行出错:', error);
            }
        }, intervalMs);
    }
    stopScheduler() {
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
            this.schedulerInterval = null;
            this.schedulerRunning = false;
            console.log('后台任务调度器已停止');
        }
    }
    mapToBackgroundJob(row) {
        return {
            id: row.id,
            jobType: row.job_type,
            data: JSON.parse(row.data),
            status: row.status,
            retryCount: row.retry_count,
            maxRetries: row.max_retries,
            failureReason: row.failure_reason,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }
}
exports.BackgroundJobService = BackgroundJobService;
