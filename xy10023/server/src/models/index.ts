import { sequelize } from '../database';
import { User } from './User';
import { Ticket } from './Ticket';
import { FollowUp } from './FollowUp';
import { Event } from './Event';
import { IdempotencyRecord } from './IdempotencyRecord';

Ticket.hasMany(FollowUp, {
  foreignKey: 'ticketId',
  as: 'followUps',
  onDelete: 'CASCADE',
});

FollowUp.belongsTo(Ticket, {
  foreignKey: 'ticketId',
  as: 'ticket',
});

User.hasMany(Ticket, {
  foreignKey: 'assigneeId',
  as: 'assignedTickets',
});

Ticket.belongsTo(User, {
  foreignKey: 'assigneeId',
  as: 'assignee',
});

User.hasMany(FollowUp, {
  foreignKey: 'createdBy',
  as: 'createdFollowUps',
});

FollowUp.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator',
});

FollowUp.belongsTo(User, {
  foreignKey: 'assigneeId',
  as: 'followUpAssignee',
});

export {
  sequelize,
  User,
  Ticket,
  FollowUp,
  Event,
  IdempotencyRecord,
};

export default {
  sequelize,
  User,
  Ticket,
  FollowUp,
  Event,
  IdempotencyRecord,
};
