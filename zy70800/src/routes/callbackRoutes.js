const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const callbackController = require('../controllers/callbackController');

router.post('/import', upload.single('file'), callbackController.importJSON);
router.get('/', callbackController.getCallbacks);
router.post('/', callbackController.createCallback);
router.put('/:id/confirm', callbackController.confirmCallback);

module.exports = router;
