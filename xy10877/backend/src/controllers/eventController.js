const { v4: uuidv4 } = require('uuid');
const store = require('../store/memoryStore');

const handleEvent = (req, res) => {
  const { id, userId, type, data, description } = req.body;

  const eventId = id || uuidv4();

  if (store.isEventProcessed(eventId)) {
    return res.json({
      success: true,
      message: '事件已处理（幂等性保证）',
      eventId,
      idempotent: true
    });
  }

  const event = {
    id: eventId,
    userId,
    type,
    data,
    description,
    timestamp: new Date().toISOString()
  };

  store.markEventProcessed(eventId);
  store.addEvent(event);
  store.applyEventToUser(event);

  res.json({
    success: true,
    message: '事件处理成功',
    eventId,
    event
  });
};

const getEventHistory = (req, res) => {
  const { userId } = req.params;
  const events = store.getEventsByUserId(userId);
  
  res.json({
    success: true,
    data: events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  });
};

module.exports = { handleEvent, getEventHistory };
