const SynthPresetComparator = require('./lib/comparator');

module.exports = {
  SynthPresetComparator,
  createComparator: (dataPath) => new SynthPresetComparator(dataPath)
};
