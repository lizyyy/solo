export class RateLimiter {
  private maxRequestsPerSecond: number;
  private tokens: number;
  private lastRefillTime: number;
  private tokenInterval: number;

  constructor(maxRequestsPerSecond: number = 100) {
    this.maxRequestsPerSecond = maxRequestsPerSecond;
    this.tokens = maxRequestsPerSecond;
    this.lastRefillTime = Date.now();
    this.tokenInterval = 1000 / maxRequestsPerSecond;
  }

  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillTime;
    
    if (elapsed >= this.tokenInterval) {
      const tokensToAdd = Math.floor(elapsed / this.tokenInterval);
      this.tokens = Math.min(this.maxRequestsPerSecond, this.tokens + tokensToAdd);
      this.lastRefillTime = now - (elapsed % this.tokenInterval);
    }
  }

  public async acquire(): Promise<void> {
    this.refillTokens();

    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    const waitTime = this.tokenInterval * (1 + Math.floor((Date.now() - this.lastRefillTime) / this.tokenInterval));
    
    return new Promise((resolve) => {
      setTimeout(() => {
        this.refillTokens();
        this.tokens--;
        resolve();
      }, Math.max(1, waitTime));
    });
  }

  public async acquireWithDelay<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    return fn();
  }

  public getStats(): { 
    tokens: number; 
    maxRequestsPerSecond: number;
    tokenInterval: number;
  } {
    return {
      tokens: this.tokens,
      maxRequestsPerSecond: this.maxRequestsPerSecond,
      tokenInterval: this.tokenInterval
    };
  }

  public setRateLimit(maxRequestsPerSecond: number): void {
    this.maxRequestsPerSecond = maxRequestsPerSecond;
    this.tokenInterval = 1000 / maxRequestsPerSecond;
    this.tokens = Math.min(this.tokens, maxRequestsPerSecond);
  }
}
