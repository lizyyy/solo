const express = require('express');
const router = express.Router();
const NoteService = require('../services/NoteService');

router.get('/', (req, res) => {
  const notes = NoteService.getAllNotes();
  res.json(notes);
});

router.get('/pending', (req, res) => {
  const notes = NoteService.getPendingVerificationNotes();
  res.json(notes);
});

router.get('/photo/:photoId', (req, res) => {
  const notes = NoteService.getNotesByPhotoId(req.params.photoId);
  res.json(notes);
});

router.get('/sensor/:sensorNumber', (req, res) => {
  const notes = NoteService.getNotesBySensorNumber(req.params.sensorNumber);
  res.json(notes);
});

router.get('/author/:author', (req, res) => {
  const notes = NoteService.getNotesByAuthor(req.params.author);
  res.json(notes);
});

router.get('/:id', (req, res) => {
  const note = NoteService.getNoteById(req.params.id);
  if (!note) {
    return res.status(404).json({ error: '备注未找到' });
  }
  res.json(note);
});

router.get('/:id/history', (req, res) => {
  const history = NoteService.getNoteHistory(req.params.id);
  if (!history) {
    return res.status(404).json({ error: '备注未找到' });
  }
  res.json(history);
});

router.get('/:id/version/:version', (req, res) => {
  const version = NoteService.getNoteVersion(req.params.id, parseInt(req.params.version));
  if (!version) {
    return res.status(404).json({ error: '版本未找到' });
  }
  res.json(version);
});

router.get('/:id/diff/:v1/:v2', (req, res) => {
  const diff = NoteService.getNoteVersionDiff(
    req.params.id,
    parseInt(req.params.v1),
    parseInt(req.params.v2)
  );
  if (!diff) {
    return res.status(404).json({ error: '备注或版本未找到' });
  }
  res.json(diff);
});

router.get('/:id/trace', (req, res) => {
  const traceInfo = NoteService.getNoteTraceInfo(req.params.id);
  if (!traceInfo) {
    return res.status(404).json({ error: '备注未找到' });
  }
  res.json(traceInfo);
});

router.post('/', (req, res) => {
  const note = NoteService.createNote(req.body);
  res.status(201).json(note);
});

router.put('/:id/content', (req, res) => {
  const { content, editor } = req.body;
  const note = NoteService.updateNoteContent(req.params.id, content, editor);
  if (!note) {
    return res.status(404).json({ error: '备注未找到' });
  }
  res.json(note);
});

router.post('/:id/verify', (req, res) => {
  const { verifier, status } = req.body;
  const note = NoteService.verifyNote(req.params.id, verifier, status);
  if (!note) {
    return res.status(404).json({ error: '备注未找到' });
  }
  res.json(note);
});

router.post('/:id/rollback', (req, res) => {
  const { toVersion, editor } = req.body;
  const note = NoteService.rollbackNote(req.params.id, parseInt(toVersion), editor);
  if (note && note.error) {
    return res.status(400).json({ error: note.error });
  }
  if (!note) {
    return res.status(404).json({ error: '备注未找到' });
  }
  res.json(note);
});

router.get('/photo/:photoId/compare', (req, res) => {
  const comparisons = NoteService.comparePhotoNotes(req.params.photoId);
  res.json(comparisons);
});

router.delete('/:id', (req, res) => {
  const note = NoteService.deleteNote(req.params.id);
  if (!note) {
    return res.status(404).json({ error: '备注未找到' });
  }
  res.json(note);
});

module.exports = router;
