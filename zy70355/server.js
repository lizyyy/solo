const express = require('express');
const app = express();
const ticketRoutes = require('./routes/tickets');

app.use(express.json());

app.use('/api/tickets', ticketRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Ticket SLA API running on port ${PORT}`);
});
