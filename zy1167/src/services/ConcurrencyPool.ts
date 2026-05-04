export class ConcurrencyPool {
  private maxConcurrency: number;
  private activeCount: number;
  private queue: Array<() => Promise<void>>;
  private resolveEmpty?: () => void;

  constructor(maxConcurrency: number = 10) {
    this.maxConcurrency = maxConcurrency;
    this.activeCount = 0;
    this.queue = [];
  }

  public async submit<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const wrappedTask = async () => {
        this.activeCount++;
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeCount--;
          this.processNext();
        }
      };

      if (this.activeCount < this.maxConcurrency) {
        wrappedTask();
      } else {
        this.queue.push(wrappedTask);
      }
    });
  }

  private processNext(): void {
    if (this.queue.length > 0 && this.activeCount < this.maxConcurrency) {
      const nextTask = this.queue.shift();
      if (nextTask) {
        nextTask();
      }
    } else if (this.queue.length === 0 && this.activeCount === 0 && this.resolveEmpty) {
      this.resolveEmpty();
    }
  }

  public async waitForAll(): Promise<void> {
    if (this.activeCount === 0 && this.queue.length === 0) {
      return;
    }

    return new Promise((resolve) => {
      this.resolveEmpty = resolve;
      
      if (this.activeCount === 0 && this.queue.length === 0) {
        this.processNext();
      }
    });
  }

  public getStats(): { active: number; queued: number; maxConcurrency: number } {
    return {
      active: this.activeCount,
      queued: this.queue.length,
      maxConcurrency: this.maxConcurrency
    };
  }

  public setMaxConcurrency(maxConcurrency: number): void {
    this.maxConcurrency = maxConcurrency;
    while (this.queue.length > 0 && this.activeCount < this.maxConcurrency) {
      this.processNext();
    }
  }
}
