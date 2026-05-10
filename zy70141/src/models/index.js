const ShortLink = require('./ShortLink');
const DeviceFingerprint = require('./DeviceFingerprint');
const AccessLog = require('./AccessLog');
const Blacklist = require('./Blacklist');
const Conversion = require('./Conversion');
const AttributionReport = require('./AttributionReport');
const Task = require('./Task');

function setupAssociations() {
  ShortLink.hasMany(AccessLog, { foreignKey: 'shortLinkId', as: 'accessLogs' });
  AccessLog.belongsTo(ShortLink, { foreignKey: 'shortLinkId', as: 'shortLink' });

  DeviceFingerprint.hasMany(AccessLog, { 
    foreignKey: 'deviceFingerprintId', 
    as: 'accessLogs' 
  });
  AccessLog.belongsTo(DeviceFingerprint, { 
    foreignKey: 'deviceFingerprintId', 
    as: 'deviceFingerprint' 
  });

  ShortLink.hasMany(Conversion, { foreignKey: 'shortLinkId', as: 'conversions' });
  Conversion.belongsTo(ShortLink, { foreignKey: 'shortLinkId', as: 'shortLink' });

  AccessLog.hasMany(Conversion, { foreignKey: 'accessLogId', as: 'conversions' });
  Conversion.belongsTo(AccessLog, { foreignKey: 'accessLogId', as: 'accessLog' });

  DeviceFingerprint.hasMany(Conversion, { 
    foreignKey: 'deviceFingerprintId', 
    as: 'conversions' 
  });
  Conversion.belongsTo(DeviceFingerprint, { 
    foreignKey: 'deviceFingerprintId', 
    as: 'deviceFingerprint' 
  });
}

module.exports = {
  ShortLink,
  DeviceFingerprint,
  AccessLog,
  Blacklist,
  Conversion,
  AttributionReport,
  Task,
  setupAssociations,
};
