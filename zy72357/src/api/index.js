const UnifiedDataAccess = require('../data/UnifiedDataAccess');

class EvaluationAPI {
  constructor() {
    this.dataAccess = new UnifiedDataAccess();
  }

  async createEvaluation(req, res) {
    try {
      const { operator = '老唐' } = req.body;
      const evaluationId = this.dataAccess.startNewEvaluation(operator);
      
      res.json({
        success: true,
        evaluationId,
        message: '评估已创建',
        nextStep: '导入温度校准记录'
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async step1_importTemperature(req, res) {
    try {
      const { evaluationId } = req.params;
      const { records } = req.body;
      
      const result = await this.dataAccess.executeStep1(evaluationId, records);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async step2_importSensors(req, res) {
    try {
      const { evaluationId } = req.params;
      const { records, reviewer = '老唐' } = req.body;
      
      const result = await this.dataAccess.executeStep2(evaluationId, records, reviewer);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async step3_updateExperiment(req, res) {
    try {
      const { evaluationId } = req.params;
      const { updateData = {}, operator = '系统' } = req.body;
      
      const result = await this.dataAccess.executeStep3(evaluationId, updateData, operator);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async supplementData(req, res) {
    try {
      const { evaluationId, recordId } = req.params;
      const { updates, operator, reason } = req.body;
      
      const result = this.dataAccess.supplementData(evaluationId, recordId, updates, operator, reason);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async qualityReview(req, res) {
    try {
      const { evaluationId, recordId } = req.params;
      const { reviewer, decision, notes } = req.body;
      
      const result = this.dataAccess.qualityReview(evaluationId, recordId, reviewer, decision, notes);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async recalculate(req, res) {
    try {
      const { evaluationId } = req.params;
      
      const result = this.dataAccess.recalculate(evaluationId);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getResults(req, res) {
    try {
      const { evaluationId } = req.params;
      
      const result = this.dataAccess.getResultsForAPI(evaluationId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getExportData(req, res) {
    try {
      const { evaluationId } = req.params;
      
      const result = this.dataAccess.getResultsForExport(evaluationId);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getDisplayData(req, res) {
    try {
      const { evaluationId } = req.params;
      
      const result = this.dataAccess.getResultsForDisplay(evaluationId);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getAuditTrail(req, res) {
    try {
      const { evaluationId, recordId } = req.params;
      
      const result = this.dataAccess.getAuditTrail(evaluationId, recordId);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getWorkflowStatus(req, res) {
    try {
      const { evaluationId } = req.params;
      
      const result = this.dataAccess.getWorkflowStatus(evaluationId);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async verifyConsistency(req, res) {
    try {
      const { evaluationId } = req.params;
      
      const result = this.dataAccess.verifyDataConsistency(evaluationId);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = EvaluationAPI;
