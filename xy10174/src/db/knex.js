const knex = require('knex');
const config = require('../config/database');

let instance = null;

function getKnex() {
  if (!instance) {
    instance = knex(config);
  }
  return instance;
}

async function runMigrations() {
  const db = getKnex();
  const migrationPath = require('path').join(__dirname, 'migrations');
  
  await db.migrate.latest({
    directory: migrationPath
  });
  
  return db;
}

async function closeConnection() {
  if (instance) {
    await instance.destroy();
    instance = null;
  }
}

module.exports = {
  getKnex,
  runMigrations,
  closeConnection
};
