const config = require('../config');

function validateISBN(isbn) {
  if (!isbn) {
    return { valid: false, message: 'ISBN不能为空', suggestion: '请输入有效的ISBN-10或ISBN-13编号' };
  }

  const cleaned = isbn.replace(/[-\s]/g, '').toUpperCase();

  if (cleaned.length === 10 || cleaned.length === 13) {
    return { valid: true, normalized: cleaned };
  }

  return { 
    valid: false, 
    message: `ISBN长度不正确，当前${cleaned.length}位，应为10或13位`,
    suggestion: '检查是否漏输或多输了数字，ISBN-10为10位，ISBN-13为13位'
  };
}

function validateISBN10(isbn) {
  if (!/^\d{9}[\dX]$/.test(isbn)) {
    return { valid: false, message: 'ISBN-10格式不正确', suggestion: '前9位应为数字，最后一位可为数字或X' };
  }

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(isbn[i]) * (10 - i);
  }
  const check = isbn[9] === 'X' ? 10 : parseInt(isbn[9]);
  sum += check;

  if (sum % 11 !== 0) {
    return { valid: false, message: 'ISBN-10校验位不正确', suggestion: '可能是输入错误，请核对原始条码' };
  }

  return { valid: true, normalized: isbn };
}

function validateISBN13(isbn) {
  if (!/^\d{13}$/.test(isbn)) {
    return { valid: false, message: 'ISBN-13格式不正确', suggestion: 'ISBN-13应为13位纯数字' };
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(isbn[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;

  if (parseInt(isbn[12]) !== check) {
    return { valid: false, message: 'ISBN-13校验位不正确', suggestion: '可能是输入错误，请核对原始条码' };
  }

  return { valid: true, normalized: isbn };
}

function validateGrade(grade) {
  if (!grade) {
    return { valid: false, message: '年级标签不能为空', suggestion: `请从以下选择：${config.validGrades.join('、')}` };
  }

  const normalized = grade.trim();
  if (!config.validGrades.includes(normalized)) {
    return { 
      valid: false, 
      message: `年级标签"${normalized}"不在有效列表中`,
      suggestion: `有效年级为：${config.validGrades.join('、')}，请选择最接近的分类`
    };
  }

  return { valid: true, normalized };
}

function validateCondition(condition) {
  if (!condition) {
    return { valid: false, message: '品相不能为空', suggestion: `请从以下选择：${config.validConditions.join('、')}` };
  }

  const normalized = condition.trim();
  if (!config.validConditions.includes(normalized)) {
    return { 
      valid: false, 
      message: `品相"${normalized}"不在有效列表中`,
      suggestion: `有效品相为：${config.validConditions.join('、')}`
    };
  }

  return { valid: true, normalized };
}

function validateBookRecord(record, rowNum) {
  const errors = [];
  const normalized = { ...record };

  const isbnResult = validateISBN(record.isbn);
  if (!isbnResult.valid) {
    errors.push({ field: 'isbn', ...isbnResult });
  } else {
    normalized.isbn = isbnResult.normalized;
  }

  const gradeResult = validateGrade(record.grade);
  if (!gradeResult.valid) {
    errors.push({ field: 'grade', ...gradeResult });
  } else {
    normalized.grade = gradeResult.normalized;
  }

  const conditionResult = validateCondition(record.condition);
  if (!conditionResult.valid) {
    errors.push({ field: 'condition', ...conditionResult });
  } else {
    normalized.condition = conditionResult.normalized;
  }

  if (!record.title || !record.title.trim()) {
    errors.push({ 
      field: 'title', 
      message: '书名不能为空', 
      suggestion: '请填写书籍名称' 
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized,
    rowNum
  };
}

module.exports = {
  validateISBN,
  validateGrade,
  validateCondition,
  validateBookRecord
};
