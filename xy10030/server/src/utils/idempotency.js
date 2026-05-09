import { v4 as uuidv4 } from 'uuid';

export function generateRequestId() {
  return uuidv4();
}

export function validateRequestId(req, res, next) {
  const requestId = req.headers['x-request-id'] || req.body?.requestId;
  
  if (!requestId) {
    req.requestId = generateRequestId();
    req.isNewRequest = true;
  } else {
    req.requestId = requestId;
    req.isNewRequest = false;
  }
  
  res.setHeader('X-Request-Id', req.requestId);
  next();
}
