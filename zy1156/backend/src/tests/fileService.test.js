const fileService = require('../services/fileService');

describe('fileService', () => {
  describe('parseJsonl', () => {
    it('should parse valid JSONL content', () => {
      const content = `{"role": "user", "content": "Hello"}
{"role": "assistant", "content": "Hi"}`;
      const result = fileService.parseJsonl(content);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0].role).toBe('user');
      expect(result[1].role).toBe('assistant');
    });

    it('should return empty array for null or undefined input', () => {
      expect(fileService.parseJsonl(null)).toEqual([]);
      expect(fileService.parseJsonl(undefined)).toEqual([]);
    });

    it('should skip empty lines', () => {
      const content = `{"role": "user"}

{"role": "assistant"}

`;
      const result = fileService.parseJsonl(content);
      expect(result.length).toBe(2);
    });

    it('should throw error for invalid JSON in a line', () => {
      const content = `{"role": "user"}
invalid json here
{"role": "assistant"}`;
      expect(() => fileService.parseJsonl(content)).toThrow();
    });
  });

  describe('parseYaml', () => {
    it('should parse valid YAML content', () => {
      const content = `
maxTokens: 4096
priorityRules:
  budget: 100
  systemPrompt: 90
`;
      const result = fileService.parseYaml(content);
      expect(result).toBeDefined();
      expect(result.maxTokens).toBe(4096);
      expect(result.priorityRules.budget).toBe(100);
    });

    it('should return empty object for null or undefined input', () => {
      expect(fileService.parseYaml(null)).toEqual({});
      expect(fileService.parseYaml(undefined)).toEqual({});
    });

    it('should throw error for invalid YAML', () => {
      const content = `
invalid: yaml:
  - indentation: wrong
    - this: is bad
`;
      expect(() => fileService.parseYaml(content)).toThrow();
    });
  });

  describe('parseJson', () => {
    it('should parse valid JSON content', () => {
      const content = '{"success": true, "data": [1, 2, 3]}';
      const result = fileService.parseJson(content);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([1, 2, 3]);
    });

    it('should return null for null or undefined input', () => {
      expect(fileService.parseJson(null)).toBeNull();
      expect(fileService.parseJson(undefined)).toBeNull();
    });

    it('should throw error for invalid JSON', () => {
      const content = '{invalid json}';
      expect(() => fileService.parseJson(content)).toThrow();
    });
  });

  describe('validateFile', () => {
    describe('conversations type', () => {
      it('should validate valid conversations JSONL', () => {
        const content = `{"role": "user", "content": "Hello"}
{"role": "assistant", "content": "Hi"}`;
        const result = fileService.validateFile('conversations', content);
        expect(result.valid).toBe(true);
        expect(result.errors.length).toBe(0);
      });

      it('should detect missing role field', () => {
        const content = `{"content": "Hello"}`;
        const result = fileService.validateFile('conversations', content);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should detect missing content field', () => {
        const content = `{"role": "user"}`;
        const result = fileService.validateFile('conversations', content);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('docs type', () => {
      it('should validate string content', () => {
        const content = '# This is a markdown document\n\nSome content here.';
        const result = fileService.validateFile('docs', content);
        expect(result.valid).toBe(true);
      });

      it('should reject non-string content', () => {
        const result = fileService.validateFile('docs', null);
        expect(result.valid).toBe(false);
      });
    });

    describe('toolResults type', () => {
      it('should validate valid JSON', () => {
        const content = '{"success": true, "data": {}}';
        const result = fileService.validateFile('toolResults', content);
        expect(result.valid).toBe(true);
      });

      it('should reject invalid JSON', () => {
        const content = '{invalid json}';
        const result = fileService.validateFile('toolResults', content);
        expect(result.valid).toBe(false);
      });
    });

    describe('budget type', () => {
      it('should validate valid YAML', () => {
        const content = 'maxTokens: 4096\npriority: high';
        const result = fileService.validateFile('budget', content);
        expect(result.valid).toBe(true);
      });

      it('should reject invalid YAML', () => {
        const content = 'invalid: yaml: : bad';
        const result = fileService.validateFile('budget', content);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('processUploadedFiles', () => {
    it('should process files correctly', () => {
      const files = {
        conversations: {
          buffer: Buffer.from('{"role": "user", "content": "Hello"}\n{"role": "assistant", "content": "Hi"}')
        },
        docs: {
          buffer: Buffer.from('# Markdown Document\n\nContent here.')
        }
      };

      const result = fileService.processUploadedFiles(files);
      expect(result.errors.length).toBe(0);
      expect(result.conversations).toBeDefined();
      expect(result.conversations.length).toBe(2);
      expect(result.docs).toBeDefined();
    });

    it('should report errors for invalid files', () => {
      const files = {
        conversations: {
          buffer: Buffer.from('invalid json content')
        }
      };

      const result = fileService.processUploadedFiles(files);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle null files gracefully', () => {
      const files = {
        conversations: null,
        docs: null,
        toolResults: null,
        budget: null
      };

      const result = fileService.processUploadedFiles(files);
      expect(result.conversations).toBeNull();
      expect(result.docs).toBeNull();
      expect(result.toolResults).toBeNull();
      expect(result.budget).toBeNull();
    });
  });

  describe('formatContextForDisplay', () => {
    it('should format context data for display', () => {
      const context = {
        conversations: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi' }
        ],
        docs: '# Markdown',
        toolResults: { success: true },
        budget: { maxTokens: 4096 }
      };

      const result = fileService.formatContextForDisplay(context);
      expect(result.conversations.length).toBe(2);
      expect(result.docs).toBe('# Markdown');
      expect(result.toolResults).toEqual({ success: true });
      expect(result.budget).toEqual({ maxTokens: 4096 });
      expect(result.summary.conversationCount).toBe(2);
      expect(result.summary.docsLength).toBe(10);
      expect(result.summary.hasToolResults).toBe(true);
      expect(result.summary.hasBudget).toBe(true);
    });

    it('should handle null values gracefully', () => {
      const context = {};
      const result = fileService.formatContextForDisplay(context);
      expect(result.conversations).toEqual([]);
      expect(result.docs).toBe('');
      expect(result.toolResults).toBeNull();
      expect(result.budget).toEqual({});
    });
  });
});
