var fs = require('fs');
var p = 'backend/routes/batches.js';
var c = '';
module.exports = {
  add: function(s) { c += s; },
  save: function() { fs.writeFileSync(p, c); console.log('Saved, chars:', c.length); }
};
