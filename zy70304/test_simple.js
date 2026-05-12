const crypto = require('crypto');
const http = require('http');

const SECRET = 'your_secret_key_here_change_in_production';

function sign(payload, timestamp) {
  const message = `${timestamp}.${payload}`;
  return crypto.createHmac('sha256', SECRET).update(message).digest('hex');
}

const now = Math.floor(Date.now() / 1000);
const payload = JSON.stringify({ order_id: 'TEST-001', amount: 100 });
const sig = sign(payload, now);

console.log('Payload:', payload);
console.log('Timestamp:', now);
console.log('Signature:', sig);

const data = JSON.stringify({ order_id: 'TEST-001', amount: 100 });

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'X-Event-Id': 'test-simple-001',
    'X-Provider': 'test',
    'X-Event-Type': 'payment.succeeded',
    'X-Timestamp': String(now),
    'X-Signature': sig
  }
};

const req = http.request(options, (res) => {
  console.log('Status:', res.statusCode);
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => console.log('Response:', body));
});

req.on('error', (e) => console.error('Error:', e));
req.write(data);
req.end();
