const PHONE_REGEX = /1[3-9]\d{9}/g;
const MASKED_PHONE_REGEX = /1[3-9]\d\*{4}\d{4}/;

function isPhoneMasked(phone) {
  if (!phone) return true;
  return MASKED_PHONE_REGEX.test(phone);
}

function detectUnmaskedPhones(text) {
  if (!text) return [];
  const matches = text.match(PHONE_REGEX) || [];
  return matches.filter(phone => !isPhoneMasked(phone));
}

function checkRecordPrivacy(record) {
  const issues = [];
  
  const phoneField = record.phone || '';
  if (phoneField && !isPhoneMasked(phoneField)) {
    issues.push({
      type: 'unmasked_phone',
      field: 'phone',
      value: phoneField,
      severity: 'high',
      message: '手机号字段未脱敏',
      action: 'pending_algorithm_review'
    });
  }
  
  const answerUnmasked = detectUnmaskedPhones(record.model_answer || '');
  answerUnmasked.forEach(phone => {
    issues.push({
      type: 'unmasked_phone_in_answer',
      field: 'model_answer',
      value: phone,
      severity: 'high',
      message: '模型回答中包含未脱敏手机号',
      action: 'pending_algorithm_review'
    });
  });
  
  return issues;
}

function maskPhone(phone) {
  if (!phone) return phone;
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length !== 11) return phone;
  return cleanPhone.slice(0, 3) + '****' + cleanPhone.slice(7);
}

module.exports = {
  isPhoneMasked,
  detectUnmaskedPhones,
  checkRecordPrivacy,
  maskPhone
};
