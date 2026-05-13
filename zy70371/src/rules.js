const crypto = require('crypto');

const RULES = {
  phone: {
    name: '手机号码',
    category: 'phone',
    riskLevel: 'high',
    pattern: /(?<![\dA-Za-z])1[3-9]\d{9}(?![\dA-Za-z])/g,
    validator: (match) => {
      return /^1[3-9]\d{9}$/.test(match);
    },
    replacement: '138****${last4}',
    describe: '中国内地手机号码，以1开头，11位数字'
  },
  
  email: {
    name: '电子邮箱',
    category: 'email',
    riskLevel: 'medium',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?![a-zA-Z0-9@])/g,
    validator: (match) => {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(match)) return false;
      if (match.includes('example')) return false;
      if (match.includes('test')) return false;
      if (match.includes('xxx')) return false;
      if (match.includes('*')) return false;
      return true;
    },
    replacement: '${first3}****@${domain}',
    describe: '标准电子邮件地址格式'
  },
  
  idCard: {
    name: '身份证号',
    category: 'idcard',
    riskLevel: 'high',
    pattern: /(?<![\dA-Za-z])\d{17}[\dXx](?![\dA-Za-z])/g,
    validator: (match) => {
      if (!/^\d{17}[\dXx]$/.test(match)) return false;
      
      const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
      const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
      
      const year = parseInt(match.substring(6, 10));
      const month = parseInt(match.substring(10, 12));
      const day = parseInt(match.substring(12, 14));
      
      if (year < 1900 || year > 2100) return false;
      if (month < 1 || month > 12) return false;
      if (day < 1 || day > 31) return false;
      
      let sum = 0;
      for (let i = 0; i < 17; i++) {
        sum += parseInt(match[i]) * weights[i];
      }
      const checkCode = checkCodes[sum % 11];
      return checkCode === match[17].toUpperCase();
    },
    replacement: '${first6}********${last4}',
    describe: '中国居民身份证号，18位数字或末尾X'
  },
  
  bankCard: {
    name: '银行卡号',
    category: 'bankcard',
    riskLevel: 'high',
    pattern: /(?<![\dA-Za-z])\d{16,19}(?![\dA-Za-z])/g,
    validator: (match) => {
      if (!/^\d{16,19}$/.test(match)) return false;
      
      let sum = 0;
      for (let i = match.length - 2; i >= 0; i--) {
        let digit = parseInt(match[i]);
        if ((match.length - i) % 2 === 0) {
          digit *= 2;
          if (digit > 9) digit -= 9;
        }
        sum += digit;
      }
      const luhn = (10 - (sum % 10)) % 10;
      return luhn === parseInt(match[match.length - 1]);
    },
    replacement: '${first6}****${last4}',
    describe: '银行卡号，16-19位数字，通过Luhn算法校验'
  },
  
  address: {
    name: '地址片段',
    category: 'address',
    riskLevel: 'medium',
    pattern: /(?:北京市|天津市|上海市|重庆市|河北省|山西省|辽宁省|吉林省|黑龙江省|江苏省|浙江省|安徽省|福建省|江西省|山东省|河南省|湖北省|湖南省|广东省|海南省|四川省|贵州省|云南省|陕西省|甘肃省|青海省|台湾省|内蒙古自治区|广西壮族自治区|西藏自治区|宁夏回族自治区|新疆维吾尔自治区|香港特别行政区|澳门特别行政区|北京市东城区|北京市西城区|上海市浦东新区|广州市天河区|深圳市南山区|杭州市西湖区)[\u4e00-\u9fa5\d\-_ 路街弄号楼小区村县州市区镇]{2,}/g,
    validator: (match) => {
      if (match.length < 6) return false;
      if (match.includes('测试')) return false;
      if (match.includes('示例')) return false;
      if (match.includes('*')) return false;
      return true;
    },
    replacement: '****${city}****',
    describe: '中国地址片段，包含省市区路街等关键字'
  },
  
  name: {
    name: '中文姓名',
    category: 'name',
    riskLevel: 'medium',
    pattern: /\b[李王张刘陈杨赵黄周吴徐孙胡朱高林何郭马罗梁宋郑谢韩唐冯于董萧程曹袁邓许傅沈曾彭吕苏卢蒋蔡贾丁魏薛叶阎余潘杜戴夏钟汪田任姜范方石姚谭廖邹熊金陆郝孔白崔康毛邱秦江史顾侯邵孟龙万段雷钱汤尹黎易常武乔贺赖龚文][\u4e00-\u9fa5]{1,3}\b/g,
    validator: (match) => {
      if (match.length < 2 || match.length > 4) return false;
      if (match.includes('测试')) return false;
      if (match.includes('示例')) return false;
      if (match.includes('用户')) return false;
      if (match.includes('匿名')) return false;
      if (match === '张三' || match === '李四' || match === '王五' || match === '赵六') return false;
      
      const context = match + match.substring(0, 10);
      if (context.includes('测试') || context.includes('示例')) return false;
      if (context.match(/[a-zA-Z]+/)) return false;
      
      return true;
    },
    replacement: '张**',
    describe: '常见中文姓名格式（2-4个汉字）'
  }
};

function detectRedacted(match) {
  const redactedPatterns = [
    /\*/g,
    /x{3,}/gi,
    /\*{3,}/g,
    /test/i,
    /example/i,
    /demo/i,
    /sample/i,
    /mock/i,
    /placeholder/i,
    /fake/i,
    /temp/i,
    /tmp/i
  ];
  
  const matchLower = match.toLowerCase();
  return redactedPatterns.some(pattern => pattern.test(matchLower));
}

function generateMatchId(filePath, lineNumber, matchText, ruleName) {
  const content = `${filePath}:${lineNumber}:${matchText}:${ruleName}`;
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

function applyReplacement(match, replacement) {
  const last4 = match.slice(-4);
  const first3 = match.slice(0, 3);
  const first6 = match.slice(0, 6);
  const domain = match.split('@')[1] || 'example.com';
  const city = match.substring(0, 3);
  
  return replacement
    .replace('${last4}', last4)
    .replace('${first3}', first3)
    .replace('${first6}', first6)
    .replace('${domain}', domain)
    .replace('${city}', city);
}

function getRiskLevel(ruleName) {
  return RULES[ruleName]?.riskLevel || 'low';
}

function getRuleDescription(ruleName) {
  return RULES[ruleName]?.describe || '未知规则';
}

module.exports = {
  RULES,
  detectRedacted,
  generateMatchId,
  applyReplacement,
  getRiskLevel,
  getRuleDescription
};