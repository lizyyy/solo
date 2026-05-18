const crypto = require('crypto');

const NAME_SUFFIXES = ['同学', '同学', '同学', '同学', '同学', '同学', '同学', '同学', '同学', '同学'];
const COUNSELOR_NAMES = ['张老师', '李老师', '王老师', '赵老师', '刘老师', '陈老师', '杨老师', '黄老师'];
const LOCATIONS = ['咨询室A', '咨询室B', '咨询室C', '咨询室D', '团体咨询室', '线上咨询'];

function hashToIndex(input, max) {
  const hash = crypto.createHash('md5').update(String(input)).digest('hex');
  return parseInt(hash.substring(0, 8), 16) % max;
}

function desensitizeName(name, isCounselor = false) {
  if (!name || name.trim() === '') return '';
  if (isCounselor) {
    return COUNSELOR_NAMES[hashToIndex(name, COUNSELOR_NAMES.length)];
  }
  const suffix = NAME_SUFFIXES[hashToIndex(name, NAME_SUFFIXES.length)];
  const id = hashToIndex(name, 10000).toString().padStart(4, '0');
  return `来访${id}${suffix}`;
}

function desensitizePhone(phone) {
  if (!phone || phone.trim() === '') return '';
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 11) {
    return cleanPhone.substring(0, 3) + '****' + cleanPhone.substring(7);
  }
  return '***-****-' + cleanPhone.substring(cleanPhone.length - 4);
}

function desensitizeIdCard(idCard) {
  if (!idCard || idCard.trim() === '') return '';
  if (idCard.length >= 15) {
    return idCard.substring(0, 6) + '********' + idCard.substring(idCard.length - 4);
  }
  return '***-**-*-****';
}

function desensitizeEmail(email) {
  if (!email || email.trim() === '') return '';
  const [username, domain] = email.split('@');
  if (!username || !domain) return '***@***.com';
  const maskedUsername = username.length > 3 ? username.substring(0, 2) + '***' : '***';
  return `${maskedUsername}@${domain}`;
}

function desensitizeStudentId(studentId) {
  if (!studentId || studentId.trim() === '') return '';
  const prefix = 'STU';
  const id = hashToIndex(studentId, 100000).toString().padStart(5, '0');
  return `${prefix}${id}`;
}

function desensitizeFreeText(text) {
  if (!text || text.trim() === '') return '';
  const patterns = [
    { regex: /我[叫是名][\u4e00-\u9fa5]{2,4}/g, replace: '我是来访同学' },
    { regex: /我今年\d+岁/g, replace: '我今年XX岁' },
    { regex: /我?电话[是：:]?\s*[\d-]{7,}/g, replace: '我的电话是***********' },
    { regex: /1[3-9]\d{9}/g, replace: '***********' },
    { regex: /我住[在于]?[\u4e00-\u9fa5\d区街道路号]+/g, replace: '我住在学校宿舍' },
    { regex: /我是[\u4e00-\u9fa5]{2,10}专业/g, replace: '我是某专业学生' },
    { regex: /我的辅导员是[\u4e00-\u9fa5]{2,4}/g, replace: '我的辅导员是老师' },
    { regex: /我妈妈[\u4e00-\u9fa5]+/g, replace: '我家人' },
    { regex: /我爸爸[\u4e00-\u9fa5]+/g, replace: '我家人' },
    { regex: /联系电话[：:]?\s*[\d-]+/g, replace: '联系电话：***********' },
    { regex: /家长电话[：:]?\s*[\d-]+/g, replace: '家长电话：***********' },
    { regex: /(同学|学生)[\u4e00-\u9fa5]{2,4}/g, replace: '同学' },
    { regex: /(来访|来访同学)[\u4e00-\u9fa5]{2,4}/g, replace: '来访同学' }
  ];
  let result = text;
  patterns.forEach(p => {
    result = result.replace(p.regex, p.replace);
  });
  return result;
}

function desensitizeLocation(location) {
  if (!location || location.trim() === '') return '';
  return LOCATIONS[hashToIndex(location, LOCATIONS.length)];
}

function checkMinor(age, birthDate) {
  if (age && parseInt(age) < 18) return true;
  if (birthDate) {
    const birthYear = parseInt(birthDate.substring(0, 4));
    const currentYear = new Date().getFullYear();
    if (currentYear - birthYear < 18) return true;
  }
  return false;
}

function desensitizeRow(row, fieldMapping) {
  const result = { ...row };
  const flags = {
    hasMinor: false,
    hasFreeText: false,
    hasRepeatable: false
  };

  if (fieldMapping.name) {
    result[fieldMapping.name] = desensitizeName(row[fieldMapping.name]);
  }
  if (fieldMapping.counselor) {
    result[fieldMapping.counselor] = desensitizeName(row[fieldMapping.counselor], true);
  }
  if (fieldMapping.phone) {
    result[fieldMapping.phone] = desensitizePhone(row[fieldMapping.phone]);
  }
  if (fieldMapping.idCard) {
    result[fieldMapping.idCard] = desensitizeIdCard(row[fieldMapping.idCard]);
  }
  if (fieldMapping.email) {
    result[fieldMapping.email] = desensitizeEmail(row[fieldMapping.email]);
  }
  if (fieldMapping.studentId) {
    result[fieldMapping.studentId] = desensitizeStudentId(row[fieldMapping.studentId]);
  }
  if (fieldMapping.location) {
    result[fieldMapping.location] = desensitizeLocation(row[fieldMapping.location]);
  }

  if (fieldMapping.freeTextFields) {
    fieldMapping.freeTextFields.forEach(field => {
      if (row[field]) {
        result[field] = desensitizeFreeText(row[field]);
        flags.hasFreeText = true;
      }
    });
  }

  if (fieldMapping.age || fieldMapping.birthDate) {
    flags.hasMinor = checkMinor(row[fieldMapping.age], row[fieldMapping.birthDate]);
  }

  flags.hasRepeatable = true;

  return { row: result, flags };
}

function getDefaultFieldMapping() {
  return {
    name: '来访者姓名',
    counselor: '咨询师',
    phone: '联系电话',
    idCard: '身份证号',
    email: '邮箱',
    studentId: '学号',
    age: '年龄',
    birthDate: '出生日期',
    location: '咨询地点',
    appointmentTime: '预约时间',
    consultationType: '咨询类型',
    freeTextFields: ['主诉内容', '咨询记录', '备注']
  };
}

function detectFieldMapping(headers) {
  const mapping = getDefaultFieldMapping();
  const detected = { freeTextFields: [] };
  const headerLowerMap = {};
  headers.forEach(h => {
    headerLowerMap[h.toLowerCase()] = h;
  });

  Object.keys(mapping).forEach(key => {
    if (key === 'freeTextFields') {
      mapping[key].forEach(field => {
        const lower = field.toLowerCase();
        for (const h of headers) {
          if (h.toLowerCase().includes(lower) || 
              h.toLowerCase().includes('记录') || 
              h.toLowerCase().includes('内容') || 
              h.toLowerCase().includes('备注') ||
              h.toLowerCase().includes('描述')) {
            if (!detected.freeTextFields.includes(h)) {
              detected.freeTextFields.push(h);
            }
          }
        }
      });
    } else {
      const targetLower = mapping[key].toLowerCase();
      for (const h of headers) {
        const hLower = h.toLowerCase();
        if (hLower === targetLower || 
            hLower.includes(targetLower.replace(/姓名/, '').replace(/咨询/, '')) ||
            (key === 'name' && (hLower.includes('姓名') || hLower.includes('来访') || hLower.includes('学生姓名'))) ||
            (key === 'counselor' && (hLower.includes('咨询师') || hLower.includes('老师'))) ||
            (key === 'phone' && (hLower.includes('电话') || hLower.includes('手机'))) ||
            (key === 'idCard' && (hLower.includes('身份') || hLower.includes('证件'))) ||
            (key === 'email' && hLower.includes('邮箱')) ||
            (key === 'studentId' && (hLower.includes('学号') || hLower.includes('编号'))) ||
            (key === 'age' && hLower.includes('年龄')) ||
            (key === 'birthDate' && (hLower.includes('出生') || hLower.includes('生日'))) ||
            (key === 'location' && (hLower.includes('地点') || hLower.includes('位置') || hLower.includes('室'))) ||
            (key === 'appointmentTime' && (hLower.includes('时间') || hLower.includes('日期'))) ||
            (key === 'consultationType' && (hLower.includes('类型') || hLower.includes('方式')))) {
          detected[key] = h;
          break;
        }
      }
    }
  });

  return detected;
}

module.exports = {
  desensitizeName,
  desensitizePhone,
  desensitizeIdCard,
  desensitizeEmail,
  desensitizeStudentId,
  desensitizeFreeText,
  desensitizeLocation,
  desensitizeRow,
  getDefaultFieldMapping,
  detectFieldMapping,
  checkMinor
};