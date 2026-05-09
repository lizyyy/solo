export interface Config {
  port: number;
  mongodb: {
    uri: string;
    database: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  kafka: {
    brokers: string[];
    clientId: string;
    groupId: string;
    topic: string;
    partitions: number;
  };
  cache: {
    ttl: number;
    namespace: string;
  };
  lock: {
    ttl: number;
    timeout: number;
  };
  idempotency: {
    ttl: number;
  };
  retry: {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
  };
  logging: {
    level: string;
  };
}

const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    database: process.env.MONGODB_DATABASE || 'live_push',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'live-push-service',
    groupId: process.env.KAFKA_GROUP_ID || 'live-push-consumer-group',
    topic: process.env.KAFKA_TOPIC || 'live-push-messages',
    partitions: parseInt(process.env.KAFKA_PARTITIONS || '16', 10),
  },
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '300', 10),
    namespace: process.env.CACHE_NAMESPACE || 'live_push',
  },
  lock: {
    ttl: parseInt(process.env.LOCK_TTL || '10000', 10),
    timeout: parseInt(process.env.LOCK_TIMEOUT || '5000', 10),
  },
  idempotency: {
    ttl: parseInt(process.env.IDEMPOTENCY_TTL || '86400', 10),
  },
  retry: {
    maxRetries: parseInt(process.env.RETRY_MAX_RETRIES || '5', 10),
    initialDelay: parseInt(process.env.RETRY_INITIAL_DELAY || '1000', 10),
    maxDelay: parseInt(process.env.RETRY_MAX_DELAY || '30000', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export default config;
