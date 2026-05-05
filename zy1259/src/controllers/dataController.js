const store = require('../store');

class DataController {
  getProducers(req, res) {
    try {
      const producers = store.getAllProducers();
      res.json({
        success: true,
        count: producers.length,
        data: producers.map(p => p.toJSON())
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getProducer(req, res) {
    try {
      const { id } = req.params;
      const producer = store.getProducer(id);

      if (!producer) {
        return res.status(404).json({
          success: false,
          error: 'Producer not found'
        });
      }

      res.json({
        success: true,
        data: producer.toJSON()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getTopics(req, res) {
    try {
      const topics = store.getAllTopics();
      res.json({
        success: true,
        count: topics.length,
        data: topics.map(t => t.toJSON())
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getTopic(req, res) {
    try {
      const { id } = req.params;
      const topic = store.getTopic(id);

      if (!topic) {
        return res.status(404).json({
          success: false,
          error: 'Topic not found'
        });
      }

      res.json({
        success: true,
        data: topic.toJSON()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getMessages(req, res) {
    try {
      const { topic, orderKey } = req.query;
      let messages;

      if (topic) {
        messages = store.getMessagesByTopic(topic);
      } else if (orderKey) {
        messages = store.getMessagesByOrderKey(orderKey);
      } else {
        messages = store.getAllMessages();
      }

      res.json({
        success: true,
        count: messages.length,
        data: messages.map(m => m.toJSON())
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getMessage(req, res) {
    try {
      const { id } = req.params;
      const message = store.getMessage(id);

      if (!message) {
        return res.status(404).json({
          success: false,
          error: 'Message not found'
        });
      }

      res.json({
        success: true,
        data: message.toJSON()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getDeliveryEvents(req, res) {
    try {
      const { messageId, consumerGroup } = req.query;
      let events;

      if (messageId) {
        events = store.getDeliveryEventsByMessageId(messageId);
      } else if (consumerGroup) {
        events = store.getDeliveryEventsByConsumerGroup(consumerGroup);
      } else {
        events = store.getAllDeliveryEvents();
      }

      res.json({
        success: true,
        count: events.length,
        data: events.map(e => e.toJSON())
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getDeliveryEvent(req, res) {
    try {
      const { id } = req.params;
      const event = store.getDeliveryEvent(id);

      if (!event) {
        return res.status(404).json({
          success: false,
          error: 'Delivery event not found'
        });
      }

      res.json({
        success: true,
        data: event.toJSON()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  clearAllData(req, res) {
    try {
      store.clear();
      res.json({
        success: true,
        message: 'All data cleared successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getStats(req, res) {
    try {
      const stats = {
        producers: store.getAllProducers().length,
        topics: store.getAllTopics().length,
        messages: store.getAllMessages().length,
        deliveryEvents: store.getAllDeliveryEvents().length,
        replayTasks: store.getAllReplayTasks().length,
        analysisResults: store.getAllAnalysisResults().length,
        reports: store.getAllReports().length
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new DataController();
