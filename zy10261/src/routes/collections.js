const express = require('express');
const router = express.Router();
const CollectionService = require('../services/CollectionService');

router.post('/', async (req, res) => {
  try {
    const collection = await CollectionService.createCollection(req.body);
    res.json({ success: true, data: collection });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/freeze/:contractId', async (req, res) => {
  try {
    const result = await CollectionService.freezeCollection(req.params.contractId, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/unfreeze/:contractId', async (req, res) => {
  try {
    const result = await CollectionService.unfreezeCollection(req.params.contractId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/status/:contractId', async (req, res) => {
  try {
    const status = await CollectionService.getCollectionStatus(req.params.contractId);
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const collection = await CollectionService.getCollectionDetail(req.params.id);
    res.json({ success: true, data: collection });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/contract/:contractId', async (req, res) => {
  try {
    const collections = await CollectionService.listCollections(req.params.contractId);
    res.json({ success: true, data: collections });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
