const fs = require('fs');
let c = fs.readFileSync('src/inspectionEngine.js', 'utf8');
c = c.replace('const allPhoneIssues = [];', 'let allPhoneIssues = [];');
console.log('0 ok');
fs.writeFileSync('src/inspectionEngine.js', c, 'utf8');
