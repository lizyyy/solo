const https = require('https');
const http = require('http');
const url = require('url');
const cron = require('node-cron');
const config = require('../config');

class Scheduler {
  constructor(storage, signature, options = {}) {
    this.storage = storage;
    this.signature = signature;
    this.maxAttempts = options.maxAttempts || config.retry.maxAttempts;
    this.intervals = options.intervals || config.retry.intervals;
    this.cronExpression = options.cronExpression || config.retry.cronExpression;
    this.isRunning = false;
    this.cronJob = null;
    this.processing = false;
  }

  async deliverEvent(event) {
    const subscription = this.storage.getSubscriptionWithSecret(event.subscription_id);
    
    if (!subscription) {
      return {
        success: false,
        error: 'Subscription not found',
        statusCode: null
      };
    }

    if (!subscription.active) {
      return {
        success: false,
        error: 'Subscription is inactive',
        statusCode: null
      };
    }

    const headers = this.signature.generateRequestHeaders(
      subscription.secret,
      event.payload
    );

    headers['Content-Type'] = 'application/json';
    headers['X-Event-Id'] = event.id;
    headers['X-Event-Type'] = event.event_type;

    if (event.idempotency_key) {
      headers['X-Idempotency-Key'] = event.idempotency_key;
    }

    return this._sendHttpRequest(subscription.endpoint, event.payload, headers);
  }

  _sendHttpRequest(endpoint, payload, headers) {
    return new Promise((resolve) => {
      const parsedUrl = url.parse(endpoint);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.path || '/',
        method: 'POST',
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(JSON.stringify(payload))
        },
        timeout: 10000
      };

      const req = client.request(options, (res) => {
        let body = '';

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          const isSuccess = res.statusCode >= 200 && res.statusCode < 300;

          resolve({
            success: isSuccess,
            statusCode: res.statusCode,
            responseBody: body,
            error: isSuccess ? null : `HTTP ${res.statusCode}`
          });
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          statusCode: null,
          responseBody: null,
          error: error.message
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          statusCode: null,
          responseBody: null,
          error: 'Request timeout'
        });
      });

      req.write(JSON.stringify(payload));
      req.end();
    });
  }

  async processEvent(event) {
    const logs = this.storage.getDeliveryLogs(event.id);
    const attempt = logs.length + 1;

    if (attempt > this.maxAttempts) {
      this.storage.updateEventStatus(event.id, 'failed');
      this.storage.createDeadLetter(event.id, event.subscription_id, 'Max retries exceeded');
      return;
    }

    const result = await this.deliverEvent(event);

    this.storage.createDeliveryLog(
      event.id,
      event.subscription_id,
      attempt,
      result.success ? 'success' : 'failed',
      result.statusCode,
      result.responseBody ? { body: result.responseBody } : null,
      result.error
    );

    if (result.success) {
      this.storage.updateEventStatus(event.id, 'delivered');
    } else {
      if (attempt >= this.maxAttempts) {
        this.storage.updateEventStatus(event.id, 'failed');
        this.storage.createDeadLetter(event.id, event.subscription_id, result.error);
      } else {
        this.storage.updateEventStatus(event.id, 'failed');
      }
    }
  }

  async processPendingEvents() {
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      const events = this.storage.getRetryableEvents();

      for (const event of events) {
        const logs = this.storage.getDeliveryLogs(event.id);
        const attempt = logs.length;

        if (attempt >= this.maxAttempts && event.status !== 'pending') {
          continue;
        }

        if (attempt > 0) {
          const lastLog = logs[logs.length - 1];
          const interval = this.intervals[attempt - 1] || this.intervals[this.intervals.length - 1];
          const now = Math.floor(Date.now() / 1000);
          const nextAttemptTime = lastLog.delivered_at + Math.floor(interval / 1000);

          if (now < nextAttemptTime) {
            continue;
          }
        }

        await this.processEvent(event);
      }
    } finally {
      this.processing = false;
    }
  }

  start() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    this.cronJob = cron.schedule(this.cronExpression, () => {
      this.processPendingEvents();
    });

    console.log(`Scheduler started with cron: ${this.cronExpression}`);
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('Scheduler stopped');
  }
}

module.exports = Scheduler;