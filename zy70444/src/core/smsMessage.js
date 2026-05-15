const SignatureVerifier = require('./signature');

class SmsMessage {
  constructor(options) {
    this.phone = options.phone;
    this.content = options.content;
    this.templateId = options.templateId || 'TPL001';
    this.signMethod = options.signMethod || 'MD5';
    this.sign = options.sign || '';
    this.timestamp = options.timestamp || Date.now();
    this.messageId = options.messageId || `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  toJSON() {
    return {
      messageId: this.messageId,
      phone: this.phone,
      content: this.content,
      templateId: this.templateId,
      signMethod: this.signMethod,
      sign: this.sign,
      timestamp: this.timestamp
    };
  }

  static generate(phone, content, algorithm = 'MD5', key = '') {
    const verifier = new SignatureVerifier();
    const message = new SmsMessage({
      phone,
      content,
      signMethod: algorithm
    });
    
    const { sign, signMethod, ...data } = message.toJSON();
    message.sign = verifier.generateSignature(data, algorithm, key);
    
    return message;
  }

  static generateBatch(count, algorithm = 'MD5', key = '') {
    const messages = [];
    const contents = [
      '【物流通知】您的快递已出库，运单号：SF1234567890',
      '【物流通知】您的包裹正在派送中，预计今日送达',
      '【物流通知】快递已到达，请凭取件码1234取件',
      '【物流通知】您的订单已发货，请注意查收',
      '【验证码】您的验证码是：8888，5分钟内有效'
    ];
    
    for (let i = 0; i < count; i++) {
      const phone = `138${String(10000000 + i).slice(-8)}`;
      const content = contents[i % contents.length];
      messages.push(this.generate(phone, content, algorithm, key));
    }
    
    return messages;
  }

  static generateBadMessage(phone, content, wrongAlgorithm = 'SHA1', expectedAlgorithm = 'MD5', key = '') {
    const verifier = new SignatureVerifier();
    const message = new SmsMessage({
      phone,
      content,
      signMethod: wrongAlgorithm
    });
    
    const { sign, signMethod, ...data } = message.toJSON();
    message.sign = verifier.generateSignature(data, wrongAlgorithm, key);
    
    return message;
  }

  static generateDemoData() {
    const normalMessages = this.generateBatch(5, 'MD5');
    const badMessage = this.generateBadMessage(
      '13900009999',
      '【物流拦截】异常包裹需拦截，请核实',
      'SHA256',
      'MD5'
    );
    
    return {
      normal: normalMessages.map(m => m.toJSON()),
      abnormal: [badMessage.toJSON()],
      all: [...normalMessages.map(m => m.toJSON()), badMessage.toJSON()]
    };
  }
}

module.exports = SmsMessage;