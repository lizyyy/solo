const express = require('express');
const router = express.Router();
const exceptionController = require('../controllers/exceptionController');

router.get('/', exceptionController.getAllExceptions);
router.post('/', exceptionController.createException);
router.post('/generate', exceptionController.generateExceptions);
router.put('/:id/resolve', exceptionController.resolveException);

module.exports = router;
