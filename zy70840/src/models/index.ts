import Batch from './Batch';
import Application from './Application';
import Certificate from './Certificate';
import VenueSchedule from './VenueSchedule';
import ProcessingLog from './ProcessingLog';
import DepositFlow from './DepositFlow';
import sequelize from '../database';

Batch.hasMany(Application, { foreignKey: 'batchId', as: 'applications' });
Application.belongsTo(Batch, { foreignKey: 'batchId', as: 'batch' });

Application.hasMany(Certificate, { foreignKey: 'applicationId', as: 'certificates' });
Certificate.belongsTo(Application, { foreignKey: 'applicationId', as: 'application' });

Application.hasMany(VenueSchedule, { foreignKey: 'applicationId', as: 'schedules' });
VenueSchedule.belongsTo(Application, { foreignKey: 'applicationId', as: 'application' });

Application.hasMany(ProcessingLog, { foreignKey: 'applicationId', as: 'logs' });
ProcessingLog.belongsTo(Application, { foreignKey: 'applicationId', as: 'application' });

Application.hasMany(DepositFlow, { foreignKey: 'applicationId', as: 'depositFlows' });
DepositFlow.belongsTo(Application, { foreignKey: 'applicationId', as: 'application' });

export { sequelize, Batch, Application, Certificate, VenueSchedule, ProcessingLog, DepositFlow };
