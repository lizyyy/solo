const express = require('express');
const router = express.Router();
const { addManualNote, getFactNotes } = require('../services/operationHistory');

router.post('/fact/:factId', async (req, res) => {
  try {
    const { author, note_type, content, attachments } = req.body;
    
    if (!author || !note_type || !content) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段'
      });
    }
    
    const noteId = addManualNote(
      req.params.factId,
      author,
      note_type,
      content,
      attachments
    );
    
    res.json({
      success: true,
      data: { note_id: noteId }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/fact/:factId', async (req, res) => {
  try {
    const notes = getFactNotes(req.params.factId);
    
    res.json({
      success: true,
      data: notes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
