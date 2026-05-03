const sequelize = require('../config/database');

const User = require('./User');
const Item = require('./Item');
const Reservation = require('./Reservation');
const Loan = require('./Loan');
const ReturnRecord = require('./ReturnRecord');
const Waitlist = require('./Waitlist');
const Deposit = require('./Deposit');
const Dispute = require('./Dispute');

const models = {
  User,
  Item,
  Reservation,
  Loan,
  ReturnRecord,
  Waitlist,
  Deposit,
  Dispute,
};

Object.keys(models).forEach((modelName) => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

models.sequelize = sequelize;
models.Sequelize = require('sequelize');

module.exports = models;
