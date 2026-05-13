const fs = require('fs');
const path = require('path');
const knex = require('knex');
const config = require('../config/database');

let instance = null;

function ensureDataDirectory() {
  const env = process.env.NODE_ENV || 'development';
  if (env === 'development') {
    const dataDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }
}

function getKnex() {
  if (!instance) {
    ensureDataDirectory();
    instance = knex(config);
  }
  return instance;
}

async function runMigrations() {
  const db = getKnex();
  const migrationPath = path.join(__dirname, 'migrations');
  
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
