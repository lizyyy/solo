const signature = require('./signature');
const config = require('./config');

const payload = process.argv[2] || '{"test":"data"}';
const timestamp = process.argv[3] || Math.floor(Date.now() / 1000);

console.log('Payload:', payload);
console.log('Timestamp:', timestamp);
console.log('Signature:', signature.generateHmac(payload, timestamp, config.SIGNATURE_SECRET));
