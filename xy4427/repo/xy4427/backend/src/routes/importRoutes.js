const express = require('express');
const router = express.Router();
const {
  importOriginalTextsHandler,
  importBrailleProofreadingsHandler,
  importTemperatureCurvesHandler,
  importStudentFeedbacksHandler,
} = require('../controllers/importController');

router.post('/original-texts', importOriginalTextsHandler);
router.post('/braille-proofreadings', importBrailleProofreadingsHandler);
router.post('/temperature-curves', importTemperatureCurvesHandler);
router.post('/student-feedbacks', importStudentFeedbacksHandler);

module.exports = router;
