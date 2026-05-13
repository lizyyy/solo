import sequelize from './database';
import Project from './Project';
import OwnerVote from './OwnerVote';
import BudgetQuote from './BudgetQuote';
import ConstructionNode from './ConstructionNode';
import InspectionPhoto from './InspectionPhoto';
import PublicObjection from './PublicObjection';
import ChangeHistory from './ChangeHistory';
import OperationLog from './OperationLog';

Project.hasMany(OwnerVote, { foreignKey: 'projectId', as: 'votes' });
OwnerVote.belongsTo(Project, { foreignKey: 'projectId' });

Project.hasMany(BudgetQuote, { foreignKey: 'projectId', as: 'quotes' });
BudgetQuote.belongsTo(Project, { foreignKey: 'projectId' });

Project.hasMany(ConstructionNode, { foreignKey: 'projectId', as: 'nodes' });
ConstructionNode.belongsTo(Project, { foreignKey: 'projectId' });

Project.hasMany(InspectionPhoto, { foreignKey: 'projectId', as: 'photos' });
InspectionPhoto.belongsTo(Project, { foreignKey: 'projectId' });
ConstructionNode.hasMany(InspectionPhoto, { foreignKey: 'nodeId', as: 'nodePhotos' });
InspectionPhoto.belongsTo(ConstructionNode, { foreignKey: 'nodeId' });

Project.hasMany(PublicObjection, { foreignKey: 'projectId', as: 'objections' });
PublicObjection.belongsTo(Project, { foreignKey: 'projectId' });

Project.hasMany(ChangeHistory, { foreignKey: 'projectId', as: 'changeHistories' });
ChangeHistory.belongsTo(Project, { foreignKey: 'projectId' });

Project.hasMany(OperationLog, { foreignKey: 'projectId', as: 'operationLogs' });
OperationLog.belongsTo(Project, { foreignKey: 'projectId' });

export {
  sequelize,
  Project,
  OwnerVote,
  BudgetQuote,
  ConstructionNode,
  InspectionPhoto,
  PublicObjection,
  ChangeHistory,
  OperationLog
};
