const { v4: uuidv4 } = require('uuid');

class ShadowRequest {
  constructor({
    id,
    experimentId,
    endpoint,
    tenantId,
    requestId,
    requestBody,
    requestHeaders,
    oldResponse,
    newResponse,
    processedAt,
    differences = [],
    hasSideEffectRisk = false,
    sideEffectRisk = null
  }) {
    this.id = id || uuidv4();
    this.experimentId = experimentId;
    this.endpoint = endpoint;
    this.tenantId = tenantId;
    this.requestId = requestId;
    this.requestBody = requestBody;
    this.requestHeaders = requestHeaders;
    this.oldResponse = oldResponse;
    this.newResponse = newResponse;
    this.processedAt = processedAt || new Date();
    this.differences = differences;
    this.hasSideEffectRisk = hasSideEffectRisk;
    this.sideEffectRisk = sideEffectRisk;
  }

  hasDifferences() {
    return this.differences.length > 0 || this.hasSideEffectRisk;
  }
}

module.exports = ShadowRequest;
