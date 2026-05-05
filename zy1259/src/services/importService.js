const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const store = require('../store');

class ImportService {
  constructor() {
    this.supportedFormats = {
      yaml: ['yaml', 'yml'],
      jsonl: ['jsonl', 'ndjson']
    };
  }

  async importProducers(filePath) {
    const ext = path.extname(filePath).toLowerCase().slice(1);
    if (!this.supportedFormats.yaml.includes(ext)) {
      throw new Error(`Unsupported format for producers: ${ext}. Expected yaml or yml.`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const data = yaml.load(content);

    if (!data || !Array.isArray(data.producers)) {
      throw new Error('Invalid producers.yaml format. Expected "producers" array.');
    }

    const imported = [];
    for (const producerData of data.producers) {
      const producer = store.addProducer(producerData);
      imported.push(producer);
    }

    return {
      count: imported.length,
      items: imported.map(p => p.toJSON())
    };
  }

  async importTopics(filePath) {
    const ext = path.extname(filePath).toLowerCase().slice(1);
    if (!this.supportedFormats.yaml.includes(ext)) {
      throw new Error(`Unsupported format for topics: ${ext}. Expected yaml or yml.`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const data = yaml.load(content);

    if (!data || !Array.isArray(data.topics)) {
      throw new Error('Invalid topics.yaml format. Expected "topics" array.');
    }

    const imported = [];
    for (const topicData of data.topics) {
      const topic = store.addTopic(topicData);
      imported.push(topic);
    }

    return {
      count: imported.length,
      items: imported.map(t => t.toJSON())
    };
  }

  async importMessages(filePath) {
    const ext = path.extname(filePath).toLowerCase().slice(1);
    if (!this.supportedFormats.jsonl.includes(ext)) {
      throw new Error(`Unsupported format for messages: ${ext}. Expected jsonl or ndjson.`);
    }

    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    const imported = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const messageData = JSON.parse(trimmed);
        const message = store.addMessage(messageData);
        imported.push(message);
      } catch (error) {
        console.warn(`Failed to parse message line: ${line.substring(0, 50)}...`, error.message);
      }
    }

    return {
      count: imported.length,
      items: imported.map(m => m.toJSON())
    };
  }

  async importDeliveryEvents(filePath) {
    const ext = path.extname(filePath).toLowerCase().slice(1);
    if (!this.supportedFormats.jsonl.includes(ext)) {
      throw new Error(`Unsupported format for delivery events: ${ext}. Expected jsonl or ndjson.`);
    }

    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    const imported = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const eventData = JSON.parse(trimmed);
        const event = store.addDeliveryEvent(eventData);
        imported.push(event);
      } catch (error) {
        console.warn(`Failed to parse delivery event line: ${line.substring(0, 50)}...`, error.message);
      }
    }

    return {
      count: imported.length,
      items: imported.map(e => e.toJSON())
    };
  }

  async importAll(producersPath, topicsPath, messagesPath, deliveryEventsPath) {
    const results = {
      producers: null,
      topics: null,
      messages: null,
      deliveryEvents: null,
      errors: []
    };

    try {
      if (producersPath && fs.existsSync(producersPath)) {
        results.producers = await this.importProducers(producersPath);
      }
    } catch (error) {
      results.errors.push({ type: 'producers', message: error.message });
    }

    try {
      if (topicsPath && fs.existsSync(topicsPath)) {
        results.topics = await this.importTopics(topicsPath);
      }
    } catch (error) {
      results.errors.push({ type: 'topics', message: error.message });
    }

    try {
      if (messagesPath && fs.existsSync(messagesPath)) {
        results.messages = await this.importMessages(messagesPath);
      }
    } catch (error) {
      results.errors.push({ type: 'messages', message: error.message });
    }

    try {
      if (deliveryEventsPath && fs.existsSync(deliveryEventsPath)) {
        results.deliveryEvents = await this.importDeliveryEvents(deliveryEventsPath);
      }
    } catch (error) {
      results.errors.push({ type: 'deliveryEvents', message: error.message });
    }

    return results;
  }

  async importFromDirectory(dirPath) {
    const producersPath = path.join(dirPath, 'producers.yaml');
    const topicsPath = path.join(dirPath, 'topics.yaml');
    const messagesPath = path.join(dirPath, 'messages.jsonl');
    const deliveryEventsPath = path.join(dirPath, 'delivery-events.jsonl');

    return this.importAll(producersPath, topicsPath, messagesPath, deliveryEventsPath);
  }
}

module.exports = new ImportService();
