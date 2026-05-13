function isCodePathMatch(codePathRef, codePath, options = {}) {
  const { caseSensitive = false } = options;
  
  let ref = codePathRef;
  let cpPath = codePath.path;
  let cpFuncName = codePath.functionName || '';
  
  if (!caseSensitive) {
    ref = ref.toLowerCase();
    cpPath = cpPath.toLowerCase();
    cpFuncName = cpFuncName.toLowerCase();
  }

  const cpFileName = getBasename(cpPath);
  const cpFullRef = cpFuncName ? `${cpPath}:${cpFuncName}` : cpPath;
  const cpFileNameRef = cpFuncName ? `${cpFileName}:${cpFuncName}` : cpFileName;

  if (ref === cpFullRef) return true;
  if (ref === cpFileNameRef) return true;
  if (ref === cpPath) return true;
  if (ref === cpFileName) return true;
  if (cpFuncName && ref === cpFuncName) return true;

  let refPathPart = ref;
  let refFuncPart = '';
  
  if (ref.includes(':')) {
    const parts = ref.split(':');
    refPathPart = parts[0];
    refFuncPart = parts.slice(1).join(':');
  }

  const cpPathParts = cpPath.split(/[\\/]/);
  const refPathParts = refPathPart.split(/[\\/]/);
  
  if (refPathParts.length <= cpPathParts.length && refPathParts.length > 0) {
    const matchFromEnd = refPathParts.every((part, i) => {
      const cpIndex = cpPathParts.length - refPathParts.length + i;
      return part === cpPathParts[cpIndex];
    });
    
    if (matchFromEnd && (!refFuncPart || refFuncPart === cpFuncName)) {
      return true;
    }
  }

  return false;
}

function getBasename(filePath) {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1];
}

describe('Code Path Matching', () => {
  const codePath = {
    path: 'examples/src/authService.js',
    functionName: 'login'
  };

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

describe('Real-world test cases from examples', () => {
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

  it('should match authService.js:login to indexed path', () => {
    const loginCodePath = indexedCodePaths.find(cp => cp.functionName === 'login');
    expect(isCodePathMatch('authService.js:login', loginCodePath)).toBe(true);
  });

  it('should match authService.js:register to indexed path', () => {
    const registerCodePath = indexedCodePaths.find(cp => cp.functionName === 'register');
    expect(isCodePathMatch('authService.js:register', registerCodePath)).toBe(true);
  });

  it('should count 2 matches from 4 test case code paths', () => {
    let matchCount = 0;
    testCaseCodePaths.forEach(ref => {
      indexedCodePaths.forEach(cp => {
        if (isCodePathMatch(ref, cp)) {
          matchCount++;
        }
      });
    });
    expect(matchCount).toBe(2);
  });
});
