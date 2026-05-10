const express = require('express');
const multer = require('multer');
const AttachmentController = require('../controllers/AttachmentController');
const { upload } = require('../middleware/upload');

const router = express.Router();

router.post('/upload', upload.single('file'), AttachmentController.uploadAttachment);
router.get('/', AttachmentController.getAttachments);
router.get('/:attachmentId', AttachmentController.getAttachmentById);
router.get('/:attachmentId/history', AttachmentController.getAttachmentHistory);
router.post('/:attachmentId/validate', AttachmentController.validateAttachment);
router.post('/:attachmentId/manual-correct', AttachmentController.manualCorrectAttachment);

module.exports = router;
