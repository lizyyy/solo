const express = require('express');
const router = express.Router();

const validateCallbackUrl = (req, res, next) => {
  const { url, customerId, frequencyMinutes } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, message: 'URL is required' });
  }

  try {
    new URL(url);
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Invalid URL format' });
  }

  if (!customerId) {
    return res.status(400).json({ success: false, message: 'Customer ID is required' });
  }

  if (frequencyMinutes !== undefined) {
    if (frequencyMinutes < 1 || frequencyMinutes > 1440) {
      return res.status(400).json({ 
        success: false, 
        message: 'Frequency must be between 1 and 1440 minutes' 
      });
    }
  }

  next();
};

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Callback Health Checker API',
    version: '1.0.0',
    endpoints: {
      customers: '/customers',
      callbackUrls: '/callback-urls',
      healthChecks: '/health-checks',
      notifications: '/notifications',
      summary: '/summary'
    }
  });
});

router.post('/customers', async (req, res, next) => {
  try {
    const { name, email, phone } = req.body;

    if (!name || !email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name and email are required' 
      });
    }

    const customer = await req.db.createCustomer({ name, email, phone });
    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
});

router.get('/customers', async (req, res, next) => {
  try {
    const customers = await req.db.getAllCustomers();
    res.json({ success: true, data: customers });
  } catch (error) {
    next(error);
  }
});

router.get('/customers/:id', async (req, res, next) => {
  try {
    const customer = await req.db.getCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
});

router.post('/callback-urls', validateCallbackUrl, async (req, res, next) => {
  try {
    const { url, customerId, description, frequencyMinutes, createdBy } = req.body;

    const customer = await req.db.getCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const result = await req.db.createCallbackUrl({
      url,
      customerId,
      description,
      frequencyMinutes,
      createdBy,
    });

    if (result.isDuplicate) {
      return res.status(409).json({ 
        success: false, 
        message: 'Callback URL already exists for this customer',
        data: result 
      });
    }

    await req.healthChecker.scheduleNewCallbackUrl(result);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/callback-urls', async (req, res, next) => {
  try {
    const { customerId, status } = req.query;
    let urls = await req.db.getAllCallbackUrls();

    if (customerId) {
      urls = urls.filter(url => url.customerId === customerId);
    }

    if (status) {
      urls = urls.filter(url => url.status === status);
    }

    res.json({ success: true, data: urls });
  } catch (error) {
    next(error);
  }
});

router.get('/callback-urls/:id', async (req, res, next) => {
  try {
    const url = await req.db.getCallbackUrlById(req.params.id);
    if (!url) {
      return res.status(404).json({ success: false, message: 'Callback URL not found' });
    }
    res.json({ success: true, data: url });
  } catch (error) {
    next(error);
  }
});

router.put('/callback-urls/:id', async (req, res, next) => {
  try {
    const { description, frequencyMinutes } = req.body;
    const updates = {};

    if (description !== undefined) updates.description = description;
    if (frequencyMinutes !== undefined) {
      if (frequencyMinutes < 1 || frequencyMinutes > 1440) {
        return res.status(400).json({ 
          success: false, 
          message: 'Frequency must be between 1 and 1440 minutes' 
        });
      }
      updates.frequencyMinutes = frequencyMinutes;
    }

    const updated = await req.db.updateCallbackUrl(req.params.id, updates);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Callback URL not found' });
    }

    if (updates.frequencyMinutes) {
      await req.healthChecker.scheduleNewCallbackUrl(updated);
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.post('/callback-urls/:id/pause', async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ 
        success: false, 
        message: 'Pause reason is required' 
      });
    }

    const paused = await req.db.pauseCallbackUrl(req.params.id, reason);
    if (!paused) {
      return res.status(404).json({ success: false, message: 'Callback URL not found' });
    }

    await req.healthChecker.unscheduleCallbackUrl(req.params.id);
    res.json({ success: true, data: paused });
  } catch (error) {
    next(error);
  }
});

router.post('/callback-urls/:id/resume', async (req, res, next) => {
  try {
    const resumed = await req.db.resumeCallbackUrl(req.params.id);
    if (!resumed) {
      return res.status(404).json({ success: false, message: 'Callback URL not found' });
    }

    await req.healthChecker.scheduleNewCallbackUrl(resumed);
    res.json({ success: true, data: resumed });
  } catch (error) {
    next(error);
  }
});

router.post('/health-checks/:callbackUrlId/run', async (req, res, next) => {
  try {
    const callbackUrl = await req.db.getCallbackUrlById(req.params.callbackUrlId);
    if (!callbackUrl) {
      return res.status(404).json({ success: false, message: 'Callback URL not found' });
    }

    if (callbackUrl.status !== 'active') {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot run health check: callback URL is ${callbackUrl.status}` 
      });
    }

    const result = await req.healthChecker.checkNow(req.params.callbackUrlId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/health-checks', async (req, res, next) => {
  try {
    const { callbackUrlId, customerId, limit } = req.query;
    const limitNum = limit ? parseInt(limit) : 100;

    let checks = [];
    if (callbackUrlId) {
      checks = await req.db.getHealthChecksByCallbackUrlId(callbackUrlId, limitNum);
    } else if (customerId) {
      checks = await req.db.getHealthChecksByCustomerId(customerId, limitNum);
    }

    res.json({ success: true, data: checks });
  } catch (error) {
    next(error);
  }
});

router.get('/customers/:id/health-status', async (req, res, next) => {
  try {
    const customer = await req.db.getCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const callbackUrls = await req.db.getCallbackUrlsByCustomerId(req.params.id);
    const recentChecks = await req.db.getHealthChecksByCustomerId(req.params.id, 50);
    const notifications = await req.db.getNotificationsByCustomerId(req.params.id, 20);

    const urlStatuses = callbackUrls.map(url => {
      const urlChecks = recentChecks.filter(c => c.callbackUrlId === url.id);
      const recentSuccess = urlChecks.filter(c => c.status === 'success').length;
      const recentFailures = urlChecks.filter(c => c.status === 'failed').length;
      const latestCheck = urlChecks[0];

      let healthStatus = 'healthy';
      if (url.status === 'blocked') {
        healthStatus = 'blocked';
      } else if (url.status === 'paused') {
        healthStatus = 'paused';
      } else if (url.consecutiveFailures >= 3) {
        healthStatus = 'critical';
      } else if (url.consecutiveFailures >= 1) {
        healthStatus = 'degraded';
      }

      return {
        ...url,
        healthStatus,
        latestCheck,
        recentSuccessCount: recentSuccess,
        recentFailureCount: recentFailures,
        successRate: urlChecks.length > 0 
          ? Math.round((recentSuccess / urlChecks.length) * 100) 
          : null,
      };
    });

    const overallStatus = urlStatuses.every(u => u.healthStatus === 'healthy' || u.healthStatus === 'paused') 
      ? 'healthy' 
      : urlStatuses.some(u => u.healthStatus === 'blocked' || u.healthStatus === 'critical')
        ? 'critical'
        : 'degraded';

    res.json({ 
      success: true, 
      data: {
        customer,
        overallStatus,
        callbackUrls: urlStatuses,
        recentChecks: recentChecks.slice(0, 20),
        pendingNotifications: notifications.filter(n => !n.acknowledged),
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/notifications', async (req, res, next) => {
  try {
    const { customerId, acknowledged, limit } = req.query;
    const limitNum = limit ? parseInt(limit) : 100;

    let notifications;
    if (customerId) {
      notifications = await req.db.getNotificationsByCustomerId(customerId, limitNum);
    } else {
      notifications = await req.db.getPendingNotifications();
    }

    if (acknowledged !== undefined) {
      const isAcknowledged = acknowledged === 'true';
      notifications = notifications.filter(n => n.acknowledged === isAcknowledged);
    }

    res.json({ success: true, data: notifications });
  } catch (error) {
    next(error);
  }
});

router.post('/notifications/:id/acknowledge', async (req, res, next) => {
  try {
    const acknowledged = await req.db.acknowledgeNotification(req.params.id);
    if (!acknowledged) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.json({ success: true, data: acknowledged });
  } catch (error) {
    next(error);
  }
});

router.get('/summary', async (req, res, next) => {
  try {
    const customers = await req.db.getAllCustomers();
    const allUrls = await req.db.getAllCallbackUrls();
    const recentChecks = await req.db.getRecentHealthChecks(60);
    const pendingNotifications = await req.db.getPendingNotifications();

    const stats = {
      totalCustomers: customers.length,
      totalCallbackUrls: allUrls.length,
      activeUrls: allUrls.filter(u => u.status === 'active').length,
      pausedUrls: allUrls.filter(u => u.status === 'paused').length,
      blockedUrls: allUrls.filter(u => u.status === 'blocked').length,
      recentChecksCount: recentChecks.length,
      successCount: recentChecks.filter(c => c.status === 'success').length,
      failureCount: recentChecks.filter(c => c.status === 'failed').length,
      slowResponseCount: recentChecks.filter(c => c.isSlowResponse).length,
      certificateIssues: recentChecks.filter(c => 
        c.certificateStatus === 'expired' || c.certificateStatus === 'expiring_soon'
      ).length,
      pendingNotifications: pendingNotifications.length,
    };

    const atRiskCustomers = customers.filter(customer => {
      const customerUrls = allUrls.filter(u => u.customerId === customer.id);
      return customerUrls.some(u => 
        u.status === 'blocked' || 
        u.consecutiveFailures >= 2
      );
    }).map(customer => {
      const customerUrls = allUrls.filter(u => u.customerId === customer.id);
      const issues = customerUrls.filter(u => 
        u.status === 'blocked' || u.consecutiveFailures >= 2
      );
      return {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        issueCount: issues.length,
        issues: issues.map(u => ({
          url: u.url,
          status: u.status,
          consecutiveFailures: u.consecutiveFailures,
        })),
      };
    }).sort((a, b) => b.issueCount - a.issueCount);

    res.json({ 
      success: true, 
      data: {
        stats,
        atRiskCustomers,
        recentIssues: recentChecks
          .filter(c => c.status === 'failed')
          .slice(0, 20),
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;