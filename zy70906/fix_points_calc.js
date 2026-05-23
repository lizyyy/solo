const fs = require('fs');

const path = '/Users/lzy/pro/solo/workspaces/zy70906/src/services/pointsCalculator.js';
const content = fs.readFileSync(path, 'utf8');

const fixedContent = content.replace(
  'for (const recon of recons) {\n      const receipt = store.getReceipt(recon.receiptId);',
  'for (const recon of recons) {\n      if (recon.status === \'approved\' || recon.status === \'rejected\') continue;\n      const receipt = store.getReceipt(recon.receiptId);'
);

fs.writeFileSync(path, fixedContent);
console.log('Fixed calculateAllReconciliations to skip approved/rejected records');
