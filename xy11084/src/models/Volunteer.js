class Volunteer {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.idCard = data.idCard;
    this.phone = data.phone;
    this.community = data.community;
    this.gender = data.gender;
    this.age = data.age;
    this.registerDate = data.registerDate;
    this.status = data.status || 'active';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  validate() {
    const errors = [];
    if (!this.name) errors.push('志愿者姓名不能为空');
    if (!this.idCard) errors.push('身份证号不能为空');
    if (!this.phone) errors.push('联系电话不能为空');
    if (!this.community) errors.push('所属社区不能为空');
    return errors;
  }
}

module.exports = Volunteer;