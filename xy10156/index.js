/**
 * 测试覆盖证据映射 CLI 工具
 * 主入口文件
 */

const DataStore = require('./src/dataStore');

module.exports = {
  DataStore,
  commands: {
    importRequirements: require('./src/commands/importRequirements'),
    mapTestCases: require('./src/commands/mapTestCases'),
    indexCode: require('./src/commands/indexCode'),
    analyzeGaps: require('./src/commands/analyzeGaps'),
    generateReport: require('./src/commands/generateReport'),
    listFailures: require('./src/commands/listFailures')
  }
};
