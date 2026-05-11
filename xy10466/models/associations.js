const Order = require('./Order');
const OrderItem = require('./OrderItem');
const Delivery = require('./Delivery');
const Complaint = require('./Complaint');
const Compensation = require('./Compensation');
const FollowUp = require('./FollowUp');

Order.hasMany(OrderItem, { foreignKey: 'orderId', onDelete: 'CASCADE' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });

Order.hasOne(Delivery, { foreignKey: 'orderId', onDelete: 'CASCADE' });
Delivery.belongsTo(Order, { foreignKey: 'orderId' });

Order.hasMany(Complaint, { foreignKey: 'orderId', onDelete: 'CASCADE' });
Complaint.belongsTo(Order, { foreignKey: 'orderId' });

Complaint.hasMany(Compensation, { foreignKey: 'complaintId', onDelete: 'CASCADE' });
Compensation.belongsTo(Complaint, { foreignKey: 'complaintId' });

Complaint.hasMany(FollowUp, { foreignKey: 'complaintId', onDelete: 'CASCADE' });
FollowUp.belongsTo(Complaint, { foreignKey: 'complaintId' });

Complaint.hasMany(Complaint, { as: 'Duplicates', foreignKey: 'originalComplaintId' });
Complaint.belongsTo(Complaint, { as: 'Original', foreignKey: 'originalComplaintId' });

module.exports = {
  Order,
  OrderItem,
  Delivery,
  Complaint,
  Compensation,
  FollowUp
};
