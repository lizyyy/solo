const runner = require('./test-game-engine.js');

runner.run().then(success => {
  process.exit(success ? 0 : 1);
});
