const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');

const shipmentsRoutes = require('./routes/shipments');
const temperatureRoutes = require('./routes/temperature');
const nodesRoutes = require('./routes/nodes');
const signoffRoutes = require('./routes/signoff');
const claimsRoutes = require('./routes/claims');
const cargoTypesRoutes = require('./routes/cargoTypes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/shipments', shipmentsRoutes);
app.use('/api/temperature', temperatureRoutes);
app.use('/api/nodes', nodesRoutes);
app.use('/api/signoff', signoffRoutes);
app.use('/api/claims', claimsRoutes);
app.use('/api/cargo-types', cargoTypesRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '冷链温控索赔台服务运行中' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message });
});

sequelize.sync({ force: false }).then(() => {
  console.log('数据库连接成功');
  app.listen(PORT, () => {
    console.log(`冷链温控索赔台后端服务运行在端口 ${PORT}`);
  });
}).catch(err => {
  console.error('数据库连接失败:', err);
});
