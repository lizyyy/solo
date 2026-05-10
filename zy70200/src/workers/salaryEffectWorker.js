const { Worker } = require('bullmq');
const { connection, salaryEffectQueue } = require('../config/queue');
const { Employee, SalaryAdjustment } = require('../models');
const { SalaryAdjustmentStatus, ProbationStatus } = require('../constants');
const ProbationHistoryService = require('../services/probationHistoryService');

class SalaryEffectWorker {
  constructor() {
    this.worker = new Worker(
      'salary-effect',
      async (job) => {
        return await this.processJob(job);
      },
      { connection }
    );

    this.worker.on('completed', (job) => {
      console.log(`薪资生效任务完成: Job ${job.id}`);
    });

    this.worker.on('failed', async (job, err) => {
      console.error(`薪资生效任务失败: Job ${job.id}, 错误: ${err.message}`);
      await this.handleFailure(job, err);
    });

    console.log('薪资生效 Worker 已启动');
  }

  async processJob(job) {
    const { adjustmentId, employeeId, probationPlanId } = job.data;

    job.log(`开始处理薪资生效任务: adjustmentId=${adjustmentId}`);
    job.updateProgress(10);

    const adjustment = await SalaryAdjustment.findByPk(adjustmentId);
    if (!adjustment) {
      throw new Error(`未找到薪资调整记录: ${adjustmentId}`);
    }

    if (adjustment.status === SalaryAdjustmentStatus.EFFECTIVE) {
      job.log(`薪资调整已生效，跳过: ${adjustmentId}`);
      return { status: 'already_effective', adjustmentId };
    }

    if (adjustment.status !== SalaryAdjustmentStatus.APPROVED) {
      throw new Error(`薪资调整状态不正确: ${adjustment.status}，仅 APPROVED 状态可生效`);
    }

    job.updateProgress(30);
    job.log('验证员工信息');

    const employee = await Employee.findByPk(employeeId);
    if (!employee) {
      throw new Error(`未找到员工: ${employeeId}`);
    }

    if (!employee.isActive) {
      throw new Error(`员工已离职，无法调整薪资: ${employeeId}`);
    }

    job.updateProgress(50);
    job.log('更新员工薪资');

    const previousSalary = employee.currentSalary;
    employee.currentSalary = adjustment.newSalary;
    await employee.save();

    job.updateProgress(70);
    job.log('更新薪资调整记录状态');

    adjustment.status = SalaryAdjustmentStatus.EFFECTIVE;
    adjustment.effectiveAt = new Date();
    adjustment.taskId = job.id;
    await adjustment.save();

    job.updateProgress(80);
    job.log('记录薪资调整历史');

    await ProbationHistoryService.recordSalaryAdjustment(
      probationPlanId,
      employeeId,
      adjustmentId,
      previousSalary,
      adjustment.newSalary
    );

    job.updateProgress(100);
    job.log('薪资生效任务完成');

    return {
      status: 'success',
      adjustmentId,
      employeeId,
      previousSalary: parseFloat(previousSalary),
      newSalary: parseFloat(adjustment.newSalary),
      effectiveAt: adjustment.effectiveAt.toISOString()
    };
  }

  async handleFailure(job, error) {
    const { adjustmentId } = job.data;
    
    try {
      const adjustment = await SalaryAdjustment.findByPk(adjustmentId);
      if (adjustment) {
        await ProbationHistoryService.recordAction(
          adjustment.probationPlanId,
          adjustment.employeeId,
          'SALARY_EFFECT_FAILED',
          null,
          'SYSTEM',
          `薪资生效任务失败: ${error.message}`,
          {
            jobId: job.id,
            error: error.message,
            stack: error.stack,
            attempt: job.attemptsMade,
            failedAt: new Date().toISOString()
          }
        );
      }
    } catch (logError) {
      console.error('记录薪资生效失败历史时出错:', logError.message);
    }
  }

  static async scheduleSalaryEffect(adjustmentId, employeeId, probationPlanId, effectiveDate) {
    const delay = Math.max(0, new Date(effectiveDate) - new Date());
    
    const job = await salaryEffectQueue.add(
      'effect-salary',
      {
        adjustmentId,
        employeeId,
        probationPlanId
      },
      {
        delay,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 60000
        },
        removeOnComplete: true,
        removeOnFail: false
      }
    );

    return job;
  }

  close() {
    if (this.worker) {
      this.worker.close();
    }
  }
}

module.exports = SalaryEffectWorker;
