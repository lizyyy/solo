console.log("Hello from debug script");

try {
  const store = require('./src/store');
  console.log("store loaded OK");
  console.log("generateId test:", store.generateId('test'));
} catch (e) {
  console.log("store ERROR:", e.message);
}

try {
  const models = require('./src/models');
  console.log("models loaded OK");
  console.log("models keys:", Object.keys(models));
} catch (e) {
  console.log("models ERROR:", e.message);
  console.log(e.stack);
}

try {
  const engine = require('./src/inspectionEngine');
  console.log("engine loaded OK");
  console.log("engine keys:", Object.keys(engine));
} catch (e) {
  console.log("engine ERROR:", e.message);
  console.log(e.stack);
}
