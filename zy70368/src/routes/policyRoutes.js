const express = require('express');
const MaskingService = require('../services/maskingService');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const policies = MaskingService.listPolicies();
    res.json(policies);
  } catch (error) {
    console.error('Error listing policies:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

router.get('/:policyId', (req, res) => {
  try {
    const { policyId } = req.params;
    const policy = MaskingService.getPolicy(policyId);
    if (!policy) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Policy not found'
      });
    }
    res.json(policy);
  } catch (error) {
    console.error('Error getting policy:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

router.get('/:policyId/versions', (req, res) => {
  try {
    const { policyId } = req.params;
    const versions = MaskingService.listPolicyVersions(policyId);
    res.json(versions);
  } catch (error) {
    console.error('Error listing policy versions:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

router.get('/:policyId/versions/:versionId', (req, res) => {
  try {
    const { versionId } = req.params;
    const version = MaskingService.getPolicyVersion(versionId);
    if (!version) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Policy version not found'
      });
    }
    res.json(version);
  } catch (error) {
    console.error('Error getting policy version:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

router.post('/:policyId/versions', (req, res) => {
  try {
    const { policyId } = req.params;
    const { fieldRules } = req.body;

    if (!fieldRules) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing fieldRules in request body'
      });
    }

    const newVersion = MaskingService.createNewPolicyVersion(policyId, fieldRules);
    res.status(201).json(newVersion);
  } catch (error) {
    console.error('Error creating policy version:', error);
    if (error.message === 'Policy not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message
      });
    }
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

router.post('/:policyId/versions/:versionNumber/publish', (req, res) => {
  try {
    const { policyId, versionNumber } = req.params;
    const publishedVersion = MaskingService.publishPolicyVersion(
      policyId,
      parseInt(versionNumber)
    );
    res.json(publishedVersion);
  } catch (error) {
    console.error('Error publishing policy version:', error);
    if (error.message === 'Policy not found' || error.message === 'Policy version not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message
      });
    }
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

router.get('/compare/:versionId1/:versionId2', (req, res) => {
  try {
    const { versionId1, versionId2 } = req.params;
    const comparison = MaskingService.comparePolicyVersions(versionId1, versionId2);
    res.json(comparison);
  } catch (error) {
    console.error('Error comparing policy versions:', error);
    if (error.message === 'Policy version not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message
      });
    }
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

module.exports = router;
