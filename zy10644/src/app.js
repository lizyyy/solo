const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');

const preparedMealRoutes = require('./routes/preparedMealRoutes');
const storeRoutes = require('./routes/storeRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const offShelvesHistoryRoutes = require('./routes/offShelvesHistoryRoutes');

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.use('/api/prepared-meals', preparedMealRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/inventories', inventoryRoutes);
app.use('/api/off-shelves-history', offShelvesHistoryRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
