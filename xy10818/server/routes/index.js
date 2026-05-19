const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const appController = require('../controllers/appController');

router.get('/apps', appController.getAllApps);
router.post('/apps', appController.createApp);

router.get('/event-types', appController.getAllEventTypes);
router.post('/event-types', appController.createEventType);

router.get('/subscriptions', subscriptionController.getAllSubscriptions);
router.get('/subscriptions/export/data', subscriptionController.exportSubscriptions);
router.get('/subscriptions/:id', subscriptionController.getSubscriptionById);
router.post('/subscriptions', subscriptionController.createSubscription);
router.post('/subscriptions/:id/review', subscriptionController.reviewSubscription);
router.post('/subscriptions/:id/unsubscribe', subscriptionController.unsubscribe);

router.get('/delivery-records', subscriptionController.getDeliveryRecords);

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
