class ErrorCollector {
  constructor() {
    this.errors = [];
  }

  add(error) {
    this.errors.push({
      ...error,
      timestamp: new Date().toISOString()
    });
  }

  getErrors() {
    return [...this.errors];
  }

  hasErrors() {
    return this.errors.length > 0;
  }

  clear() {
    this.errors = [];
  }
}

module.exports = {
  ErrorCollector
};
