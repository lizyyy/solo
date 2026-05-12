const store = require('./store');

const db = {
  prepare: function() {
    return {
      run: function() { return { changes: 0 }; },
      get: function() { return undefined; },
      all: function() { return []; }
    };
  },
  pragma: function() { return []; },
  exec: function() { return []; },
  close: function() {}
};

module.exports = db;
module.exports.store = store;
