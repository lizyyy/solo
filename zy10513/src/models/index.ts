import sequelize from '../database/connection';
import SamplingBatch from './SamplingBatch';
import SamplingRule from './SamplingRule';
import OriginalRecord from './OriginalRecord';
import Reviewer from './Reviewer';
import ReviewConclusion from './ReviewConclusion';
import ExceptionLog from './ExceptionLog';
import SamplingReport from './SamplingReport';

SamplingBatch.belongsTo(SamplingRule, { foreignKey: 'ruleId', as: 'rule' });
SamplingRule.hasMany(SamplingBatch, { foreignKey: 'ruleId' });

OriginalRecord.belongsTo(SamplingBatch, { foreignKey: 'batchId', as: 'batch' });
SamplingBatch.hasMany(OriginalRecord, { foreignKey: 'batchId' });

ReviewConclusion.belongsTo(SamplingBatch, { foreignKey: 'batchId', as: 'batch' });
ReviewConclusion.belongsTo(OriginalRecord, { foreignKey: 'originalRecordId', as: 'originalRecord' });
ReviewConclusion.belongsTo(Reviewer, { foreignKey: 'reviewerId', as: 'reviewer' });
SamplingBatch.hasMany(ReviewConclusion, { foreignKey: 'batchId' });
OriginalRecord.hasMany(ReviewConclusion, { foreignKey: 'originalRecordId' });
Reviewer.hasMany(ReviewConclusion, { foreignKey: 'reviewerId' });

ExceptionLog.belongsTo(SamplingBatch, { foreignKey: 'batchId', as: 'batch' });
ExceptionLog.belongsTo(OriginalRecord, { foreignKey: 'originalRecordId', as: 'originalRecord' });
SamplingBatch.hasMany(ExceptionLog, { foreignKey: 'batchId' });
OriginalRecord.hasMany(ExceptionLog, { foreignKey: 'originalRecordId' });

SamplingReport.belongsTo(SamplingBatch, { foreignKey: 'batchId', as: 'batch' });
SamplingBatch.hasMany(SamplingReport, { foreignKey: 'batchId' });

export {
  sequelize,
  SamplingBatch,
  SamplingRule,
  OriginalRecord,
  Reviewer,
  ReviewConclusion,
  ExceptionLog,
  SamplingReport,
};
