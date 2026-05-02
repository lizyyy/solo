import express, { Request, Response, Router } from 'express';
import { signatureService } from '../signature';

const router = Router();
router.use(express.json());

const DEFAULT_SECRET = 'test-secret-12345';
const processedIdempotencyKeys = new Map<string, { count: number; firstSeen: number }>();

interface WebhookRequest extends Request {
  body: Record<string, unknown>;
}

function getSecret(eventType?: string): string {
  const secretMap: Record<string, string> = {
    'order.paid': 'order-secret-123',
    'stock.locked': 'stock-secret-456',
    'repo.pushed': 'repo-secret-789',
  };
  return secretMap[eventType || ''] || DEFAULT_SECRET;
}

router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'webhook-receiver' });
});

router.post('/webhook', (req: WebhookRequest, res: Response) => {
  const signatureHeader = req.headers['x-webhook-signature'] as string;
  const eventType = req.headers['x-webhook-event'] as string;
  const idempotencyKey = req.headers['x-idempotency-key'] as string;
  const payload = req.body;

  if (!signatureHeader) {
    res.status(400).json({ error: 'Missing signature header', code: 'MISSING_SIGNATURE' });
    return;
  }

  const parsed = signatureService.parseSignatureHeader(signatureHeader);
  if (!parsed) {
    res.status(400).json({ error: 'Invalid signature format', code: 'INVALID_SIGNATURE_FORMAT' });
    return;
  }

  const secret = getSecret(eventType);
  const isValid = signatureService.verifySignature(
    payload,
    parsed.signature,
    secret,
    parsed.timestamp,
    300000
  );

  if (!isValid) {
    res.status(401).json({ 
      error: 'Invalid signature', 
      code: 'INVALID_SIGNATURE',
      debug: {
        receivedSignature: parsed.signature.substring(0, 20) + '...',
        expectedSecret: secret.substring(0, 5) + '...',
      }
    });
    return;
  }

  let isDuplicate = false;
  if (idempotencyKey) {
    const existing = processedIdempotencyKeys.get(idempotencyKey);
    if (existing) {
      existing.count++;
      isDuplicate = true;
    } else {
      processedIdempotencyKeys.set(idempotencyKey, {
        count: 1,
        firstSeen: Date.now(),
      });
    }
  }

  if (isDuplicate) {
    res.status(200).json({
      status: 'duplicate_ignored',
      message: 'Idempotency key already processed',
      idempotencyKey,
      processingCount: processedIdempotencyKeys.get(idempotencyKey)?.count || 0,
    });
    return;
  }

  res.status(200).json({
    status: 'success',
    message: 'Webhook processed successfully',
    eventType,
    idempotencyKey,
    payload,
  });
});

router.post('/webhook/fail', (req: WebhookRequest, res: Response) => {
  const failType = req.query.type as string;

  switch (failType) {
    case 'timeout':
      setTimeout(() => {
        res.status(504).json({ error: 'Gateway Timeout', code: 'TIMEOUT' });
      }, 15000);
      return;

    case 'rate_limit':
      res.setHeader('Retry-After', '10');
      res.status(429).json({ error: 'Too Many Requests', code: 'RATE_LIMIT' });
      return;

    case 'server_error':
      res.status(500).json({ error: 'Internal Server Error', code: 'SERVER_ERROR' });
      return;

    case 'bad_gateway':
      res.status(502).json({ error: 'Bad Gateway', code: 'BAD_GATEWAY' });
      return;

    case 'unavailable':
      res.status(503).json({ error: 'Service Unavailable', code: 'SERVICE_UNAVAILABLE' });
      return;

    default:
      res.status(500).json({ 
        error: 'Simulated failure', 
        code: 'SIMULATED_FAILURE',
        availableFailTypes: ['timeout', 'rate_limit', 'server_error', 'bad_gateway', 'unavailable']
      });
      return;
  }
});

router.get('/webhook/idempotency-keys', (req: Request, res: Response) => {
  const keys = Array.from(processedIdempotencyKeys.entries()).map(([key, info]) => ({
    key,
    count: info.count,
    firstSeen: new Date(info.firstSeen).toISOString(),
  }));

  res.json({
    data: keys,
    total: keys.length,
  });
});

router.delete('/webhook/idempotency-keys', (req: Request, res: Response) => {
  const count = processedIdempotencyKeys.size;
  processedIdempotencyKeys.clear();
  res.json({
    message: `Cleared ${count} idempotency keys`,
    cleared: count,
  });
});

router.post('/webhook/order-paid', (req: WebhookRequest, res: Response) => {
  const signatureHeader = req.headers['x-webhook-signature'] as string;
  const idempotencyKey = req.headers['x-idempotency-key'] as string;
  const payload = req.body;

  if (!signatureHeader) {
    res.status(400).json({ error: 'Missing signature' });
    return;
  }

  const parsed = signatureService.parseSignatureHeader(signatureHeader);
  if (!parsed) {
    res.status(400).json({ error: 'Invalid signature format' });
    return;
  }

  const secret = getSecret('order.paid');
  const isValid = signatureService.verifySignature(
    payload,
    parsed.signature,
    secret,
    parsed.timestamp
  );

  if (!isValid) {
    res.status(401).json({ error: 'Invalid signature for order.paid event' });
    return;
  }

  if (idempotencyKey) {
    const existing = processedIdempotencyKeys.get(idempotencyKey);
    if (existing) {
      res.status(200).json({
        status: 'duplicate',
        orderId: payload.orderId,
        message: 'Order already processed (idempotency)',
      });
      return;
    }
    processedIdempotencyKeys.set(idempotencyKey, {
      count: 1,
      firstSeen: Date.now(),
    });
  }

  const orderId = payload.orderId || 'unknown';
  const amount = payload.amount || 0;

  res.status(201).json({
    status: 'success',
    message: `Order ${orderId} paid successfully`,
    orderId,
    amount,
    processedAt: new Date().toISOString(),
  });
});

router.post('/webhook/stock-locked', (req: WebhookRequest, res: Response) => {
  const signatureHeader = req.headers['x-webhook-signature'] as string;
  const idempotencyKey = req.headers['x-idempotency-key'] as string;
  const payload = req.body;

  if (!signatureHeader) {
    res.status(400).json({ error: 'Missing signature' });
    return;
  }

  const parsed = signatureService.parseSignatureHeader(signatureHeader);
  if (!parsed) {
    res.status(400).json({ error: 'Invalid signature format' });
    return;
  }

  const secret = getSecret('stock.locked');
  const isValid = signatureService.verifySignature(
    payload,
    parsed.signature,
    secret,
    parsed.timestamp
  );

  if (!isValid) {
    res.status(401).json({ error: 'Invalid signature for stock.locked event' });
    return;
  }

  if (idempotencyKey) {
    const existing = processedIdempotencyKeys.get(idempotencyKey);
    if (existing) {
      res.status(200).json({
        status: 'duplicate',
        sku: payload.sku,
        message: 'Stock lock already processed (idempotency)',
      });
      return;
    }
    processedIdempotencyKeys.set(idempotencyKey, {
      count: 1,
      firstSeen: Date.now(),
    });
  }

  res.status(200).json({
    status: 'success',
    message: `Stock ${payload.sku} locked successfully`,
    sku: payload.sku,
    quantity: payload.quantity,
  });
});

router.post('/webhook/repo-pushed', (req: WebhookRequest, res: Response) => {
  const signatureHeader = req.headers['x-webhook-signature'] as string;
  const idempotencyKey = req.headers['x-idempotency-key'] as string;
  const payload = req.body;

  if (!signatureHeader) {
    res.status(400).json({ error: 'Missing signature' });
    return;
  }

  const parsed = signatureService.parseSignatureHeader(signatureHeader);
  if (!parsed) {
    res.status(400).json({ error: 'Invalid signature format' });
    return;
  }

  const secret = getSecret('repo.pushed');
  const isValid = signatureService.verifySignature(
    payload,
    parsed.signature,
    secret,
    parsed.timestamp
  );

  if (!isValid) {
    res.status(401).json({ error: 'Invalid signature for repo.pushed event' });
    return;
  }

  if (idempotencyKey) {
    const existing = processedIdempotencyKeys.get(idempotencyKey);
    if (existing) {
      res.status(200).json({
        status: 'duplicate',
        repo: payload.repo,
        message: 'Push already processed (idempotency)',
      });
      return;
    }
    processedIdempotencyKeys.set(idempotencyKey, {
      count: 1,
      firstSeen: Date.now(),
    });
  }

  res.status(200).json({
    status: 'success',
    message: `Push to ${payload.repo} processed`,
    repo: payload.repo,
    branch: payload.branch,
    commits: payload.commits?.length || 0,
  });
});

export const receiverRouter = router;
