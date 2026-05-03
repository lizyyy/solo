const express = require('express');
const router = express.Router();

module.exports = (signature) => {
  router.post('/verify', (req, res) => {
    const { secret, payload, signature: receivedSignature } = req.body;

    if (!secret) {
      return res.status(400).json({
        error: 'Missing secret'
      });
    }

    if (!payload) {
      return res.status(400).json({
        error: 'Missing payload'
      });
    }

    const result = signature.verify(secret, payload, receivedSignature);
    
    res.json({
      valid: result.valid,
      error: result.error,
      expected_signature: result.expected,
      received_signature: result.received || receivedSignature
    });
  });

  router.post('/generate', (req, res) => {
    const { secret, payload } = req.body;

    if (!secret) {
      return res.status(400).json({
        error: 'Missing secret'
      });
    }

    if (!payload) {
      return res.status(400).json({
        error: 'Missing payload'
      });
    }

    const sig = signature.generate(secret, payload);
    const headers = signature.generateRequestHeaders(secret, payload);

    res.json({
      signature: sig,
      headers,
      algorithm: signature.algorithm,
      header_name: signature.header,
      prefix: signature.prefix
    });
  });

  return router;
};