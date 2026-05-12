const express = require('express');
const applicationService = require('../services/applicationService');
const { handleAsync } = require('../utils/errors');

const router = express.Router();

router.get('/', handleAsync(async (req, res) => {
  const applications = applicationService.listApplications(req.query);
  res.json({ data: applications });
}));

router.post('/', handleAsync(async (req, res) => {
  const application = applicationService.createApplication(req.body);
  res.status(201).json({ data: application });
}));

router.get('/by-no/:applicationNo', handleAsync(async (req, res) => {
  const application = applicationService.getApplicationByNo(req.params.applicationNo);
  res.json({ data: application });
}));

router.get('/:id', handleAsync(async (req, res) => {
  const application = applicationService.getApplicationById(req.params.id);
  res.json({ data: application });
}));

router.post('/:id/schedule', handleAsync(async (req, res) => {
  const application = applicationService.scheduleApplication(req.params.id, req.body);
  res.json({ data: application });
}));

router.post('/:id/start', handleAsync(async (req, res) => {
  const application = applicationService.startApplication(req.params.id, req.body);
  res.json({ data: application });
}));

router.post('/:id/complete', handleAsync(async (req, res) => {
  const application = applicationService.completeApplication(req.params.id, req.body);
  res.json({ data: application });
}));

router.post('/:id/cancel', handleAsync(async (req, res) => {
  const application = applicationService.cancelApplication(req.params.id, req.body);
  res.json({ data: application });
}));

router.post('/:id/revise', handleAsync(async (req, res) => {
  const application = applicationService.reviseApplication(req.params.id, req.body);
  res.json({ data: application });
}));

router.get('/:id/logs', handleAsync(async (req, res) => {
  const logs = applicationService.getApplicationLogs(req.params.id);
  res.json({ data: logs });
}));

router.get('/states/list', handleAsync(async (req, res) => {
  res.json({ 
    data: {
      states: Object.values(applicationService.APPLICATION_STATES)
    }
  });
}));

module.exports = router;
