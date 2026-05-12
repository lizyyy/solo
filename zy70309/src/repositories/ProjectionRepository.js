const OrderProjection = require('../models/OrderProjection');

class ProjectionRepository {
  async save(projection) {
    return await OrderProjection.findOneAndUpdate(
      { orderId: projection.orderId },
      projection,
      { upsert: true, new: true }
    );
  }

  async findByOrderId(orderId) {
    return await OrderProjection.findOne({ orderId });
  }

  async deleteByOrderId(orderId) {
    return await OrderProjection.deleteOne({ orderId });
  }

  async markAsInconsistent(orderId, inconsistencyDetails) {
    return await OrderProjection.findOneAndUpdate(
      { orderId },
      {
        isConsistent: false,
        inconsistencyDetails: inconsistencyDetails
      },
      { new: true }
    );
  }

  async markAsConsistent(orderId) {
    return await OrderProjection.findOneAndUpdate(
      { orderId },
      {
        isConsistent: true,
        inconsistencyDetails: []
      },
      { new: true }
    );
  }

  async findInconsistentProjections() {
    return await OrderProjection.find({ isConsistent: false });
  }

  async updateVersion(orderId, newVersion, lastEventId, lastEventTimestamp) {
    return await OrderProjection.findOneAndUpdate(
      { orderId },
      {
        version: newVersion,
        lastEventId,
        lastEventTimestamp
      },
      { new: true }
    );
  }
}

module.exports = new ProjectionRepository();
