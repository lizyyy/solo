const express = require('express');
const router = express.Router();
const store = require('../store/dataStore');
const mergeService = require('../services/mergeService');

router.get('/', (req, res) => {
  try {
    const { source, masterCustomerId, search } = req.query;
    const identities = store.getExternalIdentities({ source, masterCustomerId, search });
    res.json({ success: true, data: identities });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const identity = store.getExternalIdentityById(req.params.id);
    if (!identity) {
      return res.status(404).json({ success: false, error: '身份不存在' });
    }
    res.json({ success: true, data: identity });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { externalId, source, email, phone, name, attributes } = req.body;
    if (!externalId || !source) {
      return res.status(400).json({ success: false, error: 'externalId 和 source 必填' });
    }
    const identity = store.addExternalIdentity({
      externalId, source, email, phone, name, attributes,
      masterCustomerId: null
    });
    store.addAuditLog({
      action: 'create_identity',
      entityId: identity.id,
      entityType: 'external_identity',
      operator: 'system',
      details: { externalId, source, name }
    });
    res.json({ success: true, data: identity });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const identity = store.updateExternalIdentity(req.params.id, req.body);
    if (!identity) {
      return res.status(404).json({ success: false, error: '身份不存在' });
    }
    store.addAuditLog({
      action: 'update_identity',
      entityId: identity.id,
      entityType: 'external_identity',
      operator: 'system',
      details: req.body
    });
    res.json({ success: true, data: identity });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/matches', (req, res) => {
  try {
    const identity = store.getExternalIdentityById(req.params.id);
    if (!identity) {
      return res.status(404).json({ success: false, error: '身份不存在' });
    }
    const matches = mergeService.findMatchingIdentities(identity);
    res.json({ success: true, data: matches });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;