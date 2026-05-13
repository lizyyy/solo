const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const flavorRecipesRoutes = require('./routes/flavorRecipes');
const ovenCapacitiesRoutes = require('./routes/ovenCapacities');
const ingredientStocksRoutes = require('./routes/ingredientStocks');
const ordersRoutes = require('./routes/orders');
const reportsRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/flavor-recipes', flavorRecipesRoutes);
app.use('/api/oven-capacities', ovenCapacitiesRoutes);
app.use('/api/ingredient-stocks', ingredientStocksRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/reports', reportsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '烘焙排产系统运行正常' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`API 文档: http://localhost:${PORT}/api/health`);
});
