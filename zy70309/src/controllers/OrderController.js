const eventSourcingService = require('../services/OrderEventSourcingService');
const explanationService = require('../services/ExplanationService');
const { generateOrderId } = require('../utils/idGenerator');
const { AppError } = require('../utils/errorHandler');

class OrderController {
  async createOrder(req, res, next) {
    try {
      const orderId = generateOrderId();
      const { payload, metadata } = req.body;

      const result = await eventSourcingService.appendEvent(
        orderId,
        {
          eventType: 'ORDER_CREATED',
          payload,
          metadata
        }
      );

      res.status(201).json({
        success: true,
        data: {
          orderId,
          event: result.event,
          projection: result.projection,
          description: result.description
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async appendEvent(req, res, next) {
    try {
      const { orderId } = req.params;
      const eventData = req.body;

      const result = await eventSourcingService.appendEvent(orderId, eventData);

      const statusCode = result.isIdempotent ? 200 : 201;
      res.status(statusCode).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getTimeline(req, res, next) {
    try {
      const { orderId } = req.params;
      const options = {
        includeAll: req.query.includeAll === 'true'
      };

      const timeline = await eventSourcingService.getOrderTimeline(orderId, options);

      res.json({
        success: true,
        data: timeline
      });
    } catch (error) {
      next(error);
    }
  }

  async replayToPoint(req, res, next) {
    try {
      const { orderId } = req.params;
      const { toVersion, toEventId, toTime } = req.body;

      const replayOptions = {};
      if (toVersion !== undefined) replayOptions.toVersion = toVersion;
      if (toEventId) replayOptions.toEventId = toEventId;
      if (toTime) replayOptions.toTime = toTime;

      const result = await eventSourcingService.replayToPoint(orderId, replayOptions);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async rebuildProjection(req, res, next) {
    try {
      const { orderId } = req.params;

      const result = await eventSourcingService.rebuildProjection(orderId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getProjection(req, res, next) {
    try {
      const { orderId } = req.params;

      const projection = await eventSourcingService.getProjection(orderId);

      res.json({
        success: true,
        data: projection
      });
    } catch (error) {
      next(error);
    }
  }

  async checkConsistency(req, res, next) {
    try {
      const { orderId } = req.params;

      const result = await eventSourcingService.checkConsistency(orderId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getExplanationReport(req, res, next) {
    try {
      const { orderId } = req.params;
      const includeRawData = req.query.includeRawData === 'true';

      const report = await explanationService.generateExplanationReport(
        orderId,
        { includeRawData }
      );

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      next(error);
    }
  }

  async exportReportAsText(req, res, next) {
    try {
      const { orderId } = req.params;

      const textReport = await explanationService.exportReportAsText(orderId);

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="order-${orderId}-report.txt"`);
      res.send(textReport);
    } catch (error) {
      next(error);
    }
  }

  async appendCompensationEvent(req, res, next) {
    try {
      const { orderId } = req.params;
      const { compensatesEventId, eventType, payload, metadata } = req.body;

      if (!compensatesEventId) {
        throw new AppError('补偿事件必须指定 compensatesEventId', 400, 'MISSING_COMPENSATES_EVENT_ID');
      }

      const result = await eventSourcingService.appendEvent(
        orderId,
        {
          eventType: eventType || 'COMPENSATION_EVENT',
          isCompensation: true,
          compensatesEventId,
          payload: payload || {},
          metadata: metadata || {}
        }
      );

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new OrderController();
