const express = require('express');
const router = express.Router();
const technicianController = require('../controllers/technicianController');

router.get('/', technicianController.getTechnicians);
router.post('/', technicianController.createTechnician);
router.put('/:id', technicianController.updateTechnician);
router.delete('/:id', technicianController.deleteTechnician);

module.exports = router;
