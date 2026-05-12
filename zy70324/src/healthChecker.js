const axios = require('axios');
const https = require('https');
const cron = require('node-cron');

class HealthChecker {
  constructor(config, db, notificationService) {
    this.config = config;
    this.db = db;
    this.notificationService = notificationService;
    this.cronJobs = new Map();
    this.lastNotifications = new Map();
  }

  async start() {
    const activeUrls = await this.db.getActiveCallbackUrls();
    for (const url of activeUrls) {
      this._scheduleCheck(url);
    }
    console.log(`Scheduled ${activeUrls.length} health check jobs`);
  }

  async stop() {
    for (const [id, job] of this.cronJobs) {
      if (job) {
        job.stop();
      }
    }
    this.cronJobs.clear();
  }

  async scheduleNewCallbackUrl(callbackUrl) {
    this._scheduleCheck(callbackUrl);
  }

  async unscheduleCallbackUrl(callbackUrlId) {
    const job = this.cronJobs.get(callbackUrlId);
    if (job) {
      job.stop();
      this.cronJobs.delete(callbackUrlId);
    }
  }

  _scheduleCheck(callbackUrl) {
    this.unscheduleCallbackUrl(callbackUrl.id);

    if (callbackUrl.status !== 'active') {
      return;
    }

    const frequencyMinutes = callbackUrl.frequencyMinutes || this.config.defaultFrequencyMinutes;
    const cronExpression = `*/${Math.min(frequencyMinutes, 59)} * * * *`;

    const job = cron.schedule(cronExpression, () => {
      this._checkCallbackUrl(callbackUrl.id).catch(err => {
        console.error(`Health check failed for ${callbackUrl.id}:`, err);
      });
    });

    this.cronJobs.set(callbackUrl.id, job);
  }

  async checkNow(callbackUrlId) {
    return this._checkCallbackUrl(callbackUrlId);
  }

  async _checkCallbackUrl(callbackUrlId) {
    const callbackUrl = await this.db.getCallbackUrlById(callbackUrlId);
    if (!callbackUrl || callbackUrl.status !== 'active') {
      return;
    }

    const customer = await this.db.getCustomerById(callbackUrl.customerId);
    const startTime = Date.now();
    let result = {
      callbackUrlId: callbackUrl.id,
      customerId: callbackUrl.customerId,
      url: callbackUrl.url,
      status: 'success',
      responseTimeMs: 0,
      httpStatusCode: null,
      certificateStatus: 'valid',
      certificateExpiryDate: null,
      errorMessage: null,
      isSlowResponse: false,
    };

    try {
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false,
      });

      const response = await axios.get(callbackUrl.url, {
        timeout: this.config.timeoutSeconds * 1000,
        httpsAgent,
        validateStatus: () => true,
      });

      const responseTime = Date.now() - startTime;
      result.responseTimeMs = responseTime;
      result.httpStatusCode = response.status;

      if (responseTime > this.config.slowResponseTimeMs) {
        result.isSlowResponse = true;
      }

      if (!this.config.successCodes.includes(response.status)) {
        result.status = 'failed';
        result.errorMessage = `HTTP status code ${response.status} is not in success list`;
      }

      if (callbackUrl.url.startsWith('https://')) {
        const certInfo = this._getCertificateInfo(callbackUrl.url);
        result.certificateStatus = certInfo.status;
        result.certificateExpiryDate = certInfo.expiryDate;

        if (certInfo.status === 'expired') {
          result.status = 'failed';
          result.errorMessage = result.errorMessage || 'SSL certificate has expired';
        } else if (certInfo.status === 'expiring_soon') {
          if (!this._hasRecentNotification(callbackUrl.id, 'certificate_expiry_warning')) {
            await this.notificationService.sendCertificateExpiryWarning(
              customer,
              callbackUrl,
              certInfo.daysRemaining
            );
            this._recordNotification(callbackUrl.id, 'certificate_expiry_warning');
          }
        }
      }

    } catch (error) {
      result.status = 'failed';
      result.errorMessage = error.message;
      result.responseTimeMs = Date.now() - startTime;

      if (callbackUrl.url.startsWith('https://')) {
        if (error.code === 'CERT_HAS_EXPIRED') {
          result.certificateStatus = 'expired';
          if (!this._hasRecentNotification(callbackUrl.id, 'certificate_expired')) {
            await this.notificationService.sendCertificateExpired(customer, callbackUrl);
            this._recordNotification(callbackUrl.id, 'certificate_expired');
          }
        } else if (error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || 
                   error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
          result.certificateStatus = 'invalid';
        }
      }
    }

    const healthCheck = await this.db.createHealthCheck(result);
    await this._processCheckResult(callbackUrl, customer, result);

    return healthCheck;
  }

  _getCertificateInfo(url) {
    const defaultResult = {
      status: 'valid',
      expiryDate: null,
      daysRemaining: null,
    };

    try {
      const parsedUrl = new URL(url);
      const options = {
        host: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        rejectUnauthorized: false,
      };

      return new Promise((resolve) => {
        const req = https.request(options, (res) => {
          const cert = res.socket.getPeerCertificate();
          if (cert && cert.valid_to) {
            const expiryDate = new Date(cert.valid_to);
            const now = new Date();
            const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

            let status = 'valid';
            if (daysRemaining <= 0) {
              status = 'expired';
            } else if (daysRemaining <= this.config.certificateExpiryWarningDays) {
              status = 'expiring_soon';
            }

            resolve({
              status,
              expiryDate: expiryDate.toISOString(),
              daysRemaining,
            });
          } else {
            resolve(defaultResult);
          }
        });

        req.on('error', () => resolve(defaultResult));
        req.end();
      });
    } catch (error) {
      return defaultResult;
    }
  }

  async _processCheckResult(callbackUrl, customer, result) {
    let updatedUrl = { ...callbackUrl };
    const updates = {};

    if (result.status === 'success') {
      updates.consecutiveFailures = 0;
      updates.lastSuccessAt = new Date().toISOString();
    } else {
      updates.consecutiveFailures = (callbackUrl.consecutiveFailures || 0) + 1;
      updates.lastFailureAt = new Date().toISOString();
    }

    const shouldNotify = 
      result.status === 'failed' && 
      updates.consecutiveFailures >= this.config.consecutiveFailuresToNotify &&
      !this._hasRecentNotification(callbackUrl.id, 'consecutive_failures');

    const shouldBlock = 
      updates.consecutiveFailures >= this.config.consecutiveFailuresToBlock &&
      callbackUrl.status === 'active';

    if (shouldNotify) {
      await this.notificationService.sendConsecutiveFailures(
        customer,
        callbackUrl,
        updates.consecutiveFailures
      );
      this._recordNotification(callbackUrl.id, 'consecutive_failures');
    }

    if (result.isSlowResponse && !this._hasRecentNotification(callbackUrl.id, 'slow_response')) {
      await this.notificationService.sendSlowResponse(
        customer,
        callbackUrl,
        result.responseTimeMs
      );
      this._recordNotification(callbackUrl.id, 'slow_response');
    }

    if (shouldBlock) {
      await this.notificationService.sendBlocked(customer, callbackUrl);
      updates.status = 'blocked';
      updates.lastBlockedAt = new Date().toISOString();
    }

    if (Object.keys(updates).length > 0) {
      updatedUrl = await this.db.updateCallbackUrl(callbackUrl.id, updates);
    }

    if (updates.status === 'blocked') {
      this.unscheduleCallbackUrl(callbackUrl.id);
    }

    return updatedUrl;
  }

  _hasRecentNotification(callbackUrlId, type) {
    const key = `${callbackUrlId}:${type}`;
    const lastTime = this.lastNotifications.get(key);
    if (!lastTime) return false;

    const cooldownMinutes = 60;
    return (Date.now() - lastTime) < cooldownMinutes * 60 * 1000;
  }

  _recordNotification(callbackUrlId, type) {
    const key = `${callbackUrlId}:${type}`;
    this.lastNotifications.set(key, Date.now());
  }
}

module.exports = HealthChecker;