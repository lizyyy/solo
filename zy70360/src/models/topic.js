class Topic {
  constructor(options = {}) {
    this.name = options.name;
    this.description = options.description || '';
    this.consumerGroup = options.consumerGroup || 'default';
    this.maxRetry = options.maxRetry || 3;
    this.retryDelay = options.retryDelay || 5000;
    this.deadLetterTopic = options.deadLetterTopic || `DLQ-${options.name}`;
    this.partitions = options.partitions || 1;
  }

  toJSON() {
    return {
      name: this.name,
      description: this.description,
      consumerGroup: this.consumerGroup,
      maxRetry: this.maxRetry,
      retryDelay: this.retryDelay,
      deadLetterTopic: this.deadLetterTopic,
      partitions: this.partitions
    };
  }

  static fromJSON(json) {
    return new Topic(json);
  }
}

module.exports = Topic;
