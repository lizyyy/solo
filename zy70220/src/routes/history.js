const express = require('express');
const router = express.Router();
const { getAllHistory } = require('../utils/history');
const { handleError } = require('../utils/errors');

router.get('/', (req, res) => {
  try {
    const history = getAllHistory();
    res.json({
      success: true,
      data: history
    });
  } catch (err) {
    handleError(err, res);
  }
});

module.exports = router;
