const sampleService = require('../services/sampleService');
const { v4: uuidv4 } = require('uuid');
const { ErrorCode, StepType } = require('../constants/status');

const formatResponse = (res, result) => {
  const statusCode = result.success ? 200 : 
    result.code === ErrorCode.PARAM_ERROR ? 400 :
    result.code === ErrorCode.SAMPLE_NOT_FOUND ? 404 :
    result.code === ErrorCode.STATE_TRANSITION_ERROR ||
    result.code === ErrorCode.DUPLICATE_REQUEST ||
    result.code === ErrorCode.BARCODE_IDEMPOTENT ? 409 : 500;

  return res.status(statusCode).json({
    code: result.code,
    success: result.success,
    message: result.message,
    data: result.data
  });
};

class SampleController {
  async createSample(req, res) {
    const { barcode, handler } = req.body;

    if (!barcode) {
      return formatResponse(res, {
        success: false,
        code: ErrorCode.PARAM_ERROR,
        message: '条码不能为空'
      });
    }

    const result = await sampleService.createSample(barcode, handler);
    return formatResponse(res, result);
  }

  async collect(req, res) {
    const { barcode, handler, detail } = req.body;
    const requestId = req.headers['x-request-id'] || uuidv4();

    const result = await sampleService.executeStep(
      barcode,
      StepType.COLLECT,
      requestId,
      handler,
      detail
    );

    return formatResponse(res, result);
  }

  async centrifuge(req, res) {
    const { barcode, handler, detail } = req.body;
    const requestId = req.headers['x-request-id'] || uuidv4();

    const result = await sampleService.executeStep(
      barcode,
      StepType.CENTRIFUGE,
      requestId,
      handler,
      detail
    );

    return formatResponse(res, result);
  }

  async test(req, res) {
    const { barcode, handler, detail } = req.body;
    const requestId = req.headers['x-request-id'] || uuidv4();

    const result = await sampleService.executeStep(
      barcode,
      StepType.TEST,
      requestId,
      handler,
      detail
    );

    return formatResponse(res, result);
  }

  async review(req, res) {
    const { barcode, handler, detail } = req.body;
    const requestId = req.headers['x-request-id'] || uuidv4();

    const result = await sampleService.executeStep(
      barcode,
      StepType.REVIEW,
      requestId,
      handler,
      detail
    );

    return formatResponse(res, result);
  }

  async reportException(req, res) {
    const { barcode, reason, handler, detail } = req.body;

    if (!reason) {
      return formatResponse(res, {
        success: false,
        code: ErrorCode.PARAM_ERROR,
        message: '异常原因不能为空'
      });
    }

    const result = await sampleService.reportException(barcode, reason, handler, detail);
    return formatResponse(res, result);
  }

  async resolveException(req, res) {
    const { barcode, targetStep, handler, detail } = req.body;

    if (!targetStep) {
      return formatResponse(res, {
        success: false,
        code: ErrorCode.PARAM_ERROR,
        message: '目标步骤不能为空'
      });
    }

    const result = await sampleService.resolveException(barcode, targetStep, handler, detail);
    return formatResponse(res, result);
  }

  async getSample(req, res) {
    const { barcode } = req.params;
    const result = await sampleService.getSampleByBarcode(barcode);
    return formatResponse(res, result);
  }

  async querySamples(req, res) {
    const { status, barcode, limit, offset } = req.query;
    const result = await sampleService.querySamples({
      status,
      barcode,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    });
    return formatResponse(res, result);
  }

  async queryAudits(req, res) {
    const { barcode, sampleId, stepType, action, limit, offset } = req.query;
    const result = await sampleService.queryAudits({
      barcode,
      sampleId,
      stepType,
      action,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    });
    return formatResponse(res, result);
  }

  async getStatistics(req, res) {
    const { startDate, endDate } = req.query;
    const result = await sampleService.getStatistics({ startDate, endDate });
    return formatResponse(res, result);
  }
}

module.exports = new SampleController();
