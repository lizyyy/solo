var fs = require('fs');
var b64 = fs.readFileSync(process.argv[2], 'utf8').replace(/\s/g, '');
var buf = Buffer.from(b64, 'base64');
fs.writeFileSync(process.argv[3], buf);
console.log('Decoded', buf.length, 'bytes to', process.argv[3]);
