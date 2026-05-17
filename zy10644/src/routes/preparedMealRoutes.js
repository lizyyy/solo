const express = require('express');
const router = express.Router();
const {
  getPreparedMeals,
  getPreparedMealById,
  batchOffShelves,
  confirmOffShelved,
  recoverPreparedMeal
} = require('../controllers/preparedMealController');

router.get('/', getPreparedMeals);
router.get('/:id', getPreparedMealById);
router.post('/batch-off-shelves', batchOffShelves);
router.post('/confirm-off-shelved', confirmOffShelved);
router.post('/recover', recoverPreparedMeal);

module.exports = router;
