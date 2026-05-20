const express = require('express');
const { handleEvent, getEventHistory } = require('../controllers/eventController');
const { getUsers, getUserDetail } = require('../controllers/userController');
const { getSyncStatus, triggerCompensation } = require('../controllers/syncController');

const eventRoutes = express.Router();
const userRoutes = express.Router();
const syncRoutes = express.Router();

eventRoutes.post('/', handleEvent);
eventRoutes.get('/:userId', getEventHistory);

userRoutes.get('/', getUsers);
userRoutes.get('/:userId', getUserDetail);

syncRoutes.get('/:userId', getSyncStatus);
syncRoutes.post('/compensate', triggerCompensation);

module.exports = { eventRoutes, userRoutes, syncRoutes };
