import schedule from 'node-schedule';
import { compensationService } from './CompensationService';

export class TaskScheduler {
  private job: schedule.Job | null = null;
  private isRunning: boolean = false;

  start(intervalMinutes: number = 5): void {
    if (this.job) {
      return;
    }

    const cronRule = `*/${intervalMinutes} * * * *`;
    this.job = schedule.scheduleJob(cronRule, async () => {
      await this.runTasks();
    });
  }

  stop(): void {
    if (this.job) {
      this.job.cancel();
      this.job = null;
    }
  }

  private async runTasks(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    try {
      await compensationService.executePendingTasks();
    } finally {
      this.isRunning = false;
    }
  }

  async runOnce(): Promise<void> {
    await this.runTasks();
  }

  isStarted(): boolean {
    return this.job !== null;
  }
}

export const taskScheduler = new TaskScheduler();
