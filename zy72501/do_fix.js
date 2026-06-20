const fs = require('fs');
let c = fs.readFileSync('src/inspectionEngine.js', 'utf8');

// Fix 0: const -> let
c = c.replace('const allPhoneIssues = [];', 'let allPhoneIssues = [];');
console.log('test');
