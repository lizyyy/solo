const sequelize = require('../index');
const User = require('./User');
const Project = require('./Project');
const TagRule = require('./TagRule');
const SharedService = require('./SharedService');
const AllocationRatio = require('./AllocationRatio');
const BillImport = require('./BillImport');
const BillRecord = require('./BillRecord');
const SharedAllocation = require('./SharedAllocation');
const ManualAssignment = require('./ManualAssignment');
const BudgetAlert = require('./BudgetAlert');
const Anomaly = require('./Anomaly');

User.hasMany(Project, { foreignKey: 'ownerId', as: 'ownedProjects' });
Project.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

Project.hasMany(TagRule, { foreignKey: 'projectId', as: 'tagRules' });
TagRule.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

SharedService.hasMany(AllocationRatio, { foreignKey: 'sharedServiceId', as: 'ratios' });
AllocationRatio.belongsTo(SharedService, { foreignKey: 'sharedServiceId', as: 'sharedService' });

Project.hasMany(AllocationRatio, { foreignKey: 'projectId', as: 'allocationRatios' });
AllocationRatio.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

User.hasMany(BillImport, { foreignKey: 'importedBy', as: 'billImports' });
BillImport.belongsTo(User, { foreignKey: 'importedBy', as: 'importer' });

BillImport.hasMany(BillRecord, { foreignKey: 'billImportId', as: 'records' });
BillRecord.belongsTo(BillImport, { foreignKey: 'billImportId', as: 'billImport' });

Project.hasMany(BillRecord, { foreignKey: 'projectId', as: 'billRecords' });
BillRecord.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

SharedService.hasMany(BillRecord, { foreignKey: 'sharedServiceId', as: 'billRecords' });
BillRecord.belongsTo(SharedService, { foreignKey: 'sharedServiceId', as: 'sharedService' });

BillRecord.hasMany(SharedAllocation, { foreignKey: 'billRecordId', as: 'allocations' });
SharedAllocation.belongsTo(BillRecord, { foreignKey: 'billRecordId', as: 'billRecord' });

SharedAllocation.belongsTo(SharedService, { foreignKey: 'sharedServiceId', as: 'sharedService' });
SharedAllocation.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

BillRecord.hasMany(ManualAssignment, { foreignKey: 'billRecordId', as: 'manualAssignments' });
ManualAssignment.belongsTo(BillRecord, { foreignKey: 'billRecordId', as: 'billRecord' });

ManualAssignment.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
ManualAssignment.belongsTo(User, { foreignKey: 'assignedBy', as: 'assignedByUser' });

Project.hasMany(BudgetAlert, { foreignKey: 'projectId', as: 'alerts' });
BudgetAlert.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

BillImport.hasMany(Anomaly, { foreignKey: 'billImportId', as: 'anomalies' });
Anomaly.belongsTo(BillImport, { foreignKey: 'billImportId', as: 'billImport' });

BillRecord.hasMany(Anomaly, { foreignKey: 'billRecordId', as: 'anomalies' });
Anomaly.belongsTo(BillRecord, { foreignKey: 'billRecordId', as: 'billRecord' });

SharedService.hasMany(Anomaly, { foreignKey: 'sharedServiceId', as: 'anomalies' });
Anomaly.belongsTo(SharedService, { foreignKey: 'sharedServiceId', as: 'sharedService' });

module.exports = {
  sequelize,
  User,
  Project,
  TagRule,
  SharedService,
  AllocationRatio,
  BillImport,
  BillRecord,
  SharedAllocation,
  ManualAssignment,
  BudgetAlert,
  Anomaly,
};
