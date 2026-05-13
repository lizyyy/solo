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

function findMatchingCodePaths(codePathRef, codePaths, options = {}) {
  return codePaths.filter(cp => isCodePathMatch(codePathRef, cp, options));
}

function hasMatchingCodePath(codePathRef, codePaths, options = {}) {
  return codePaths.some(cp => isCodePathMatch(codePathRef, cp, options));
}

module.exports = {
  isCodePathMatch,
  findMatchingCodePaths,
  hasMatchingCodePath,
  getBasename
};
