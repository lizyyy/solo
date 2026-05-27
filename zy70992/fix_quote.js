const fs = require('fs');
let content = fs.readFileSync('src/batchService.js', 'utf8');
content = content.replace("date(?, ''+1 month'')", "date(?, '\\'+1 month\\'')");
fs.writeFileSync('src/batchService.js', content);
console.log('Fixed');
