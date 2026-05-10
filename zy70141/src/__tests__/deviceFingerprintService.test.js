const {
  normalizeString,
  isBot,
  isMobileDevice,
  parseUserAgent,
  generateFingerprintHash,
  calculateFingerprintSimilarity,
  getClientIP,
} = require('../services/deviceFingerprintService');

describe('Device Fingerprint Service', () => {
  describe('normalizeString', () => {
    it('should return empty string for null or undefined', () => {
      expect(normalizeString(null)).toBe('');
      expect(normalizeString(undefined)).toBe('');
      expect(normalizeString('')).toBe('');
    });

    it('should trim and lowercase string', () => {
      expect(normalizeString('  Chrome/120.0  ')).toBe('chrome/120.0');
      expect(normalizeString('Mozilla/5.0')).toBe('mozilla/5.0');
    });
  });

  describe('isBot', () => {
    it('should return true for empty user agent', () => {
      expect(isBot('')).toBe(true);
      expect(isBot(null)).toBe(true);
    });

    it('should detect common bots', () => {
      expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true);
      expect(isBot('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)')).toBe(true);
      expect(isBot('curl/7.68.0')).toBe(true);
      expect(isBot('python-requests/2.28.1')).toBe(true);
      expect(isBot('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)')).toBe(true);
      expect(isBot('Twitterbot/1.0')).toBe(true);
    });

    it('should return false for normal browsers', () => {
      expect(isBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')).toBe(false);
      expect(isBot('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')).toBe(false);
      expect(isBot('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15')).toBe(false);
    });
  });

  describe('isMobileDevice', () => {
    it('should detect iOS devices', () => {
      expect(isMobileDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15')).toBe(true);
      expect(isMobileDevice('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15')).toBe(true);
    });

    it('should detect Android devices', () => {
      expect(isMobileDevice('Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36')).toBe(true);
    });

    it('should return false for desktop', () => {
      expect(isMobileDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0')).toBe(false);
      expect(isMobileDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0')).toBe(false);
    });
  });

  describe('parseUserAgent', () => {
    it('should parse Chrome browser', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.109 Safari/537.36';
      const result = parseUserAgent(ua);
      
      expect(result.browser).toBe('Chrome');
      expect(result.browserVersion).toBe('120.0');
      expect(result.os).toBe('Windows');
      expect(result.osVersion).toBe('10.0');
    });

    it('should parse Firefox browser', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';
      const result = parseUserAgent(ua);
      
      expect(result.browser).toBe('Firefox');
      expect(result.browserVersion).toBe('121.0');
    });

    it('should parse Safari browser', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15';
      const result = parseUserAgent(ua);
      
      expect(result.browser).toBe('Safari');
      expect(result.browserVersion).toBe('17.2');
      expect(result.os).toBe('macOS');
      expect(result.osVersion).toBe('10.15.7');
    });

    it('should parse Android device', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 13; SM-G991B Build/TP1A.220624.014) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36';
      const result = parseUserAgent(ua);
      
      expect(result.os).toBe('Android');
      expect(result.osVersion).toBe('13');
    });

    it('should parse iOS device', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
      const result = parseUserAgent(ua);
      
      expect(result.os).toBe('iOS');
      expect(result.osVersion).toBe('17.2');
    });

    it('should return unknown for empty user agent', () => {
      const result = parseUserAgent('');
      expect(result.browser).toBe('unknown');
      expect(result.os).toBe('unknown');
    });
  });

  describe('generateFingerprintHash', () => {
    it('should generate consistent hash for same components', () => {
      const components = {
        ipAddress: '192.168.1.1',
        userAgent: 'Chrome/120.0',
        acceptLanguage: 'en-US,en;q=0.9',
        acceptEncoding: 'gzip, deflate, br',
        platform: '"Windows"',
        mobile: '?0',
        dnt: '1',
      };
      
      const hash1 = generateFingerprintHash(components);
      const hash2 = generateFingerprintHash(components);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate different hash for different components', () => {
      const components1 = {
        ipAddress: '192.168.1.1',
        userAgent: 'Chrome/120.0',
      };
      
      const components2 = {
        ipAddress: '192.168.1.2',
        userAgent: 'Chrome/120.0',
      };
      
      const hash1 = generateFingerprintHash(components1);
      const hash2 = generateFingerprintHash(components2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('calculateFingerprintSimilarity', () => {
    it('should return 0 for null inputs', () => {
      expect(calculateFingerprintSimilarity(null, {})).toBe(0);
      expect(calculateFingerprintSimilarity({}, null)).toBe(0);
      expect(calculateFingerprintSimilarity(null, null)).toBe(0);
    });

    it('should return 1 for identical fingerprints', () => {
      const fp1 = {
        ipAddress: '192.168.1.1',
        userAgent: 'Chrome/120.0',
        acceptLanguage: 'en-US',
        acceptEncoding: 'gzip',
        platform: 'Windows',
      };
      
      const fp2 = {
        ipAddress: '192.168.1.1',
        userAgent: 'Chrome/120.0',
        acceptLanguage: 'en-US',
        acceptEncoding: 'gzip',
        platform: 'Windows',
      };
      
      expect(calculateFingerprintSimilarity(fp1, fp2)).toBe(1);
    });

    it('should return 0.8 for 4 out of 5 fields matching', () => {
      const fp1 = {
        ipAddress: '192.168.1.1',
        userAgent: 'Chrome/120.0',
        acceptLanguage: 'en-US',
        acceptEncoding: 'gzip',
        platform: 'Windows',
      };
      
      const fp2 = {
        ipAddress: '192.168.1.1',
        userAgent: 'Chrome/120.0',
        acceptLanguage: 'en-US',
        acceptEncoding: 'gzip',
        platform: 'macOS',
      };
      
      expect(calculateFingerprintSimilarity(fp1, fp2)).toBe(0.8);
    });

    it('should be case insensitive', () => {
      const fp1 = {
        ipAddress: '192.168.1.1',
        userAgent: 'CHROME/120.0',
        acceptLanguage: 'EN-US',
        acceptEncoding: 'GZIP',
        platform: 'WINDOWS',
      };
      
      const fp2 = {
        ipAddress: '192.168.1.1',
        userAgent: 'chrome/120.0',
        acceptLanguage: 'en-us',
        acceptEncoding: 'gzip',
        platform: 'windows',
      };
      
      expect(calculateFingerprintSimilarity(fp1, fp2)).toBe(1);
    });
  });

  describe('getClientIP', () => {
    it('should get IP from x-forwarded-for header', () => {
      const req = {
        headers: {
          'x-forwarded-for': '10.0.0.1, 192.168.1.1',
        },
        ip: '127.0.0.1',
      };
      
      expect(getClientIP(req)).toBe('10.0.0.1');
    });

    it('should get IP from x-real-ip header', () => {
      const req = {
        headers: {
          'x-real-ip': '192.168.1.1',
        },
        ip: '127.0.0.1',
      };
      
      expect(getClientIP(req)).toBe('192.168.1.1');
    });

    it('should fall back to req.ip', () => {
      const req = {
        headers: {},
        ip: '192.168.1.1',
      };
      
      expect(getClientIP(req)).toBe('192.168.1.1');
    });

    it('should return unknown if no IP available', () => {
      const req = {
        headers: {},
        connection: {},
      };
      
      expect(getClientIP(req)).toBe('unknown');
    });
  });
});
