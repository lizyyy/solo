class DataMasking {
  static maskPhone(phone) {
    if (!phone || phone.length < 7) return phone;
    return phone.substring(0, 3) + '****' + phone.substring(phone.length - 4);
  }

  static maskName(name) {
    if (!name || name.length <= 1) return name;
    if (name.length === 2) {
      return name[0] + '*';
    }
    return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
  }

  static maskIdCard(idCard) {
    if (!idCard || idCard.length < 8) return idCard;
    return idCard.substring(0, 6) + '********' + idCard.substring(idCard.length - 4);
  }

  static maskEmail(email) {
    if (!email || !email.includes('@')) return email;
    const [username, domain] = email.split('@');
    if (username.length <= 2) return '*'.repeat(username.length) + '@' + domain;
    return username[0] + '*'.repeat(username.length - 2) + username[username.length - 1] + '@' + domain;
  }

  static maskAddress(address) {
    if (!address) return address;
    if (address.length < 10) return '*'.repeat(address.length);
    return address.substring(0, 5) + '****' + address.substring(address.length - 3);
  }

  static maskDeliveryItem(item) {
    if (!item) return item;
    const masked = { ...item };
    if (masked.receiver_name) {
      masked.receiver_name = this.maskName(masked.receiver_name);
    }
    if (masked.receiver_phone) {
      masked.receiver_phone = this.maskPhone(masked.receiver_phone);
    }
    return masked;
  }

  static maskDeliveryItemList(items) {
    if (!items || !Array.isArray(items)) return items;
    return items.map(item => this.maskDeliveryItem(item));
  }

  static maskOperationLog(log) {
    if (!log) return log;
    const masked = { ...log };
    if (masked.request_body) {
      try {
        const body = JSON.parse(masked.request_body);
        if (body.receiver_name) {
          body.receiver_name = this.maskName(body.receiver_name);
        }
        if (body.receiver_phone) {
          body.receiver_phone = this.maskPhone(body.receiver_phone);
        }
        if (body.items && Array.isArray(body.items)) {
          body.items = this.maskDeliveryItemList(body.items);
        }
        masked.request_body = JSON.stringify(body);
      } catch (e) {
      }
    }
    return masked;
  }

  static maskForExport(data, fields = []) {
    if (!data) return data;
    if (Array.isArray(data)) {
      return data.map(item => this.maskForExport(item, fields));
    }
    const masked = { ...data };
    fields.forEach(field => {
      if (masked[field]) {
        if (field.includes('phone') || field.includes('mobile')) {
          masked[field] = this.maskPhone(masked[field]);
        } else if (field.includes('name') && field.includes('receiver')) {
          masked[field] = this.maskName(masked[field]);
        } else if (field.includes('id_card')) {
          masked[field] = this.maskIdCard(masked[field]);
        } else if (field.includes('email')) {
          masked[field] = this.maskEmail(masked[field]);
        } else if (field.includes('address')) {
          masked[field] = this.maskAddress(masked[field]);
        }
      }
    });
    return masked;
  }

  static getSensitiveFields() {
    return ['receiver_name', 'receiver_phone', 'receiver_id_card', 'receiver_email', 'receiver_address'];
  }
}

module.exports = DataMasking;
