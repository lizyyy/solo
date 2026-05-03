const path = require('path');
const { sequelize } = require('../src/models');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(__dirname, '../data/test.db');

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await sequelize.transaction(async (t) => {
    await sequelize.query('DELETE FROM disputes', { transaction: t });
    await sequelize.query('DELETE FROM return_records', { transaction: t });
    await sequelize.query('DELETE FROM deposits', { transaction: t });
    await sequelize.query('DELETE FROM waitlists', { transaction: t });
    await sequelize.query('DELETE FROM loans', { transaction: t });
    await sequelize.query('DELETE FROM reservations', { transaction: t });
    await sequelize.query('DELETE FROM items', { transaction: t });
    await sequelize.query('DELETE FROM users', { transaction: t });
  });
});

module.exports = {
  sequelize,
};
