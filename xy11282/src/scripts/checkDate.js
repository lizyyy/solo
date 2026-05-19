const moment = require('moment');

console.log('今天日期:', moment().format('YYYY-MM-DD'));
console.log('今天ISO:', moment().toISOString());

const expiryDate = moment('2026-01-15');
console.log('过期日期:', expiryDate.format('YYYY-MM-DD'));
console.log('是否在今天之前:', expiryDate.isBefore(moment()));

console.log('\n库存3的过期日期: 2024-01-01');
console.log('是否过期:', moment('2024-01-01').isBefore(moment()));
