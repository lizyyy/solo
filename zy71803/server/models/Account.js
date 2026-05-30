class Account {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.customerId = data.customerId;
    this.customerName = data.customerName;
    this.branch = data.branch;
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      customerId: this.customerId,
      customerName: this.customerName,
      branch: this.branch,
      createdAt: this.createdAt
    };
  }
}

module.exports = Account;
