const express = require('express');
const router = express.Router();
const slowQueryService = require('../services/slowQueryService');

router.get('/', (req, res) => {
  try {
    const owners = slowQueryService.listOwners();
    res.json({
      success: true,
      data: owners
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

router.post('/', (req, res) => {
  try {
    const { name, email } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'name is required'
      });
    }
    
    const owner = slowQueryService.findOrCreateOwner(name, email);
    res.json({
      success: true,
      data: owner
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

module.exports = router;
