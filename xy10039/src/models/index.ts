import { User } from './User';
import { Activity } from './Activity';
import { Registration } from './Registration';
import { StatusHistory } from './StatusHistory';
import { ImportBatch } from './ImportBatch';
import { AuditLog } from './AuditLog';

User.hasMany(Activity, {
  foreignKey: 'createdBy',
  as: 'activities'
});

Activity.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator'
});

Activity.hasMany(Registration, {
  foreignKey: 'activityId',
  as: 'registrations'
});

Registration.belongsTo(Activity, {
  foreignKey: 'activityId',
  as: 'activity'
});

User.hasMany(Registration, {
  foreignKey: 'createdBy',
  as: 'registrations'
});

Registration.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator'
});

Registration.hasMany(StatusHistory, {
  foreignKey: 'registrationId',
  as: 'statusHistory'
});

StatusHistory.belongsTo(Registration, {
  foreignKey: 'registrationId',
  as: 'registration'
});

StatusHistory.belongsTo(User, {
  foreignKey: 'changedBy',
  as: 'changedByUser'
});

User.hasMany(ImportBatch, {
  foreignKey: 'importedBy',
  as: 'importBatches'
});

ImportBatch.belongsTo(User, {
  foreignKey: 'importedBy',
  as: 'importer'
});

export { User, Activity, Registration, StatusHistory, ImportBatch, AuditLog };
