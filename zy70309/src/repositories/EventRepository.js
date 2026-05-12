const OrderEvent = require('../models/OrderEvent');

class EventRepository {
  async saveEvent(event) {
    return await OrderEvent.create(event);
  }

  async findEventById(eventId) {
    return await OrderEvent.findOne({ eventId });
  }

  async findEventsByOrderId(orderId, options = {}) {
    const query = { orderId };
    if (options.isCompensation !== undefined) {
      query.isCompensation = options.isCompensation;
    }
    if (options.isValid !== undefined) {
      query.isValid = options.isValid;
    }

    const cursor = OrderEvent.find(query)
      .sort({ eventVersion: 1, timestamp: 1 });
    
    if (options.limit) {
      cursor.limit(options.limit);
    }
    
    return await cursor;
  }

  async getLatestEventVersion(orderId) {
    const latestEvent = await OrderEvent.findOne({ orderId })
      .sort({ eventVersion: -1 })
      .limit(1);
    
    return latestEvent ? latestEvent.eventVersion : 0;
  }

  async getEventsUpToVersion(orderId, version) {
    return await OrderEvent.find({
      orderId,
      eventVersion: { $lte: version }
    }).sort({ eventVersion: 1, timestamp: 1 });
  }

  async getEventsUpToEventId(orderId, eventId) {
    const targetEvent = await this.findEventById(eventId);
    if (!targetEvent) {
      return [];
    }

    return await OrderEvent.find({
      orderId,
      eventVersion: { $lte: targetEvent.eventVersion }
    }).sort({ eventVersion: 1, timestamp: 1 });
  }

  async markEventAsProcessed(eventId) {
    return await OrderEvent.findOneAndUpdate(
      { eventId },
      { isProcessed: true },
      { new: true }
    );
  }

  async invalidateEvent(eventId, validationErrors) {
    return await OrderEvent.findOneAndUpdate(
      { eventId },
      {
        isValid: false,
        validationErrors: validationErrors
      },
      { new: true }
    );
  }

  async countEvents(orderId) {
    return await OrderEvent.countDocuments({ orderId });
  }

  async findCompensationsForEvent(eventId) {
    return await OrderEvent.find({
      compensatesEventId: eventId,
      isCompensation: true
    }).sort({ timestamp: 1 });
  }
}

module.exports = new EventRepository();
