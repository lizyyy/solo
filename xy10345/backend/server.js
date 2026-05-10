const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { properties, orders, passwords, auditLogs, anomalies } = require('./data');
const utils = require('./utils');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/properties', (req, res) => {
  res.json(properties);
});

app.get('/api/properties/:id', (req, res) => {
  const property = properties.find(p => p.id === req.params.id);
  if (!property) {
    return res.status(404).json({ message: '房源不存在' });
  }
  res.json(property);
});

app.get('/api/orders', (req, res) => {
  const { propertyId } = req.query;
  let filteredOrders = orders;
  if (propertyId) {
    filteredOrders = orders.filter(o => o.propertyId === propertyId);
  }
  res.json(filteredOrders);
});

app.get('/api/orders/:id', (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ message: '订单不存在' });
  }
  res.json(order);
});

app.post('/api/orders', (req, res) => {
  const { propertyId, guestName, guestPhone, checkIn, checkOut } = req.body;

  const overlapCheck = utils.checkTimeOverlap(checkIn, checkOut, propertyId);
  if (overlapCheck.hasOverlap) {
    return res.status(400).json({
      success: false,
      message: `订单时间与现有密码冲突：${overlapCheck.conflictingPassword.name}`
    });
  }

  const order = {
    id: uuidv4(),
    propertyId,
    guestName,
    guestPhone,
    checkIn,
    checkOut,
    status: 'upcoming',
    createdAt: new Date().toISOString()
  };

  orders.push(order);

  const result = utils.generatePasswordForOrder(order);

  res.json({
    success: true,
    order,
    password: result.success ? result.password : null
  });
});

app.put('/api/orders/:id/extend', (req, res) => {
  const { newCheckOut } = req.body;
  const order = orders.find(o => o.id === req.params.id);
  
  if (!order) {
    return res.status(404).json({ message: '订单不存在' });
  }

  const password = passwords.find(p => p.orderId === order.id);
  if (!password) {
    return res.status(404).json({ message: '关联密码不存在' });
  }

  const result = utils.extendPasswordExpiry(password.id, newCheckOut);
  if (!result.success) {
    return res.status(400).json(result);
  }

  order.checkOut = newCheckOut;

  res.json({
    success: true,
    order,
    password: result.password
  });
});

app.get('/api/passwords', (req, res) => {
  const { propertyId, type } = req.query;
  let filteredPasswords = passwords;

  if (propertyId) {
    filteredPasswords = filteredPasswords.filter(p => p.propertyId === propertyId);
  }
  if (type) {
    filteredPasswords = filteredPasswords.filter(p => p.type === type);
  }

  const report = filteredPasswords.map(pwd => {
    const validation = utils.validatePassword(pwd);
    return {
      ...pwd,
      validation
    };
  });

  res.json(report);
});

app.get('/api/passwords/:id', (req, res) => {
  const password = passwords.find(p => p.id === req.params.id);
  if (!password) {
    return res.status(404).json({ message: '密码不存在' });
  }

  const validation = utils.validatePassword(password);
  res.json({
    ...password,
    validation
  });
});

app.post('/api/passwords/generate', (req, res) => {
  const { propertyId, type, validFrom, validTo, name, reason } = req.body;

  if (type === 'maintenance') {
    const result = utils.generateMaintenancePassword(propertyId, validFrom, validTo, reason);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  }

  if (type === 'cleaning') {
    const overlapCheck = utils.checkTimeOverlap(validFrom, validTo, propertyId);
    if (overlapCheck.hasOverlap) {
      return res.status(400).json({
        success: false,
        message: `时间与现有密码冲突：${overlapCheck.conflictingPassword.name}`
      });
    }

    const password = {
      id: uuidv4(),
      propertyId,
      orderId: null,
      type: 'cleaning',
      code: utils.generateRandomCode(),
      name: name || '保洁密码',
      validFrom,
      validTo,
      status: 'pending',
      reason: reason || '保洁人员长期密码',
      createdAt: new Date().toISOString()
    };

    passwords.push(password);

    const log = {
      id: uuidv4(),
      propertyId,
      passwordId: password.id,
      action: 'generate',
      description: '生成保洁密码',
      timestamp: new Date().toISOString()
    };
    auditLogs.push(log);

    return res.json({ success: true, password });
  }

  res.status(400).json({ success: false, message: '不支持的密码类型' });
});

app.post('/api/passwords/:id/revoke', (req, res) => {
  const { reason } = req.body;
  const result = utils.revokePassword(req.params.id, reason);
  if (!result.success) {
    return res.status(404).json(result);
  }
  res.json(result);
});

app.post('/api/passwords/:id/verify', (req, res) => {
  const password = passwords.find(p => p.id === req.params.id);
  if (!password) {
    return res.status(404).json({ message: '密码不存在' });
  }

  const property = properties.find(p => p.id === password.propertyId);
  const validation = utils.validatePassword(password);

  if (!validation.isValid) {
    const expiredCheck = utils.checkExpiredPasswordAttempt(password);
    return res.status(403).json({
      success: false,
      message: validation.reason,
      blocked: expiredCheck.blocked,
      validation
    });
  }

  const maintenanceCheck = utils.checkMaintenanceAccess(password, property.status);
  if (!maintenanceCheck.allowed) {
    return res.status(403).json({
      success: false,
      message: maintenanceCheck.reason,
      validation
    });
  }

  res.json({
    success: true,
    message: '密码验证通过',
    validation
  });
});

app.get('/api/anomalies', (req, res) => {
  const { resolved } = req.query;
  let filteredAnomalies = anomalies;

  if (resolved !== undefined) {
    filteredAnomalies = anomalies.filter(a => a.resolved === (resolved === 'true'));
  }

  res.json(filteredAnomalies);
});

app.put('/api/anomalies/:id/resolve', (req, res) => {
  const { resolution } = req.body;
  const anomaly = anomalies.find(a => a.id === req.params.id);
  
  if (!anomaly) {
    return res.status(404).json({ message: '异常记录不存在' });
  }

  anomaly.resolved = true;
  anomaly.resolution = resolution || '人工处理完成';
  anomaly.resolvedAt = new Date().toISOString();

  res.json({ success: true, anomaly });
});

app.get('/api/audit-logs', (req, res) => {
  const { propertyId, passwordId } = req.query;
  let filteredLogs = auditLogs;

  if (propertyId) {
    filteredLogs = filteredLogs.filter(l => l.propertyId === propertyId);
  }
  if (passwordId) {
    filteredLogs = filteredLogs.filter(l => l.passwordId === passwordId);
  }

  res.json(filteredLogs);
});

app.get('/api/reports/password-status', (req, res) => {
  const { propertyId } = req.query;
  const report = utils.getPasswordStatusReport(propertyId);
  res.json(report);
});

app.get('/api/reports/export', (req, res) => {
  const { format = 'json' } = req.query;
  
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalProperties: properties.length,
      activeProperties: properties.filter(p => p.status === 'active').length,
      totalPasswords: passwords.length,
      activePasswords: passwords.filter(p => {
        const v = utils.validatePassword(p);
        return v.isValid;
      }).length,
      expiredPasswords: passwords.filter(p => {
        const v = utils.validatePassword(p);
        return v.status === 'expired';
      }).length,
      revokedPasswords: passwords.filter(p => p.status === 'revoked').length,
      pendingAnomalies: anomalies.filter(a => !a.resolved).length
    },
    properties,
    orders,
    passwordReport: utils.getPasswordStatusReport(),
    anomalies,
    auditLogs
  };

  if (format === 'csv') {
    const csvLines = [];
    csvLines.push(['密码ID', '房源', '类型', '名称', '密码', '生效时间', '失效时间', '状态', '状态说明'].join(','));
    
    report.passwordReport.forEach(pwd => {
      csvLines.push([
        pwd.id,
        properties.find(p => p.id === pwd.propertyId)?.name || '',
        pwd.type,
        pwd.name,
        pwd.code,
        pwd.validFrom,
        pwd.validTo,
        pwd.validation.status,
        `"${pwd.validation.reason}"`
      ].join(','));
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=password-report.csv');
    return res.send('\ufeff' + csvLines.join('\n'));
  }

  res.json(report);
});

app.get('/api/calendar/:propertyId', (req, res) => {
  const propertyId = req.params.propertyId;
  const propertyOrders = orders.filter(o => o.propertyId === propertyId);
  const propertyPasswords = passwords.filter(p => p.propertyId === propertyId);

  const events = [];

  propertyOrders.forEach(order => {
    events.push({
      id: `order-${order.id}`,
      type: 'order',
      title: `${order.guestName} (${order.status})`,
      start: order.checkIn,
      end: order.checkOut,
      orderId: order.id,
      status: order.status
    });
  });

  propertyPasswords.forEach(pwd => {
    const validation = utils.validatePassword(pwd);
    events.push({
      id: `pwd-${pwd.id}`,
      type: 'password',
      title: `${pwd.name} (${validation.status})`,
      start: pwd.validFrom,
      end: pwd.validTo,
      passwordId: pwd.id,
      passwordType: pwd.type,
      status: validation.status
    });
  });

  res.json({
    property: properties.find(p => p.id === propertyId),
    events
  });
});

app.listen(PORT, () => {
  console.log(`短租房门锁密码轮换系统后端服务已启动：http://localhost:${PORT}`);
});
