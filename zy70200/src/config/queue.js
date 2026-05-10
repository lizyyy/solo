const { Queue, Worker } = require('bullmq');
require('dotenv').config();

const connection = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
};

const salaryEffectQueue = new Queue('salary-effect', { connection });
const statusUpdateQueue = new Queue('status-update', { connection });

module.exports = {
  connection,
  salaryEffectQueue,
  statusUpdateQueue
};
