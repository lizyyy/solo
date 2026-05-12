import sequelize from '../config/database';
import FaultTicket, { TicketStatus, FailureReason } from './FaultTicket';
import OperationHistory, { OperationType } from './OperationHistory';
import OrderInfo, { OrderStatus } from './OrderInfo';
import RemoteOperation, { OperationStatus, OperationCommand } from './RemoteOperation';
import MaintenanceRecord, { MaintenanceStatus } from './MaintenanceRecord';

FaultTicket.hasMany(OperationHistory, { foreignKey: 'ticketId', as: 'histories' });
FaultTicket.hasMany(RemoteOperation, { foreignKey: 'ticketId', as: 'remoteOperations' });
FaultTicket.hasMany(MaintenanceRecord, { foreignKey: 'ticketId', as: 'maintenanceRecords' });

OperationHistory.belongsTo(FaultTicket, { foreignKey: 'ticketId' });
RemoteOperation.belongsTo(FaultTicket, { foreignKey: 'ticketId' });
MaintenanceRecord.belongsTo(FaultTicket, { foreignKey: 'ticketId' });

const initDB = async () => {
  await sequelize.sync({ force: true });
};

export {
  sequelize,
  initDB,
  FaultTicket,
  TicketStatus,
  FailureReason,
  OperationHistory,
  OperationType,
  OrderInfo,
  OrderStatus,
  RemoteOperation,
  OperationStatus,
  OperationCommand,
  MaintenanceRecord,
  MaintenanceStatus,
};
