const express = require('express');
const signatureService = require('../services/signatureService');

const router = express.Router();

router.post('/:artifactId', (req, res) => {
  try {
    const { signer, signature, algorithm } = req.body;
    const actor = req.header('X-Actor') || 'api';
    
    if (!signer || !signature) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要字段: signer, signature' 
      });
    }

    const result = signatureService.addSignature(
      req.params.artifactId,
      signer,
      signature,
      algorithm || 'sha256',
      actor
    );
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:artifactId', (req, res) => {
  try {
    const signatures = signatureService.getSignaturesForArtifact(req.params.artifactId);
    res.json({ success: true, data: signatures });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:signatureId/verify', (req, res) => {
  try {
    const { isValid } = req.body;
    const actor = req.header('X-Actor') || 'api';
    
    if (isValid === undefined) {
      return res.status(400).json({ success: false, error: '缺少必要字段: isValid' });
    }

    const result = signatureService.verifySignature(req.params.signatureId, isValid, actor);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.message === '签名记录不存在') {
      return res.status(404).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
