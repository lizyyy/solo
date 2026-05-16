const Joi = require('joi');
const eventStore = require('../models/EventStore');
const correctionService = require('../services/CorrectionService');

class CorrectionController {
  createAggregateSchema = Joi.object({
    type: Joi.string().required(),
    aggregateId: Joi.string().optional()
  });

  addEventSchema = Joi.object({
    aggregateId: Joi.string().required(),
    eventType: Joi.string().required(),
    payload: Joi.object().required(),
    metadata: Joi.object().optional()
  });

  createCorrectionSchema = Joi.object({
    originalEventId: Joi.string().required(),
    reason: Joi.string().min(5).required(),
    correctedPayload: Joi.object().required(),
    operator: Joi.string().required(),
    metadata: Joi.object().optional()
  });

  applyCorrectionSchema = Joi.object({
    correctionId: Joi.string().required(),
    operator: Joi.string().required(),
    manualOverride: Joi.boolean().optional().default(false)
  });

  handleFailedSchema = Joi.object({
    correctionId: Joi.string().required(),
    rawInput: Joi.any().required(),
    processingBasis: Joi.string().required(),
    finalConclusion: Joi.string().required(),
    operator: Joi.string().required()
  });

  manualCorrectionSchema = Joi.object({
    correctionId: Joi.string().required(),
    updatedPayload: Joi.object().required(),
    reason: Joi.string().required(),
    operator: Joi.string().required()
  });

  async createAggregate(req, res) {
    try {
      const { error, value } = this.createAggregateSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const aggregate = eventStore.createAggregate(value.type, value.aggregateId);
      res.status(201).json(aggregate);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async addOriginalEvent(req, res) {
    try {
      const { error, value } = this.addEventSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const event = eventStore.addOriginalEvent(
        value.aggregateId,
        value.eventType,
        value.payload,
        value.metadata
      );
      res.status(201).json(event);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async createCorrection(req, res) {
    try {
      const { error, value } = this.createCorrectionSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const correction = await correctionService.createCorrection(
        value.originalEventId,
        value.reason,
        value.correctedPayload,
        value.operator,
        value.metadata
      );
      res.status(201).json(correction);
    } catch (err) {
      if (err.message.includes('already')) {
        return res.status(409).json({ error: err.message });
      }
      res.status(500).json({ error: err.message });
    }
  }

  async getCorrection(req, res) {
    try {
      const { correctionId } = req.params;
      const details = correctionService.getCorrectionDetails(correctionId);
      
      if (!details) {
        return res.status(404).json({ error: 'Correction not found' });
      }
      
      res.json(details);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async listCorrections(req, res) {
    try {
      const { status, aggregateId } = req.query;
      
      let corrections;
      if (aggregateId) {
        corrections = eventStore.getCorrectionsByAggregate(aggregateId);
      } else {
        corrections = eventStore.getAllCorrections(status);
      }
      
      res.json(corrections);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async replayAndValidate(req, res) {
    try {
      const { correctionId } = req.params;
      const result = await correctionService.replayAndValidate(correctionId);
      res.json(result);
    } catch (err) {
      if (err.message.includes('already processed')) {
        return res.status(409).json({ error: err.message });
      }
      res.status(500).json({ error: err.message });
    }
  }

  async applyCorrection(req, res) {
    try {
      const { error, value } = this.applyCorrectionSchema.validate({
        correctionId: req.params.correctionId,
        ...req.body
      });
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const result = await correctionService.applyCorrection(
        value.correctionId,
        value.operator,
        value.manualOverride
      );
      res.json(result);
    } catch (err) {
      if (err.message.includes('already applied')) {
        return res.status(409).json({ error: err.message });
      }
      res.status(500).json({ error: err.message });
    }
  }

  async generateReport(req, res) {
    try {
      const { correctionId } = req.params;
      const report = await correctionService.generateReport(correctionId);
      res.json(report);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async handleFailedCorrection(req, res) {
    try {
      const { error, value } = this.handleFailedSchema.validate({
        correctionId: req.params.correctionId,
        ...req.body
      });
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const result = await correctionService.handleFailedCorrection(
        value.correctionId,
        value.rawInput,
        value.processingBasis,
        value.finalConclusion,
        value.operator
      );
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async manualCorrection(req, res) {
    try {
      const { error, value } = this.manualCorrectionSchema.validate({
        correctionId: req.params.correctionId,
        ...req.body
      });
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const result = await correctionService.manualCorrection(
        value.correctionId,
        value.updatedPayload,
        value.reason,
        value.operator
      );
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async exportReport(req, res) {
    try {
      const { reportId } = req.params;
      const exportData = correctionService.exportReport(reportId);
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="correction-report-${reportId}.json"`);
      res.json(exportData);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async getAggregate(req, res) {
    try {
      const { aggregateId } = req.params;
      const aggregate = eventStore.getAggregate(aggregateId);
      
      if (!aggregate) {
        return res.status(404).json({ error: 'Aggregate not found' });
      }
      
      const events = eventStore.getOriginalEvents(aggregateId);
      const corrections = eventStore.getCorrectionsByAggregate(aggregateId);
      const reports = eventStore.getReportsByAggregate(aggregateId);
      
      res.json({
        aggregate,
        events,
        corrections,
        reports
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async listAggregates(req, res) {
    try {
      const aggregates = eventStore.getAllAggregates();
      res.json(aggregates);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async getEvent(req, res) {
    try {
      const { eventId } = req.params;
      const event = eventStore.getOriginalEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      
      res.json(event);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async getReport(req, res) {
    try {
      const { reportId } = req.params;
      const report = eventStore.getCorrectionReport(reportId);
      
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }
      
      res.json(report);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new CorrectionController();
