const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initDatabase } = require('./models/database');

const departmentRoutes = require('./routes/departmentRoutes');
const itemRoutes = require('./routes/itemRoutes');
const packageRoutes = require('./routes/packageRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const addRemoveRoutes = require('./routes/addRemoveRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const customerRoutes = require('./routes/customerRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/departments', departmentRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/add-remove', addRemoveRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/customers', customerRoutes);

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Medical Examination API is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/staff', (req, res) => {
  const db = require('./config/database');
  const sql = 'SELECT * FROM staff ORDER BY name';
  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const startServer = async () => {
  try {
    await initDatabase();
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`API Base URL: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
