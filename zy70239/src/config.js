const path = require('path');

module.exports = {
  PORT: 3000,
  DATA_DIR: path.join(__dirname, '..', 'data'),
  ISOLATION_RULES: {
    categories: {
      EXPLOSIVES: { id: 1, name: '爆炸品', color: 'red' },
      GASES: { id: 2, name: '气体', color: 'orange' },
      FLAMMABLE_LIQUIDS: { id: 3, name: '易燃液体', color: 'yellow' },
      FLAMMABLE_SOLIDS: { id: 4, name: '易燃固体', color: 'brown' },
      OXIDIZING: { id: 5, name: '氧化性物质', color: 'blue' },
      TOXIC: { id: 6, name: '毒性物质', color: 'purple' },
      RADIOACTIVE: { id: 7, name: '放射性物质', color: 'yellow' },
      CORROSIVE: { id: 8, name: '腐蚀性物质', color: 'green' },
      MISCELLANEOUS: { id: 9, name: '杂项危险物质', color: 'gray' }
    },
    distances: {
      EXPLOSIVES: 50,
      GASES: 30,
      FLAMMABLE_LIQUIDS: 20,
      FLAMMABLE_SOLIDS: 15,
      OXIDIZING: 25,
      TOXIC: 35,
      RADIOACTIVE: 100,
      CORROSIVE: 25,
      MISCELLANEOUS: 10
    },
    incompatible: [
      ['EXPLOSIVES', 'OXIDIZING'],
      ['EXPLOSIVES', 'FLAMMABLE_LIQUIDS'],
      ['GASES', 'FLAMMABLE_SOLIDS'],
      ['OXIDIZING', 'FLAMMABLE_LIQUIDS'],
      ['TOXIC', 'CORROSIVE'],
      ['RADIOACTIVE', '*']
    ]
  }
};
