const BackgroundCheckService = require('../services/background-check.service');

class TaskController {
  static async createTask(req, res) {
    try {
      const { candidate, task } = req.body;
      const actor = req.user?.id;

      if (!candidate || !candidate.name || !candidate.email) {
        return res.status(400).json({ error: 'Candidate name and email are required' });
      }

      const result = await BackgroundCheckService.createTask(candidate, task || {}, actor);
      res.status(201).json(result);
    } catch (error) {
      console.error('Create task error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getTask(req, res) {
    try {
      const { taskId } = req.params;
      const task = await BackgroundCheckService.getTaskWithDetails(taskId);
      
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json(task);
    } catch (error) {
      console.error('Get task error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async submitMaterialRequirement(req, res) {
    try {
      const { taskId } = req.params;
      const { materials } = req.body;
      const actor = req.user?.id;

      if (!materials || !Array.isArray(materials) || materials.length === 0) {
        return res.status(400).json({ error: 'Materials are required' });
      }

      const result = await BackgroundCheckService.submitMaterialRequirement(taskId, materials, actor);
      res.json(result);
    } catch (error) {
      console.error('Submit material requirement error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  static async submitMaterials(req, res) {
    try {
      const { taskId } = req.params;
      const { materials } = req.body;
      const actor = req.user?.id;

      if (!materials || !Array.isArray(materials) || materials.length === 0) {
        return res.status(400).json({ error: 'Materials are required' });
      }

      const result = await BackgroundCheckService.submitMaterials(taskId, materials, actor);
      res.json(result);
    } catch (error) {
      console.error('Submit materials error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  static async sendToThirdParty(req, res) {
    try {
      const { taskId } = req.params;
      const { provider_name } = req.body;
      const actor = req.user?.id;

      if (!provider_name) {
        return res.status(400).json({ error: 'Provider name is required' });
      }

      const result = await BackgroundCheckService.sendToThirdParty(taskId, provider_name, actor);
      res.json(result);
    } catch (error) {
      console.error('Send to third party error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  static async handleThirdPartyCallback(req, res) {
    try {
      const { taskId } = req.params;
      const callbackData = req.body;
      const actor = req.user?.id;

      if (!callbackData.status) {
        return res.status(400).json({ error: 'Callback status is required' });
      }

      const result = await BackgroundCheckService.handleThirdPartyCallback(taskId, callbackData, actor);
      res.json(result);
    } catch (error) {
      console.error('Handle callback error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  static async makeDecision(req, res) {
    try {
      const { taskId } = req.params;
      const { decision, reason } = req.body;
      const actor = req.user?.id;

      if (!decision || !reason) {
        return res.status(400).json({ error: 'Decision and reason are required' });
      }

      const result = await BackgroundCheckService.makeDecision(taskId, decision, reason, actor);
      res.json(result);
    } catch (error) {
      console.error('Make decision error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  static async cancelTask(req, res) {
    try {
      const { taskId } = req.params;
      const { reason } = req.body;
      const actor = req.user?.id;

      if (!reason) {
        return res.status(400).json({ error: 'Cancel reason is required' });
      }

      const result = await BackgroundCheckService.cancelTask(taskId, reason, actor);
      res.json(result);
    } catch (error) {
      console.error('Cancel task error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  static async addRiskTag(req, res) {
    try {
      const { taskId } = req.params;
      const tagData = req.body;
      const actor = req.user?.id;

      if (!tagData.tag_name || !tagData.risk_level) {
        return res.status(400).json({ error: 'Tag name and risk level are required' });
      }

      const result = await BackgroundCheckService.addRiskTag(taskId, tagData, actor);
      res.status(201).json(result);
    } catch (error) {
      console.error('Add risk tag error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  static async resolveRiskTag(req, res) {
    try {
      const { tagId } = req.params;
      const { resolution_notes } = req.body;
      const actor = req.user?.id;

      if (!resolution_notes) {
        return res.status(400).json({ error: 'Resolution notes are required' });
      }

      const result = await BackgroundCheckService.resolveRiskTag(tagId, resolution_notes, actor);
      res.json(result);
    } catch (error) {
      console.error('Resolve risk tag error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  static async getTasksByStatus(req, res) {
    try {
      const { status } = req.query;
      const tasks = await BackgroundCheckService.getTasksByStatus(status);
      res.json(tasks);
    } catch (error) {
      console.error('Get tasks error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = TaskController;
