const crypto = require('crypto');

function summarizePayload(payload) {
  try {
    const obj = typeof payload === 'string' ? JSON.parse(payload) : payload;
    const summary = {};
    const sensitive = ['card_number', 'cvv', 'password', 'secret', 'private_key'];
    
    for (const [k, v] of Object.entries(obj)) {
      if (sensitive.includes(k.toLowerCase())) {
        summary[k] = '[REDACTED]';
      } else if (typeof v === 'object') {
        summary[k] = '[OBJECT]';
      } else {
        summary[k] = String(v).substring(0, 200);
      }
    }
    return JSON.stringify(summary);
  } catch (e) {
    return `Summary failed: ${e.message}`;
  }
}

async function processBusinessEvent(eventType, payload) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const obj = typeof payload === 'string' ? JSON.parse(payload) : payload;
        
        if (eventType === 'payment.succeeded') {
          if (!obj.order_id) {
            return reject(new Error('Missing order_id in payment event'));
          }
          return resolve({
            success: true,
            action: 'processed_payment',
            order_id: obj.order_id,
            amount: obj.amount
          });
        }
        
        if (eventType === 'shipping.updated') {
          if (!obj.tracking_number) {
            return reject(new Error('Missing tracking_number in shipping event'));
          }
          return resolve({
            success: true,
            action: 'updated_shipping',
            tracking_number: obj.tracking_number,
            status: obj.status
          });
        }

        return resolve({
          success: true,
          action: 'ignored_unknown_event',
          event_type: eventType
        });
      } catch (e) {
        reject(new Error(`Business processing failed: ${e.message}`));
      }
    }, 50);
  });
}

module.exports = {
  summarizePayload,
  processBusinessEvent
};
