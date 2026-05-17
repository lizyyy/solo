const SSHConfigParser = require('./parser');
const ProxyJumpResolver = require('./proxyResolver');
const ReportGenerator = require('./reportGenerator');

module.exports = {
  SSHConfigParser,
  ProxyJumpResolver,
  ReportGenerator,
  parseConfig: (filePath) => {
    const parser = new SSHConfigParser();
    return parser.parse(filePath);
  },
  analyzeHost: (configPath, hostname) => {
    const parser = new SSHConfigParser();
    parser.parse(configPath);
    const proxyResolver = new ProxyJumpResolver(parser);
    const reportGen = new ReportGenerator(parser, proxyResolver);
    return {
      terminalReport: reportGen.generateTerminalReport(hostname),
      json: reportGen.generateJSON(hostname),
      friendlyReport: reportGen.generateFriendlyReport(hostname)
    };
  }
};
