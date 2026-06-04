const express = require('express');
const router = express.Router();
const PhotoService = require('../services/PhotoService');

router.get('/', (req, res) => {
  const photos = PhotoService.getAllPhotos();
  res.json(photos);
});

router.get('/pending', (req, res) => {
  const photos = PhotoService.getPendingPhotos();
  res.json(photos);
});

router.get('/batch/:batchId', (req, res) => {
  const photos = PhotoService.getPhotosByBatch(req.params.batchId);
  res.json(photos);
});

router.get('/sensor/:sensorNumber', (req, res) => {
  const photos = PhotoService.getPhotosBySensorNumber(req.params.sensorNumber);
  res.json(photos);
});

router.get('/:id', (req, res) => {
  const photo = PhotoService.getPhotoById(req.params.id);
  if (!photo) {
    return res.status(404).json({ error: '照片未找到' });
  }
  res.json(photo);
});

router.get('/:id/trace', (req, res) => {
  const traceInfo = PhotoService.getPhotoTraceInfo(req.params.id);
  if (!traceInfo) {
    return res.status(404).json({ error: '照片未找到' });
  }
  res.json(traceInfo);
});

router.post('/import', (req, res) => {
  const { photos, uploadedBy, batchId } = req.body;
  const result = PhotoService.importPhotos(photos, uploadedBy, batchId);
  res.json(result);
});

router.post('/check-duplicates', (req, res) => {
  const result = PhotoService.checkForDuplicates(req.body);
  res.json(result);
});

router.post('/:id/approve', (req, res) => {
  const { reviewer } = req.body;
  const photo = PhotoService.approvePhoto(req.params.id, reviewer);
  if (!photo) {
    return res.status(404).json({ error: '照片未找到' });
  }
  res.json(photo);
});

router.post('/:id/reject', (req, res) => {
  const { reviewer, reason } = req.body;
  const photo = PhotoService.rejectPhoto(req.params.id, reviewer, reason);
  if (!photo) {
    return res.status(404).json({ error: '照片未找到' });
  }
  res.json(photo);
});

router.put('/:id/sensors', (req, res) => {
  const { sensorNumbers } = req.body;
  const photo = PhotoService.updatePhotoSensorNumbers(req.params.id, sensorNumbers);
  if (!photo) {
    return res.status(404).json({ error: '照片未找到' });
  }
  res.json(photo);
});

router.put('/:id/note', (req, res) => {
  const { note } = req.body;
  const photo = PhotoService.addPhotoNote(req.params.id, note);
  if (!photo) {
    return res.status(404).json({ error: '照片未找到' });
  }
  res.json(photo);
});

router.get('/admin/duplicates', (req, res) => {
  const duplicates = PhotoService.getDuplicatePhotos();
  res.json(duplicates);
});

router.delete('/:id', (req, res) => {
  const photo = PhotoService.deletePhoto(req.params.id);
  if (!photo) {
    return res.status(404).json({ error: '照片未找到' });
  }
  res.json(photo);
});

module.exports = router;
