class InMemoryStore {
  constructor() {
    this.customers = new Map();
    this.usageMetrics = new Map();
    this.healthScores = new Map();
    this.tickets = new Map();
    this.quotes = new Map();
    this.renewalWorkflows = new Map();
    this.histories = new Map();
    this.processedRequests = new Set();
  }

  saveCustomer(customer) {
    this.customers.set(customer.id, customer);
    return customer;
  }

  getCustomer(id) {
    return this.customers.get(id);
  }

  getCustomers() {
    return Array.from(this.customers.values());
  }

  saveUsageMetric(metric) {
    this.usageMetrics.set(metric.id, metric);
    return metric;
  }

  getUsageMetricsByCustomer(customerId) {
    return Array.from(this.usageMetrics.values()).filter(m => m.customerId === customerId);
  }

  saveHealthScore(score) {
    this.healthScores.set(score.id, score);
    return score;
  }

  getLatestHealthScore(customerId) {
    const scores = Array.from(this.healthScores.values())
      .filter(s => s.customerId === customerId)
      .sort((a, b) => new Date(b.evaluatedAt) - new Date(a.evaluatedAt));
    return scores[0] || null;
  }

  saveTicket(ticket) {
    this.tickets.set(ticket.id, ticket);
    return ticket;
  }

  getOpenTickets(customerId) {
    return Array.from(this.tickets.values())
      .filter(t => t.customerId === customerId && t.status !== 'closed');
  }

  getTickets(customerId) {
    return Array.from(this.tickets.values()).filter(t => t.customerId === customerId);
  }

  saveQuote(quote) {
    this.quotes.set(quote.id, quote);
    return quote;
  }

  getQuotes(customerId) {
    return Array.from(this.quotes.values())
      .filter(q => q.customerId === customerId)
      .sort((a, b) => b.version - a.version);
  }

  getLatestQuote(customerId) {
    const quotes = this.getQuotes(customerId);
    return quotes[0] || null;
  }

  saveRenewalWorkflow(workflow) {
    this.renewalWorkflows.set(workflow.id, workflow);
    return workflow;
  }

  getRenewalWorkflow(id) {
    return this.renewalWorkflows.get(id);
  }

  getRenewalWorkflows() {
    return Array.from(this.renewalWorkflows.values());
  }

  getRenewalWorkflowsByCustomer(customerId) {
    return Array.from(this.renewalWorkflows.values()).filter(w => w.customerId === customerId);
  }

  addHistory(history) {
    const key = `${history.entityType}-${history.entityId}`;
    if (!this.histories.has(key)) {
      this.histories.set(key, []);
    }
    this.histories.get(key).push(history);
    return history;
  }

  getHistory(entityType, entityId) {
    const key = `${entityType}-${entityId}`;
    const histories = this.histories.get(key) || [];
    return [...histories].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  isRequestProcessed(requestId) {
    return this.processedRequests.has(requestId);
  }

  markRequestProcessed(requestId) {
    this.processedRequests.add(requestId);
  }
}

module.exports = new InMemoryStore();
