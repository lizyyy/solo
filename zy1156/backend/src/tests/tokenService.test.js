const tokenService = require('../services/tokenService');

describe('tokenService', () => {
  describe('countTokens', () => {
    it('should return 0 for null or undefined input', () => {
      expect(tokenService.countTokens(null)).toBe(0);
      expect(tokenService.countTokens(undefined)).toBe(0);
      expect(tokenService.countTokens('')).toBe(0);
    });

    it('should count tokens correctly for simple text', () => {
      const text = 'Hello, world!';
      const count = tokenService.countTokens(text);
      expect(count).toBeGreaterThan(0);
      expect(typeof count).toBe('number');
    });

    it('should handle Chinese text', () => {
      const text = '你好，世界！';
      const count = tokenService.countTokens(text);
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('countConversationTokens', () => {
    it('should return 0 for non-array input', () => {
      expect(tokenService.countConversationTokens(null)).toBe(0);
      expect(tokenService.countConversationTokens(undefined)).toBe(0);
      expect(tokenService.countConversationTokens({})).toBe(0);
    });

    it('should count tokens correctly for conversation messages', () => {
      const conversations = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ];
      const count = tokenService.countConversationTokens(conversations);
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('estimateContextTokens', () => {
    it('should estimate tokens correctly with all data types', () => {
      const contextData = {
        conversations: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' }
        ],
        docs: 'This is a long document with some text content.',
        toolResults: { result: 'success', data: [1, 2, 3] },
        budgetYaml: 'maxTokens: 4096\npriority: high'
      };

      const count = tokenService.estimateContextTokens(contextData);
      expect(count).toBeGreaterThan(0);
    });

    it('should handle empty input gracefully', () => {
      const count = tokenService.estimateContextTokens({});
      expect(count).toBe(0);
    });
  });

  describe('truncateText', () => {
    it('should not truncate text if it fits within token limit', () => {
      const text = 'Short text';
      const result = tokenService.truncateText(text, 100);
      expect(result.truncated).toBe(false);
      expect(result.text).toBe(text);
      expect(result.tokensRemoved).toBe(0);
    });

    it('should truncate text if it exceeds token limit', () => {
      const longText = 'This is a very long text that will definitely exceed the token limit when we count it properly. '.repeat(100);
      const result = tokenService.truncateText(longText, 10);
      expect(result.truncated).toBe(true);
      expect(result.tokensRemoved).toBeGreaterThan(0);
      expect(typeof result.text).toBe('string');
    });

    it('should truncate from start when fromStart is true', () => {
      const text = 'First part. Second part. Third part.';
      const result = tokenService.truncateText(text, 5, true);
      expect(result.truncated).toBe(true);
    });
  });

  describe('applyTokenBudget', () => {
    it('should apply token budget correctly', () => {
      const contextData = {
        conversations: [
          { role: 'system', content: 'You are a helpful assistant.', timestamp: 1 },
          { role: 'user', content: 'What is the weather today?', timestamp: 2 },
          { role: 'assistant', content: 'The weather is sunny with a temperature of 25 degrees Celsius.', timestamp: 3 }
        ],
        docs: 'Weather forecast document: This document contains weather information for today. The forecast indicates sunny weather with moderate temperatures. Humidity is low and winds are calm.',
        toolResults: {
          weatherApi: {
            success: true,
            data: { temp: 25, condition: 'sunny', humidity: 45 }
          }
        },
        budgetConstraints: {
          maxTokens: 1000,
          priority: 'balanced'
        }
      };

      const strategy = {
        maxTokens: 1000,
        priorityRules: {
          budget: 100,
          systemPrompt: 90,
          recentMessages: 80,
          toolResults: 70,
          docs: 60,
          oldMessages: 50
        }
      };

      const result = tokenService.applyTokenBudget(contextData, strategy);

      expect(result).toHaveProperty('retained');
      expect(result).toHaveProperty('lost');
      expect(result).toHaveProperty('statistics');
      expect(result.statistics).toHaveProperty('totalOriginalTokens');
      expect(result.statistics).toHaveProperty('totalRetainedTokens');
      expect(result.statistics).toHaveProperty('totalLostTokens');
      expect(Array.isArray(result.retained.conversations)).toBe(true);
    });

    it('should prioritize budget constraints first', () => {
      const contextData = {
        conversations: [
          { role: 'system', content: 'You are a helpful assistant.', timestamp: 1 }
        ],
        docs: '',
        toolResults: null,
        budgetConstraints: {
          maxTokens: 4096,
          priority: 'high'
        }
      };

      const strategy = {
        maxTokens: 100,
        priorityRules: {
          budget: 100,
          systemPrompt: 90,
          recentMessages: 80,
          toolResults: 70,
          docs: 60,
          oldMessages: 50
        }
      };

      const result = tokenService.applyTokenBudget(contextData, strategy);
      expect(result.retained.budgetConstraints).toEqual(contextData.budgetConstraints);
    });

    it('should handle empty context data', () => {
      const contextData = {
        conversations: [],
        docs: '',
        toolResults: null,
        budgetConstraints: {}
      };

      const strategy = {
        maxTokens: 4096,
        priorityRules: {}
      };

      const result = tokenService.applyTokenBudget(contextData, strategy);
      expect(result).toBeDefined();
      expect(result.statistics.totalOriginalTokens).toBe(0);
    });
  });
});
