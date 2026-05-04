const express = require('express');
const router = express.Router();
const multer = require('multer');
const ContextPackage = require('../models/ContextPackage');
const Task = require('../models/Task');
const fileService = require('../services/fileService');
const tokenService = require('../services/tokenService');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = {
      'conversations': /\.jsonl$/,
      'docs': /\.md$/,
      'toolResults': /\.json$/,
      'budget': /\.yaml$/
    };
    
    const fieldName = file.fieldname;
    if (allowedTypes[fieldName]) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid field name: ${fieldName}`), false);
    }
  }
});

router.post('/upload', upload.fields([
  { name: 'conversations', maxCount: 1 },
  { name: 'docs', maxCount: 1 },
  { name: 'toolResults', maxCount: 1 },
  { name: 'budget', maxCount: 1 }
]), async (req, res) => {
  try {
    const { taskId } = req.body;
    
    if (taskId) {
      const task = Task.findById(taskId);
      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found'
        });
      }
    }
    
    const processed = fileService.processUploadedFiles(req.files);
    
    if (processed.errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors: processed.errors
      });
    }
    
    const hasData = 
      processed.conversations !== null ||
      processed.docs !== null ||
      processed.toolResults !== null ||
      processed.budget !== null;
    
    if (!hasData) {
      return res.status(400).json({
        success: false,
        error: 'At least one file is required'
      });
    }
    
    const contextPackage = ContextPackage.create({
      taskId: taskId || null,
      conversations: processed.conversations,
      docs: processed.docs,
      toolResults: processed.toolResults,
      budget: processed.budget
    });
    
    res.status(201).json({
      success: true,
      data: contextPackage.toJSON()
    });
  } catch (error) {
    console.error('Error uploading context:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/analyze', async (req, res) => {
  try {
    const { conversations, docs, toolResults, budget } = req.body;
    
    const contextData = {
      conversations: conversations || [],
      docs: docs || '',
      toolResults: toolResults || null,
      budgetConstraints: budget || {}
    };
    
    const tokenCount = tokenService.estimateContextTokens({
      conversations: contextData.conversations,
      docs: contextData.docs,
      toolResults: contextData.toolResults,
      budgetYaml: JSON.stringify(contextData.budgetConstraints, null, 2)
    });
    
    const breakdown = {
      conversations: tokenService.countConversationTokens(contextData.conversations),
      docs: tokenService.countTokens(contextData.docs),
      toolResults: tokenService.countToolResultsTokens(contextData.toolResults),
      budget: tokenService.countTokens(JSON.stringify(contextData.budgetConstraints, null, 2))
    };
    
    res.json({
      success: true,
      data: {
        totalTokens: tokenCount,
        breakdown,
        summary: {
          conversationCount: contextData.conversations.length,
          docsLength: contextData.docs.length,
          hasToolResults: !!contextData.toolResults,
          hasBudget: Object.keys(contextData.budgetConstraints).length > 0
        }
      }
    });
  } catch (error) {
    console.error('Error analyzing context:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const contextPackage = ContextPackage.findById(id);
    
    if (!contextPackage) {
      return res.status(404).json({
        success: false,
        error: 'Context package not found'
      });
    }
    
    res.json({
      success: true,
      data: contextPackage.toJSON()
    });
  } catch (error) {
    console.error('Error fetching context package:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const contextPackage = ContextPackage.findById(id);
    
    if (!contextPackage) {
      return res.status(404).json({
        success: false,
        error: 'Context package not found'
      });
    }
    
    const Evaluation = require('../models/Evaluation');
    const evaluations = Evaluation.findByContextPackageId(id);
    for (const e of evaluations) {
      e.delete();
    }
    
    contextPackage.delete();
    
    res.json({
      success: true,
      message: 'Context package deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting context package:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
