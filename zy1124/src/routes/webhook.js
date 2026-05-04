const express = require('express');
const router = express.Router();
const { getProviderByName } = require('../dao/providerDao');
const { createEvent, getEventById } = require('../dao/eventDao');
const { verifySignature, extractEventIdFromBody, SIGNATURE_ERRORS } = require('../services/signatureService');
const { processEvent } = require('../services/eventService');
const { createAuditLog, ACTIONS } = require('../dao/auditDao');

async function receiveWebhook(providerName, req, res) {
  try {
    const provider = await getProviderByName(providerName);
    
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: `Provider '${providerName}' not found`,
      });
    }
    
    if (!provider.enabled) {
      return res.status(400).json({
        success: false,
        error: `Provider '${providerName}' is disabled`,
      });
    }
    
    const rawBody = req.rawBody;
    const headers = req.headers;
    
    const signatureResult = verifySignature(rawBody, headers, provider);
    
    if (!signatureResult.valid) {
      await createAuditLog(
        signatureResult.error === SIGNATURE_ERRORS.TIMESTAMP_EXPIRED 
          ? ACTIONS.EVENT_TIMESTAMP_EXPIRED 
          : ACTIONS.EVENT_SIGNATURE_FAILED,
        'provider',
        provider.id,
        {
          error: signatureResult.error,
          message: signatureResult.message,
          details: signatureResult.details,
        }
      );
      
      return res.status(401).json({
        success: false,
        error: signatureResult.error,
        message: signatureResult.message,
        details: signatureResult.details,
      });
    }
    
    const eventId = extractEventIdFromBody(rawBody, provider.event_id_key);
    
    const eventResult = await createEvent({
      provider_id: provider.id,
      provider_name: provider.name,
      event_id: eventId,
      raw_body: rawBody,
      headers: headers,
      method: req.method,
      path: req.path,
    });
    
    if (eventResult.duplicate) {
      await createAuditLog(
        ACTIONS.EVENT_DUPLICATE,
        'event',
        eventResult.event.id,
        {
          event_id: eventResult.event.event_id,
          payload_hash: eventResult.event.payload_hash,
        }
      );
      
      return res.status(200).json({
        success: true,
        duplicate: true,
        message: 'Duplicate event received and ignored',
        event_id: eventResult.event.id,
      });
    }
    
    const event = eventResult.event;
    
    await createAuditLog(
      ACTIONS.EVENT_RECEIVED,
      'event',
      event.id,
      {
        provider_name: provider.name,
        event_id: event.event_id,
      }
    );
    
    const processResult = await processEvent(event, provider, false);
    
    return res.status(processResult.success ? 200 : 202).json({
      success: true,
      event_id: event.id,
      processed: processResult.success,
      retryable: processResult.retryable,
      discarded: processResult.discarded,
      next_retry_at: processResult.nextRetryAt,
    });
    
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({
      success: false,
      error: 'Processing error',
      message: err.message,
    });
  }
}

router.post('/:providerName', async (req, res) => {
  await receiveWebhook(req.params.providerName, req, res);
});

router.post('/:providerName/*', async (req, res) => {
  await receiveWebhook(req.params.providerName, req, res);
});

module.exports = router;
