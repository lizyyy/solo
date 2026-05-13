const { v4: uuidv4 } = require('uuid');

class Customer {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.customerNo = data.customerNo;
    this.name = data.name;
    this.contact = data.contact || '';
    this.phone = data.phone || '';
    this.address = data.address || '';
    this.createdAt = data.createdAt || new Date().toISOString();
  }
}

module.exports = Customer;
