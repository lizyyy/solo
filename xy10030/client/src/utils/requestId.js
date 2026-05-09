export function generateRequestId() {
  return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

const PENDING_KEY = 'pending_requests';

export function savePendingRequest(key, data) {
  const pending = getPendingRequests();
  pending[key] = {
    ...data,
    timestamp: Date.now()
  };
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

export function getPendingRequest(key) {
  const pending = getPendingRequests();
  return pending[key] || null;
}

export function removePendingRequest(key) {
  const pending = getPendingRequests();
  delete pending[key];
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

export function getPendingRequests() {
  try {
    const data = localStorage.getItem(PENDING_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function clearExpiredPendingRequests(ttl = 24 * 60 * 60 * 1000) {
  const pending = getPendingRequests();
  const now = Date.now();
  let cleared = false;
  
  for (const key in pending) {
    if (now - pending[key].timestamp > ttl) {
      delete pending[key];
      cleared = true;
    }
  }
  
  if (cleared) {
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  }
}
