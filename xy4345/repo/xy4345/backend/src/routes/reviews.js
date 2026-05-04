const express = require('express');
const router = express.Router();
const reviewModel = require('../models/reviewModel');
const riskModel = require('../models/riskModel');

router.get('/', (req, res) => {
  try {
    const reviews = reviewModel.getAll();
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const review = reviewModel.getById(req.params.id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    res.json(review);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { risk_id, reviewer, comment, status_change } = req.body;
    
    if (!risk_id || !reviewer || !comment) {
      return res.status(400).json({ error: 'risk_id, reviewer and comment are required' });
    }
    
    const risk = riskModel.getById(risk_id);
    if (!risk) {
      return res.status(404).json({ error: 'Risk not found' });
    }
    
    const review = reviewModel.create({
      risk_id,
      reviewer,
      comment,
      status_change
    });
    
    if (status_change) {
      riskModel.update(risk_id, { status: status_change });
    }
    
    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const review = reviewModel.getById(req.params.id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    reviewModel.delete(req.params.id);
    res.json({ message: 'Review deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
