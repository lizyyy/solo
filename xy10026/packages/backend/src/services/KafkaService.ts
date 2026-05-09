import { Kafka, Producer, Consumer, EachMessagePayload, Partitioners } from 'kafkajs';
import config from '../config';
import logger from '../utils/logger';
import { LiveMessage, KafkaMessage as SharedKafkaMessage } from '@live-push/shared';
import { generateId } from '@live-push/shared';

interface MessageHandler {
  (message: SharedKafkaMessage): Promise<void>;
}

class KafkaService {
  private kafka: Kafka | null = null;
  private producer: Producer | null = null;
  private consumer: Consumer | null = null;
  private isProducerConnected = false;
  private isConsumerConnected = false;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();

  private getKafka(): Kafka {
    if (!this.kafka) {
      this.kafka = new Kafka({
        clientId: config.kafka.clientId,
        brokers: config.kafka.brokers,
        retry: {
          retries: 5,
          initialRetryTime: 300,
          maxRetryTime: 30000,
        },
      });
    }
    return this.kafka;
  }

  async connectProducer(): Promise<void> {
    if (this.isProducerConnected && this.producer) {
      return;
    }

    const kafka = this.getKafka();
    this.producer = kafka.producer({
      createPartitioner: Partitioners.DefaultPartitioner,
      transactionTimeout: 30000,
    });

    await this.producer.connect();
    this.isProducerConnected = true;
    logger.info('Kafka producer connected', { brokers: config.kafka.brokers });
  }

  async connectConsumer(groupId?: string): Promise<void> {
    if (this.isConsumerConnected && this.consumer) {
      return;
    }

    const kafka = this.getKafka();
    this.consumer = kafka.consumer({
      groupId: groupId || config.kafka.groupId,
      sessionTimeout: 30000,
      rebalanceTimeout: 60000,
      heartbeatInterval: 3000,
      maxPollInterval: 300000,
    });

    await this.consumer.connect();
    this.isConsumerConnected = true;
    logger.info('Kafka consumer connected', { brokers: config.kafka.brokers, groupId: groupId || config.kafka.groupId });
  }

  async sendMessage(
    roomId: string,
    message: LiveMessage,
    traceId: string
  ): Promise<void> {
    if (!this.producer || !this.isProducerConnected) {
      throw new Error('Kafka producer not connected');
    }

    const partitionKey = `${roomId}-${message.senderId}`;
    
    const kafkaMessage: SharedKafkaMessage = {
      key: generateId(),
      value: {
        traceId,
        message,
        timestamp: Date.now(),
        sequence: message.sequence,
      },
      headers: {
        'x-trace-id': traceId,
        'x-room-id': roomId,
        'x-message-id': message.id,
        'x-sequence': message.sequence.toString(),
      },
    };

    try {
      await this.producer.send({
        topic: config.kafka.topic,
        messages: [
          {
            key: partitionKey,
            value: JSON.stringify(kafkaMessage.value),
            headers: kafkaMessage.headers,
          },
        ],
      });

      logger.debug('Kafka message sent', { 
        topic: config.kafka.topic,
        messageId: message.id,
        traceId,
        sequence: message.sequence,
        partitionKey
      });
    } catch (error) {
      logger.error('Kafka message send failed', error as Error, {
        messageId: message.id,
        traceId,
      });
      throw error;
    }
  }

  async sendMessagesInBatch(
    roomId: string,
    messages: Array<{ message: LiveMessage; traceId: string }>
  ): Promise<void> {
    if (!this.producer || !this.isProducerConnected) {
      throw new Error('Kafka producer not connected');
    }

    const kafkaMessages = messages.map(({ message, traceId }) => {
      const partitionKey = `${roomId}-${message.senderId}`;
      return {
        key: partitionKey,
        value: JSON.stringify({
          traceId,
          message,
          timestamp: Date.now(),
          sequence: message.sequence,
        }),
        headers: {
          'x-trace-id': traceId,
          'x-room-id': roomId,
          'x-message-id': message.id,
          'x-sequence': message.sequence.toString(),
        },
      };
    });

    try {
      await this.producer.send({
        topic: config.kafka.topic,
        messages: kafkaMessages,
      });

      logger.debug('Kafka batch messages sent', {
        topic: config.kafka.topic,
        count: messages.length,
      });
    } catch (error) {
      logger.error('Kafka batch messages send failed', error as Error);
      throw error;
    }
  }

  async subscribe(topic: string, fromBeginning: boolean = false): Promise<void> {
    if (!this.consumer || !this.isConsumerConnected) {
      throw new Error('Kafka consumer not connected');
    }

    await this.consumer.subscribe({ topic, fromBeginning });
    logger.info('Kafka consumer subscribed', { topic });
  }

  async runConsumer(): Promise<void> {
    if (!this.consumer || !this.isConsumerConnected) {
      throw new Error('Kafka consumer not connected');
    }

    await this.consumer.run({
      autoCommit: false,
      eachMessage: async (payload: EachMessagePayload) => {
        const { topic, partition, message, heartbeat } = payload;
        
        if (!message.value) {
          return;
        }

        try {
          const value = JSON.parse(message.value.toString()) as SharedKafkaMessage['value'];
          const kafkaMessage: SharedKafkaMessage = {
            key: message.key?.toString() || '',
            value,
            headers: message.headers as Record<string, string> | undefined,
          };

          const handlers = this.messageHandlers.get(topic) || [];
          
          for (const handler of handlers) {
            await handler(kafkaMessage);
          }

          await this.consumer?.commitOffsets([
            {
              topic,
              partition,
              offset: (parseInt(message.offset, 10) + 1).toString(),
            },
          ]);

          await heartbeat();

          logger.debug('Kafka message processed', {
            topic,
            partition,
            offset: message.offset,
            traceId: value.traceId,
            sequence: value.sequence,
          });
        } catch (error) {
          logger.error('Kafka message processing failed', error as Error, {
            topic,
            partition,
            offset: message.offset,
          });
          throw error;
        }
      },
    });
  }

  addHandler(topic: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(topic)) {
      this.messageHandlers.set(topic, []);
    }
    this.messageHandlers.get(topic)!.push(handler);
  }

  async disconnectProducer(): Promise<void> {
    if (this.producer && this.isProducerConnected) {
      await this.producer.disconnect();
      this.isProducerConnected = false;
      logger.info('Kafka producer disconnected');
    }
  }

  async disconnectConsumer(): Promise<void> {
    if (this.consumer && this.isConsumerConnected) {
      await this.consumer.disconnect();
      this.isConsumerConnected = false;
      logger.info('Kafka consumer disconnected');
    }
  }

  async disconnectAll(): Promise<void> {
    await Promise.all([this.disconnectProducer(), this.disconnectConsumer()]);
  }
}

export default new KafkaService();
