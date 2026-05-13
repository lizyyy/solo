const { isCodePathMatch, findMatchingCodePaths, hasMatchingCodePath, getBasename } = require('../src/utils/codePathMatcher');

describe('codePathMatcher', () => {
  const codePath = {
    path: 'examples/src/authService.js',
    functionName: 'login'
  };

  describe('isCodePathMatch', () => {
    describe('Exact matching', () => {
      it('should match full path with function name', () => {
        expect(isCodePathMatch('examples/src/authService.js:login', codePath)).toBe(true);
      });

      it('should match full path without function name', () => {
        expect(isCodePathMatch('examples/src/authService.js', codePath)).toBe(true);
      });
    });

    describe('File name matching (key fix for the issue)', () => {
      it('should match filename:funcName format', () => {
        expect(isCodePathMatch('authService.js:login', codePath)).toBe(true);
      });

      it('should match just filename', () => {
        expect(isCodePathMatch('authService.js', codePath)).toBe(true);
      });
    });

    describe('Function name matching', () => {
      it('should match just function name', () => {
        expect(isCodePathMatch('login', codePath)).toBe(true);
      });
    });

    describe('Suffix path matching', () => {
      it('should match suffix path with function name', () => {
        expect(isCodePathMatch('src/authService.js:login', codePath)).toBe(true);
      });

      it('should match suffix path without function name', () => {
        expect(isCodePathMatch('src/authService.js', codePath)).toBe(true);
      });
    });

    describe('Case sensitivity', () => {
      it('should match case-insensitively by default', () => {
        expect(isCodePathMatch('AUTHSERVICE.JS:LOGIN', codePath)).toBe(true);
      });

      it('should not match case-sensitively when option is set', () => {
        expect(isCodePathMatch('AUTHSERVICE.JS:LOGIN', codePath, { caseSensitive: true })).toBe(false);
      });

      it('should match case-sensitively when exact', () => {
        expect(isCodePathMatch('authService.js:login', codePath, { caseSensitive: true })).toBe(true);
      });
    });

    describe('Non-matching cases', () => {
      it('should not match different function names', () => {
        expect(isCodePathMatch('authService.js:logout', codePath)).toBe(false);
      });

      it('should not match different filenames', () => {
        expect(isCodePathMatch('userService.js:login', codePath)).toBe(false);
      });

      it('should not match completely different paths', () => {
        expect(isCodePathMatch('lib/utils.js:helper', codePath)).toBe(false);
      });
    });

    describe('Different path separators', () => {
      const windowsCodePath = {
        path: 'examples\\src\\authService.js',
        functionName: 'login'
      };

      it('should handle backslash separators', () => {
        expect(isCodePathMatch('authService.js:login', windowsCodePath)).toBe(true);
      });

      it('should handle mixed separators in reference', () => {
        expect(isCodePathMatch('src/authService.js:login', windowsCodePath)).toBe(true);
      });
    });

    describe('Without function name', () => {
      const codePathNoFunc = {
        path: 'examples/src/authService.js'
      };

      it('should match full path without function', () => {
        expect(isCodePathMatch('examples/src/authService.js', codePathNoFunc)).toBe(true);
      });

      it('should match filename without function', () => {
        expect(isCodePathMatch('authService.js', codePathNoFunc)).toBe(true);
      });

      it('should not match with function name when code path has none', () => {
        expect(isCodePathMatch('authService.js:login', codePathNoFunc)).toBe(false);
      });
    });
  });

  describe('getBasename', () => {
    it('should extract basename from Unix path', () => {
      expect(getBasename('examples/src/authService.js')).toBe('authService.js');
    });

    it('should extract basename from Windows path', () => {
      expect(getBasename('examples\\src\\authService.js')).toBe('authService.js');
    });

    it('should return filename if no path separators', () => {
      expect(getBasename('authService.js')).toBe('authService.js');
    });
  });

  describe('findMatchingCodePaths', () => {
    const indexedCodePaths = [
      { path: 'examples/src/authService.js', functionName: 'AuthService' },
      { path: 'examples/src/authService.js', functionName: 'login' },
      { path: 'examples/src/authService.js', functionName: 'register' },
      { path: 'examples/src/authService.js', functionName: 'verifyPassword' }
    ];

    it('should find matching code paths by filename:funcName', () => {
      const matches = findMatchingCodePaths('authService.js:login', indexedCodePaths);
      expect(matches.length).toBe(1);
      expect(matches[0].functionName).toBe('login');
    });

    it('should find matching code paths by function name', () => {
      const matches = findMatchingCodePaths('login', indexedCodePaths);
      expect(matches.length).toBe(1);
      expect(matches[0].functionName).toBe('login');
    });

    it('should return empty array for non-matching paths', () => {
      const matches = findMatchingCodePaths('nonexistent.js:test', indexedCodePaths);
      expect(matches.length).toBe(0);
    });
  });

  describe('hasMatchingCodePath', () => {
    const indexedCodePaths = [
      { path: 'examples/src/authService.js', functionName: 'AuthService' },
      { path: 'examples/src/authService.js', functionName: 'login' },
      { path: 'examples/src/authService.js', functionName: 'register' },
      { path: 'examples/src/authService.js', functionName: 'verifyPassword' }
    ];

    const testCaseCodePaths = [
      'authService.js:login',
      'userController.js:handleLogin',
      'authService.js:register',
      'userRepository.js:findByUsername'
    ];

    it('should return true for matching paths', () => {
      expect(hasMatchingCodePath('authService.js:login', indexedCodePaths)).toBe(true);
    });

    it('should return true for matching function names', () => {
      expect(hasMatchingCodePath('register', indexedCodePaths)).toBe(true);
    });

    it('should return false for non-matching paths', () => {
      expect(hasMatchingCodePath('nonexistent.js:test', indexedCodePaths)).toBe(false);
    });

    it('should count matches correctly from test case code paths', () => {
      let matchCount = 0;
      testCaseCodePaths.forEach(ref => {
        if (hasMatchingCodePath(ref, indexedCodePaths)) {
          matchCount++;
        }
      });
      expect(matchCount).toBe(2);
    });
  });

  describe('Real-world integration tests', () => {
    const indexedCodePaths = [
      { path: 'examples/src/authService.js', functionName: 'AuthService' },
      { path: 'examples/src/authService.js', functionName: 'login' },
      { path: 'examples/src/authService.js', functionName: 'register' },
      { path: 'examples/src/authService.js', functionName: 'verifyPassword' },
      { path: 'examples/src/authService.js', functionName: 'hashPassword' },
      { path: 'examples/src/authService.js', functionName: 'generateToken' }
    ];

    const testCaseCodePaths = [
      'authService.js:login',
      'authService.js:verifyPassword',
      'authService.js:register',
      'userRepository.js:findByUsername'
    ];

    it('should correctly match test case code paths to indexed paths', () => {
      const matchedPaths = testCaseCodePaths.filter(ref => 
        hasMatchingCodePath(ref, indexedCodePaths)
      );
      
      expect(matchedPaths).toContain('authService.js:login');
      expect(matchedPaths).toContain('authService.js:verifyPassword');
      expect(matchedPaths).toContain('authService.js:register');
      expect(matchedPaths).not.toContain('userRepository.js:findByUsername');
      expect(matchedPaths.length).toBe(3);
    });

    it('should detect invalid code links in gap analysis', () => {
      const invalidLinks = testCaseCodePaths.filter(ref => 
        !hasMatchingCodePath(ref, indexedCodePaths)
      );
      
      expect(invalidLinks).toContain('userRepository.js:findByUsername');
      expect(invalidLinks.length).toBe(1);
    });
  });
});
