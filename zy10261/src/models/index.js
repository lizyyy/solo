const sequelize = require('../config/database');
const Contract = require('./Contract');
const Installment = require('./Installment');
const Repayment = require('./Repayment');
const ForbearanceApplication = require('./ForbearanceApplication');
const Collection = require('./Collection');

Contract.hasMany(Installment, { foreignKey: 'contractId', as: 'installments' });
Installment.belongsTo(Contract, { foreignKey: 'contractId', as: 'contract' });

Contract.hasMany(Repayment, { foreignKey: 'contractId', as: 'repayments' });
Repayment.belongsTo(Contract, { foreignKey: 'contractId', as: 'contract' });
Repayment.belongsTo(Installment, { foreignKey: 'installmentId', as: 'installment' });

Contract.hasMany(ForbearanceApplication, { foreignKey: 'contractId', as: 'forbearanceApplications' });
ForbearanceApplication.belongsTo(Contract, { foreignKey: 'contractId', as: 'contract' });
ForbearanceApplication.belongsTo(Installment, { foreignKey: 'installmentId', as: 'installment' });

Contract.hasMany(Collection, { foreignKey: 'contractId', as: 'collections' });
Collection.belongsTo(Contract, { foreignKey: 'contractId', as: 'contract' });

module.exports = {
  sequelize,
  Contract,
  Installment,
  Repayment,
  ForbearanceApplication,
  Collection,
};
