import { Environment } from './Environment';
import { DatasetVersion } from './DatasetVersion';
import { SeedTask } from './SeedTask';
import { SeedRecord } from './SeedRecord';
import { CleanupStrategy } from './CleanupStrategy';
import { RollbackRecord } from './RollbackRecord';

Environment.hasMany(SeedTask, { foreignKey: 'environmentId' });
SeedTask.belongsTo(Environment, { foreignKey: 'environmentId' });

DatasetVersion.hasMany(SeedTask, { foreignKey: 'datasetVersionId' });
SeedTask.belongsTo(DatasetVersion, { foreignKey: 'datasetVersionId' });

SeedTask.hasMany(SeedRecord, { foreignKey: 'taskId' });
SeedRecord.belongsTo(SeedTask, { foreignKey: 'taskId' });

Environment.hasMany(CleanupStrategy, { foreignKey: 'environmentId' });
CleanupStrategy.belongsTo(Environment, { foreignKey: 'environmentId' });

SeedTask.hasMany(RollbackRecord, { foreignKey: 'taskId' });
RollbackRecord.belongsTo(SeedTask, { foreignKey: 'taskId' });

export {
  Environment,
  DatasetVersion,
  SeedTask,
  SeedRecord,
  CleanupStrategy,
  RollbackRecord,
};
