const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

const { 
  flightData, 
  driverData, 
  tripData, 
  waitingFeeData, 
  reassignData, 
  reviewData,
  historyData
} = require('./data/sampleData');

const { validateDriverVehicle, calculateWaitingFee, saveReassign } = require('./services');

app.get('/api/flights', (req, res) => {
  const { flightNo, status } = req.query;
  let result = [...flightData];
  if (flightNo) {
    result = result.filter(f => f.flightNo.includes(flightNo));
  }
  if (status) {
    result = result.filter(f => f.status === status);
  }
  res.json({ success: true, data: result });
});

app.get('/api/drivers', (req, res) => {
  const { name, status } = req.query;
  let result = [...driverData];
  if (name) {
    result = result.filter(d => d.name.includes(name));
  }
  if (status) {
    result = result.filter(d => d.status === status);
  }
  res.json({ success: true, data: result });
});

app.get('/api/trips', (req, res) => {
  const { customerName, status, flightNo } = req.query;
  let result = [...tripData];
  if (customerName) {
    result = result.filter(t => t.customerName.includes(customerName));
  }
  if (status) {
    result = result.filter(t => t.status === status);
  }
  if (flightNo) {
    result = result.filter(t => t.flightNo.includes(flightNo));
  }
  res.json({ success: true, data: result });
});

app.get('/api/waiting-fees', (req, res) => {
  res.json({ success: true, data: waitingFeeData });
});

app.get('/api/reassigns', (req, res) => {
  res.json({ success: true, data: reassignData });
});

app.get('/api/reviews', (req, res) => {
  res.json({ success: true, data: reviewData });
});

app.get('/api/history', (req, res) => {
  const { handler, startTime, endTime } = req.query;
  let result = [...historyData];
  if (handler) {
    result = result.filter(h => h.handler.includes(handler));
  }
  if (startTime) {
    result = result.filter(h => new Date(h.handleTime) >= new Date(startTime));
  }
  if (endTime) {
    result = result.filter(h => new Date(h.handleTime) <= new Date(endTime));
  }
  res.json({ success: true, data: result });
});

app.get('/api/statistics', (req, res) => {
  const stats = {
    totalTrips: tripData.length,
    pendingTrips: tripData.filter(t => t.status === 'pending').length,
    completedTrips: tripData.filter(t => t.status === 'completed').length,
    reassignedTrips: reassignData.length,
    totalWaitingFees: waitingFeeData.reduce((sum, w) => sum + w.amount, 0),
    averageRating: reviewData.length > 0 
      ? (reviewData.reduce((sum, r) => sum + r.rating, 0) / reviewData.length).toFixed(1) 
      : 0
  };
  res.json({ success: true, data: stats });
});

app.post('/api/validate-driver-vehicle', (req, res) => {
  const { driverId, vehicleId, tripId } = req.body;
  const result = validateDriverVehicle(driverId, vehicleId, tripId);
  res.json(result);
});

app.post('/api/calculate-waiting-fee', (req, res) => {
  const { tripId, arriveTime, pickupTime, handler } = req.body;
  const result = calculateWaitingFee(tripId, arriveTime, pickupTime, handler);
  res.json(result);
});

app.post('/api/save-reassign', (req, res) => {
  const { tripId, oldDriverId, newDriverId, reason, handler } = req.body;
  const result = saveReassign(tripId, oldDriverId, newDriverId, reason, handler);
  res.json(result);
});

app.get('/api/export-report', (req, res) => {
  const { handler, startTime, endTime } = req.query;
  let result = [...historyData];
  if (handler) {
    result = result.filter(h => h.handler.includes(handler));
  }
  if (startTime) {
    result = result.filter(h => new Date(h.handleTime) >= new Date(startTime));
  }
  if (endTime) {
    result = result.filter(h => new Date(h.handleTime) <= new Date(endTime));
  }
  
  const report = {
    exportTime: moment().format('YYYY-MM-DD HH:mm:ss'),
    filter: { handler, startTime, endTime },
    data: result
  };
  
  res.json({ success: true, data: report });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
