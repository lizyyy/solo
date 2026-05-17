class Customer {
  constructor(id, name, contact, phone) {
    this.id = id;
    this.name = name;
    this.contact = contact;
    this.phone = phone;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}

module.exports = Customer;
