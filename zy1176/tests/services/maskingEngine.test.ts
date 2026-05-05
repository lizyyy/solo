import { describe, it, expect } from 'vitest';

describe('Sensitive Data Detection Rules', () => {
  describe('Phone Number (Chinese)', () => {
    const phoneRegex = /1[3-9]\d{9}/g;
    
    it('should detect valid Chinese phone numbers', () => {
      expect('13812345678'.match(phoneRegex)).not.toBeNull();
      expect('13987654321'.match(phoneRegex)).not.toBeNull();
      expect('15012345678'.match(phoneRegex)).not.toBeNull();
      expect('18612345678'.match(phoneRegex)).not.toBeNull();
    });
    
    it('should not detect invalid phone numbers', () => {
      expect('12812345678'.match(phoneRegex)).toBeNull();
      expect('11812345678'.match(phoneRegex)).toBeNull();
      expect('1381234567'.match(phoneRegex)).toBeNull();
      expect('abc123def'.match(phoneRegex)).toBeNull();
    });
  });

  describe('Email Address', () => {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    
    it('should detect valid email addresses', () => {
      expect('test@example.com'.match(emailRegex)).not.toBeNull();
      expect('user.name+tag@domain.co.uk'.match(emailRegex)).not.toBeNull();
      expect('wangwu@abctech.com'.match(emailRegex)).not.toBeNull();
    });
    
    it('should not detect invalid email addresses', () => {
      expect('test@'.match(emailRegex)).toBeNull();
      expect('@example.com'.match(emailRegex)).toBeNull();
      expect('test@example'.match(emailRegex)).toBeNull();
    });
  });

  describe('Chinese ID Card', () => {
    const idRegex = /\d{17}[\dXx]/g;
    
    it('should detect valid Chinese ID card numbers', () => {
      expect('110101199001011234'.match(idRegex)).not.toBeNull();
      expect('310101198505055678'.match(idRegex)).not.toBeNull();
      expect('44010119801010789X'.match(idRegex)).not.toBeNull();
    });
    
    it('should not detect invalid ID card numbers', () => {
      expect('11010119900101123'.match(idRegex)).toBeNull();
      expect('abcdefghijklmnopq'.match(idRegex)).toBeNull();
    });
  });

  describe('QQ Number', () => {
    const qqRegex = /[1-9]\d{4,10}/g;
    
    it('should detect valid QQ numbers', () => {
      expect('12345'.match(qqRegex)).not.toBeNull();
      expect('123456789'.match(qqRegex)).not.toBeNull();
      expect('9876543210'.match(qqRegex)).not.toBeNull();
    });
    
    it('should not detect invalid QQ numbers', () => {
      expect('01234'.match(qqRegex)).toBeNull();
      expect('123'.match(qqRegex)).toBeNull();
    });
  });

  describe('WeChat ID', () => {
    const wechatRegex = /[a-zA-Z][a-zA-Z0-9_-]{5,19}/g;
    
    it('should detect valid WeChat IDs', () => {
      expect('wangwu_abc'.match(wechatRegex)).not.toBeNull();
      expect('WeChat2024'.match(wechatRegex)).not.toBeNull();
      expect('user-name_123'.match(wechatRegex)).not.toBeNull();
    });
    
    it('should not detect invalid WeChat IDs', () => {
      expect('123abc'.match(wechatRegex)).toBeNull();
      expect('a123'.match(wechatRegex)).toBeNull();
    });
  });

  describe('Bank Card Number (Luhn Check)', () => {
    const luhnCheck = (digits: string): boolean => {
      if (!/^\d+$/.test(digits)) return false;
      
      let sum = 0;
      let isEven = false;
      
      for (let i = digits.length - 1; i >= 0; i--) {
        let digit = parseInt(digits[i], 10);
        
        if (isEven) {
          digit *= 2;
          if (digit > 9) digit -= 9;
        }
        
        sum += digit;
        isEven = !isEven;
      }
      
      return sum % 10 === 0;
    };
    
    it('should pass Luhn check for valid card numbers', () => {
      expect(luhnCheck('4111111111111111')).toBe(true);
      expect(luhnCheck('5500000000000004')).toBe(true);
    });
    
    it('should fail Luhn check for invalid card numbers', () => {
      expect(luhnCheck('4111111111111112')).toBe(false);
      expect(luhnCheck('1234567890123456')).toBe(false);
    });
    
    it('should return false for non-digit inputs', () => {
      expect(luhnCheck('abcdefghijklmnop')).toBe(false);
      expect(luhnCheck('')).toBe(false);
    });
  });

  describe('Company Name Pattern', () => {
    const companyRegex = /[\u4e00-\u9fa5]+(?:公司|集团|科技|有限公司|股份有限公司|事务所)/g;
    
    it('should detect Chinese company names', () => {
      expect('ABC科技有限公司'.match(companyRegex)).not.toBeNull();
      expect('XYZ集团'.match(companyRegex)).not.toBeNull();
      expect('某某有限公司'.match(companyRegex)).not.toBeNull();
      expect('法律事务所'.match(companyRegex)).not.toBeNull();
    });
  });

  describe('Address Pattern', () => {
    const addressRegex = /[\u4e00-\u9fa5]+(?:省|市|区|县|镇|街道|路|号|楼|单元)/g;
    
    it('should detect Chinese address patterns', () => {
      expect('北京市海淀区'.match(addressRegex)).not.toBeNull();
      expect('中关村软件园8号楼'.match(addressRegex)).not.toBeNull();
      expect('张江高科技园区'.match(addressRegex)).not.toBeNull();
      expect('某某街道100号'.match(addressRegex)).not.toBeNull();
    });
  });

  describe('License Plate Pattern', () => {
    const plateRegex = /[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼][A-Z][A-Z0-9]{5}[A-Z0-9挂学警港澳]?/g;
    
    it('should detect Chinese license plates', () => {
      expect('京A12345'.match(plateRegex)).not.toBeNull();
      expect('沪B67890'.match(plateRegex)).not.toBeNull();
      expect('粤C123AB'.match(plateRegex)).not.toBeNull();
    });
  });
});

describe('Default Replacement Logic', () => {
  const getDefaultReplacement = (category: string, original: string): string => {
    const masks: Record<string, string> = {
      contact: '[联系方式]',
      identity: '[身份信息]',
      organization: '[机构名称]',
      finance: '[金融信息]',
      location: '[地理位置]',
    };
    
    if (category === 'contact' && original.includes('@')) {
      return '***@***.com';
    }
    if (category === 'contact' && /^1[3-9]/.test(original)) {
      return original.substring(0, 3) + '****' + original.substring(7);
    }
    if (category === 'identity' && original.length >= 18) {
      return original.substring(0, 6) + '********' + original.substring(14);
    }
    
    return masks[category] || '[敏感信息]';
  };
  
  describe('Phone Number Masking', () => {
    it('should mask phone numbers properly', () => {
      expect(getDefaultReplacement('contact', '13812345678')).toBe('138****5678');
      expect(getDefaultReplacement('contact', '13987654321')).toBe('139****4321');
    });
  });
  
  describe('Email Masking', () => {
    it('should mask email addresses properly', () => {
      expect(getDefaultReplacement('contact', 'test@example.com')).toBe('***@***.com');
      expect(getDefaultReplacement('contact', 'user@domain.org')).toBe('***@***.com');
    });
  });
  
  describe('ID Card Masking', () => {
    it('should mask ID card numbers properly', () => {
      expect(getDefaultReplacement('identity', '110101199001011234')).toBe('110101********1234');
      expect(getDefaultReplacement('identity', '310101198505055678')).toBe('310101********5678');
    });
  });
  
  describe('Other Categories', () => {
    it('should return default mask for other categories', () => {
      expect(getDefaultReplacement('organization', 'ABC科技有限公司')).toBe('[机构名称]');
      expect(getDefaultReplacement('finance', '6222021234567890')).toBe('[金融信息]');
      expect(getDefaultReplacement('location', '北京市海淀区')).toBe('[地理位置]');
      expect(getDefaultReplacement('other', 'something')).toBe('[敏感信息]');
    });
  });
});
