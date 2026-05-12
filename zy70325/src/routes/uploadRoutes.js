const express = require('express');
const multer = require('multer');
const uploadService = require('../services/uploadService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/sessions', async (req, res) => {
  try {
    const { fileName, fileSize, totalChunks, chunkSize, fileHash } = req.body;
    
    if (!fileName || !fileSize || !totalChunks || !chunkSize || !fileHash) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PARAMETERS',
        message: '缺少必要参数'
      });
    }
    
    const result = uploadService.createSession({
      fileName,
      fileSize: parseInt(fileSize),
      totalChunks: parseInt(totalChunks),
      chunkSize: parseInt(chunkSize),
      fileHash
    });
    
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/sessions/:sessionId/chunks/:chunkNumber', upload.single('chunk'), async (req, res) => {
  try {
    const { sessionId, chunkNumber } = req.params;
    const { chunkHash } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_CHUNK',
        message: '缺少分片文件'
      });
    }
    
    if (!chunkHash) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_CHUNK_HASH',
        message: '缺少分片校验值'
      });
    }
    
    const result = await uploadService.uploadChunk(
      sessionId,
      parseInt(chunkNumber),
      req.file.buffer,
      chunkHash
    );
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      if (result.error === 'SESSION_NOT_FOUND' || 
          result.error === 'SESSION_CANCELLED' || 
          result.error === 'SESSION_EXPIRED') {
        res.status(410).json(result);
      } else {
        res.status(400).json(result);
      }
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/sessions/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = uploadService.getSessionStatus(sessionId);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/sessions', (req, res) => {
  try {
    const result = uploadService.listSessions();
    res.status(200).json({
      success: true,
      sessions: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/sessions/:sessionId/complete', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await uploadService.completeUpload(sessionId);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      if (result.error === 'SESSION_NOT_FOUND') {
        res.status(404).json(result);
      } else {
        res.status(400).json(result);
      }
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/sessions/:sessionId/cancel', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await uploadService.cancelUpload(sessionId);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      if (result.error === 'SESSION_NOT_FOUND') {
        res.status(404).json(result);
      } else {
        res.status(400).json(result);
      }
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/cleanup', async (req, res) => {
  try {
    const result = await uploadService.cleanupExpiredSessions();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/sessions/:sessionId/chunks', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await uploadService.getChunkRecords(sessionId);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

module.exports = router;
