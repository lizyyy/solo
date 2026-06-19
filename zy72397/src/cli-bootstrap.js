const dataStore = require('./store/data-store');
const path = require('path');

const DEFAULT_DATA_FILE = path.resolve(__dirname, '../data/runtime.json');

function parseArgs(argv) {
  const args = {};
  const raw = argv || process.argv.slice(2);
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (key.includes('=')) {
        const [k, v] = key.split('=');
        args[k] = v;
      } else if (i + 1 < raw.length && !raw[i + 1].startsWith('--')) {
        args[key] = raw[i + 1];
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function cliBootstrap(options = {}) {
  const args = parseArgs();
  const dataFile = args.data || args['data-file'] || options.defaultDataFile || DEFAULT_DATA_FILE;
  const reset = !!(args.reset || args['reset-data'] || options.forceReset);
  const noSave = !!(args['no-save'] || options.noSave);
  const autoSave = !noSave;

  dataStore.setDataFile(dataFile);

  let loadResult = null;
  if (!reset) {
    loadResult = dataStore.load();
  } else {
    dataStore.clear();
  }

  if (autoSave) {
    dataStore.enableAutoSave(true);
  }

  return {
    args,
    dataFile,
    reset,
    autoSave,
    loadResult,
    dataStore,
    getArg(name, def) {
      return args[name] !== undefined ? args[name] : def;
    }
  };
}

module.exports = { cliBootstrap, parseArgs, DEFAULT_DATA_FILE };
