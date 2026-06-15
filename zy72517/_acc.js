var fs = require('fs');
var css = '';
var html = '';
module.exports = {
  addCss: function(s) { css += s; },
  addHtml: function(s) { html += s; },
  save: function() {
    fs.writeFileSync('frontend/styles.css', css);
    console.log('CSS saved:', css.length, 'chars');
    fs.writeFileSync('frontend/index.html', html);
    console.log('HTML saved:', html.length, 'chars');
  }
};
