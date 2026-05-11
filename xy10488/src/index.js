const express = require('express');
const sequelize = require('./config/database');

require('./models/House');
require('./models/Room');
require('./models/Tenant');
require('./models/MeterReading');
require('./models/Bill');

const housesRouter = require('./routes/houses');
const roomsRouter = require('./routes/rooms');
const tenantsRouter = require('./routes/tenants');
const meterReadingsRouter = require('./routes/meterReadings');
const billsRouter = require('./routes/bills');

const app = express();
app.use(express.json());

app.use('/api/houses', housesRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/tenants', tenantsRouter);
app.use('/api/meter-readings', meterReadingsRouter);
app.use('/api/bills', billsRouter);

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await sequelize.sync({ alter: true });
    console.log('数据库已连接');
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('启动失败:', err);
  }
}

start();
