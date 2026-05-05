const store = require('../store');
const analysisService = require('../services/analysisService');

class AnalysisController {
  analyzeMessage(req, res) {
    try {
      const { messageId } = req.params;
      const { taskId } = req.query;

      const result = analysisService.analyzeMessage(messageId, taskId);
      res.json({
        success: true,
        data: result.toJSON()
      });
    } catch (error) {
      if (error.message.includes('Message not found')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getMessageDeliveryChain(req, res) {
    try {
      const { messageId } = req.params;

      const result = analysisService.getMessageDeliveryChain(messageId);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      if (error.message.includes('Message not found')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  replayMessage(req, res) {
    try {
      const { messageId } = req.params;
      const { consumerGroup, taskId } = req.body;

      if (!consumerGroup) {
        return res.status(400).json({
          success: false,
          error: 'consumerGroup is required'
        });
      }

      const result = analysisService.replayMessage(messageId, consumerGroup, taskId);
      res.json({
        success: true,
        message: 'Replay simulation completed',
        data: result
      });
    } catch (error) {
      if (error.message.includes('Message not found')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  batchAnalyze(req, res) {
    try {
      const { messageIds, taskId } = req.body;

      if (!messageIds || !Array.isArray(messageIds)) {
        return res.status(400).json({
          success: false,
          error: 'messageIds must be an array'
        });
      }

      const result = analysisService.batchAnalyze(messageIds, taskId);
      res.json({
        success: true,
        message: `Batch analysis completed: ${result.success} successful, ${result.failed} failed`,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getStatistics(req, res) {
    try {
      const stats = analysisService.getStatistics();
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getAnalysisResult(req, res) {
    try {
      const { id } = req.params;
      const result = store.getAnalysisResult(id);

      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'Analysis result not found'
        });
      }

      res.json({
        success: true,
        data: result.toJSON()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getAllAnalysisResults(req, res) {
    try {
      const { taskId, messageId } = req.query;
      let results;

      if (taskId) {
        results = store.getAnalysisResultsByTaskId(taskId);
      } else if (messageId) {
        results = store.getAnalysisResultsByMessageId(messageId);
      } else {
        results = store.getAllAnalysisResults();
      }

      res.json({
        success: true,
        count: results.length,
        data: results.map(r => r.toJSON())
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new AnalysisController();
