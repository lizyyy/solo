const fs = require('fs');
const p = '/Users/lzy/pro/solo/workspaces/zy72488/src/pages/Workflow.tsx';
const content = 'TEST LINE';
fs.writeFileSync(p, content);
console.log('OK');
