const BaseModel = require('./BaseModel');

class Customer extends BaseModel {
  constructor() {
    super('customers');
  }

  findByPhone(phone) {
    return this.findOne('phone = ?', [phone]);
  }

  findByEmail(email) {
    return this.findOne('email = ?', [email]);
  }
}

module.exports = new Customer();
