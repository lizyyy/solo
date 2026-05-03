const Signature = require('../src/signature');

describe('Signature', () => {
  let signature;

  beforeEach(() => {
    signature = new Signature({
      algorithm: 'sha256',
      header: 'X-Webhook-Signature',
      prefix: 'sha256='
    });
  });

  describe('generate', () => {
    it('should generate a valid HMAC signature', () => {
      const secret = 'test-secret-key';
      const payload = { event: 'test', data: 'value' };
      
      const sig = signature.generate(secret, payload);
      
      expect(sig).toBeDefined();
      expect(sig.startsWith('sha256=')).toBe(true);
      expect(sig.length).toBeGreaterThan('sha256='.length);
    });

    it('should generate identical signatures for identical payloads', () => {
      const secret = 'test-secret-key';
      const payload = { event: 'test', data: 'value' };
      
      const sig1 = signature.generate(secret, payload);
      const sig2 = signature.generate(secret, payload);
      
      expect(sig1).toBe(sig2);
    });

    it('should generate different signatures for different secrets', () => {
      const payload = { event: 'test' };
      
      const sig1 = signature.generate('secret-1', payload);
      const sig2 = signature.generate('secret-2', payload);
      
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('verify', () => {
    it('should verify a valid signature', () => {
      const secret = 'test-secret-key';
      const payload = { event: 'test' };
      const sig = signature.generate(secret, payload);
      
      const result = signature.verify(secret, payload, sig);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should reject an invalid signature', () => {
      const secret = 'test-secret-key';
      const payload = { event: 'test' };
      const wrongSig = 'sha256=wrongsignature12345678901234567890';
      
      const result = signature.verify(secret, payload, wrongSig);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Signature mismatch');
    });

    it('should reject a missing signature', () => {
      const result = signature.verify('secret', {}, null);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing signature');
    });
  });

  describe('verifyFromRequest', () => {
    it('should verify signature from headers', () => {
      const secret = 'test-secret-key';
      const payload = { event: 'test' };
      const sig = signature.generate(secret, payload);
      
      const headers = {
        'x-webhook-signature': sig
      };
      
      const result = signature.verifyFromRequest(secret, payload, headers);
      
      expect(result.valid).toBe(true);
    });

    it('should handle case-insensitive header names', () => {
      const secret = 'test-secret-key';
      const payload = { event: 'test' };
      const sig = signature.generate(secret, payload);
      
      const headers = {
        'X-Webhook-Signature': sig
      };
      
      const result = signature.verifyFromRequest(secret, payload, headers);
      
      expect(result.valid).toBe(true);
    });

    it('should reject missing signature header', () => {
      const result = signature.verifyFromRequest('secret', {}, {});
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing');
    });
  });

  describe('generateRequestHeaders', () => {
    it('should generate headers with correct signature', () => {
      const secret = 'test-secret-key';
      const payload = { event: 'test' };
      
      const headers = signature.generateRequestHeaders(secret, payload);
      
      expect(headers['X-Webhook-Signature']).toBeDefined();
      expect(headers['X-Webhook-Signature'].startsWith('sha256=')).toBe(true);
    });
  });
});