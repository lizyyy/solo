const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

const vaccineRoutes = require('./routes/vaccine');
const freezerRoutes = require('./routes/freezer');
const inventoryRoutes = require('./routes/inventory');
const appointmentRoutes = require('./routes/appointment');
const damageRoutes = require('./routes/damage');
const exportRoutes = require('./routes/export');
const historyRoutes = require('./routes/history');

app.use('/api/vaccine', vaccineRoutes);
app.use('/api/freezer', freezerRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/appointment', appointmentRoutes);
app.use('/api/damage', damageRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/history', historyRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`疫苗冷柜盘点系统运行在 http://localhost:${PORT}`);
});
