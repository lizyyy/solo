const express = require('express');
const router = express.Router();
const applicationService = require('../services/applicationService');
const queryService = require('../services/queryService');
const schedulerService = require('../services/schedulerService');

router.use(express.json());

router.post('/', (req, res) => {
  const result = applicationService.createApplication(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error, warning: result.warning });
  }
  res.status(201).json(result);
});

router.get('/', (req, res) => {
  const filters = {};
  if (req.query.status) filters.status = req.query.status;
  if (req.query.product_sn) filters.product_sn = req.query.product_sn;
  if (req.query.part_code) filters.part_code = req.query.part_code;
  if (req.query.is_in_warranty !== undefined) {
    filters.is_in_warranty = req.query.is_in_warranty === 'true';
  }

  const result = applicationService.listApplications(filters);
  res.json(result);
});

router.get('/pending-shipments', (req, res) => {
  const result = queryService.getPendingShipments();
  res.json(result);
});

router.get('/pending-recycling', (req, res) => {
  const result = queryService.getPendingRecycling();
  res.json(result);
});

router.get('/consumption', (req, res) => {
  const result = queryService.getPartsConsumption(
    req.query.start_date,
    req.query.end_date
  );
  res.json(result);
});

router.get('/abnormal', (req, res) => {
  const result = queryService.getAbnormalApplications();
  res.json(result);
});

router.get('/todos', (req, res) => {
  const onlyPending = req.query.all !== 'true';
  const result = queryService.getOverdueTodos(onlyPending);
  res.json(result);
});

router.post('/todos/:id/handle', (req, res) => {
  const result = schedulerService.markTodoHandled(
    parseInt(req.params.id),
    req.body.operator
  );
  if (!result.success) {
    return res.status(400).json({ error: '待办处理失败或已处理' });
  }
  res.json(result);
});

router.get('/inventory', (req, res) => {
  const result = queryService.getInventoryStatus();
  res.json(result);
});

router.get('/warranty/:product_sn', (req, res) => {
  const result = queryService.getWarrantyInfo(req.params.product_sn);
  if (!result.success) {
    return res.status(404).json({ error: result.error });
  }
  res.json(result);
});

router.get('/:application_no', (req, res) => {
  const result = applicationService.getApplication(req.params.application_no);
  if (!result.success) {
    return res.status(404).json({ error: result.error });
  }
  res.json(result);
});

router.post('/:application_no/review', (req, res) => {
  const { approved, comment, reason, operator } = req.body;
  const result = applicationService.reviewApplication(
    req.params.application_no,
    approved === true,
    { comment, reason, operator }
  );
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

router.post('/:application_no/lock-inventory', (req, res) => {
  const result = applicationService.lockInventory(
    req.params.application_no,
    { operator: req.body.operator }
  );
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

router.post('/:application_no/ship', (req, res) => {
  const { logistics_company, tracking_no, operator } = req.body;
  const result = applicationService.shipApplication(
    req.params.application_no,
    { logistics_company, tracking_no, operator }
  );
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

router.post('/:application_no/deliver', (req, res) => {
  const result = applicationService.confirmDelivery(
    req.params.application_no,
    { operator: req.body.operator }
  );
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

router.post('/:application_no/receive-old-part', (req, res) => {
  const { old_part_logistics_company, old_part_tracking_no, operator } = req.body;
  const result = applicationService.receiveOldPart(
    req.params.application_no,
    { old_part_logistics_company, old_part_tracking_no, operator }
  );
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

router.post('/:application_no/close', (req, res) => {
  const result = applicationService.closeApplication(
    req.params.application_no,
    { operator: req.body.operator, remark: req.body.remark }
  );
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

router.post('/:application_no/modify-address', (req, res) => {
  const { shipping_address, shipping_city, operator } = req.body;
  const result = applicationService.modifyShippingAddress(
    req.params.application_no,
    { shipping_address, shipping_city, operator }
  );
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

module.exports = router;
