const express = require('express');
const bodyParser = require('body-parser');
const bounceService = require('./services/bounceService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

function generateId() {
  return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

app.post('/api/sends', (req, res) => {
  const { email, business_type, subject, message_id } = req.body;

  if (!email || !business_type) {
    return res.status(400).json({
      error: 'email and business_type are required'
    });
  }

  const id = req.body.id || generateId();
  const messageId = message_id || id;

  const sendRecord = bounceService.createSendRecord({
    id,
    email,
    business_type,
    subject,
    message_id: messageId
  });

  res.status(201).json({
    id: sendRecord.id,
    email: sendRecord.email,
    business_type: sendRecord.business_type,
    message_id: sendRecord.message_id,
    status: sendRecord.status,
    sent_at: sendRecord.sent_at
  });
});

app.post('/api/bounces', (req, res) => {
  const { id, email, type, reason, business_type, message_id, received_at } = req.body;

  if (!email) {
    return res.status(400).json({
      error: 'email is required'
    });
  }

  const eventId = id || generateId();

  const result = bounceService.processBounceEvent({
    id: eventId,
    email,
    type,
    reason,
    business_type,
    message_id,
    received_at
  });

  if (result.duplicate) {
    return res.status(200).json({
      id: result.event.id,
      processed: false,
      duplicate: true,
      message: 'Bounce event already processed (idempotent)'
    });
  }

  res.status(200).json({
    id: eventId,
    processed: true,
    duplicate: false,
    bounce_type: result.bounceType,
    address_status: result.addressStatus ? {
      email: result.addressStatus.email,
      status: result.addressStatus.status,
      soft_bounce_count: result.addressStatus.soft_bounce_count,
      can_send_marketing: !!result.addressStatus.can_send_marketing,
      can_send_billing: !!result.addressStatus.can_send_billing
    } : null
  });
});

app.get('/api/can-send/:email', (req, res) => {
  const { email } = req.params;
  const businessType = req.query.business_type || 'marketing';

  const result = bounceService.canSend(email, businessType);

  res.json({
    email,
    business_type: businessType,
    can_send: result.canSend,
    reason: result.reason,
    status: result.status,
    soft_bounce_count: result.softBounceCount,
    remaining_retries: result.remainingRetries,
    requires_manual_review: result.requiresManualReview
  });
});

app.get('/api/addresses/:email', (req, res) => {
  const { email } = req.params;

  const status = bounceService.getAddressStatus(email);

  if (!status) {
    return res.status(404).json({
      error: 'Address not found'
    });
  }

  res.json(status);
});

app.get('/api/delivery-quality', (req, res) => {
  const options = {};
  
  if (req.query.start_date) {
    options.startDate = parseInt(req.query.start_date);
  }
  if (req.query.end_date) {
    options.endDate = parseInt(req.query.end_date);
  }
  if (req.query.domain) {
    options.domain = req.query.domain;
  }
  if (req.query.business_type) {
    options.businessType = req.query.business_type;
  }

  const report = bounceService.getDeliveryQualityReport(options);

  res.json(report);
});

app.listen(PORT, () => {
  console.log(`Email Bounce Handler API running on port ${PORT}`);
  console.log('');
  console.log('API Endpoints:');
  console.log('  POST   /api/sends              - Create send record');
  console.log('  POST   /api/bounces            - Process bounce event');
  console.log('  GET    /api/can-send/:email    - Check if can send to address');
  console.log('  GET    /api/addresses/:email   - Get address status');
  console.log('  GET    /api/delivery-quality   - Get delivery quality report');
});

module.exports = app;
