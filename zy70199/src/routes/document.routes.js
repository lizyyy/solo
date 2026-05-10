const express = require('express');
const DocumentService = require('../services/document.service');
const { ValidationError } = require('../utils/error-handler');

const router = express.Router();

router.get('/catalog', (req, res) => {
  try {
    DocumentService.initializeCatalog();
    res.json(DocumentService.getCatalog());
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/initialize/:employeeId', (req, res) => {
  try {
    const documents = DocumentService.initializeEmployeeDocuments(
      req.params.employeeId,
      req.headers['x-user-id'] || 'system'
    );
    res.json(documents);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/employee/:employeeId', (req, res) => {
  try {
    const result = DocumentService.getEmployeeDocuments(req.params.employeeId);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/submit/:employeeId/:documentId', (req, res) => {
  try {
    if (!req.body.fileUrl && !req.body.content) {
      throw new ValidationError('提交资料必须提供文件URL或内容');
    }
    
    const document = DocumentService.submitDocument(
      req.params.employeeId,
      req.params.documentId,
      req.body,
      req.headers['x-user-id'] || 'system'
    );
    res.json(document);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/approve/:employeeId/:documentId', (req, res) => {
  try {
    const document = DocumentService.approveDocument(
      req.params.employeeId,
      req.params.documentId,
      req.headers['x-user-id'] || 'admin'
    );
    res.json(document);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/reject/:employeeId/:documentId', (req, res) => {
  try {
    if (!req.body.reason) {
      throw new ValidationError('拒绝原因是必填项');
    }
    
    const document = DocumentService.rejectDocument(
      req.params.employeeId,
      req.params.documentId,
      req.body.reason,
      req.headers['x-user-id'] || 'admin'
    );
    res.json(document);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/waive/:employeeId/:documentId', (req, res) => {
  try {
    if (!req.body.reason) {
      throw new ValidationError('豁免原因是必填项');
    }
    
    const document = DocumentService.waiveDocument(
      req.params.employeeId,
      req.params.documentId,
      req.body.reason,
      req.headers['x-user-id'] || 'admin'
    );
    res.json(document);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

module.exports = router;
