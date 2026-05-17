class MatrixBuilder {
  constructor() {
    this.protoErrorCodes = [];
    this.sdkDefinitions = {};
    this.validationIssues = [];
    this.malformedLines = [];
  }

  loadSdkDefinitions(sdkData) {
    if (sdkData && sdkData.languages) {
      this.sdkDefinitions = sdkData.languages;
    }
    return this;
  }

  loadProtoErrorCodes(codes, parseResult = null) {
    this.protoErrorCodes = codes || [];
    if (parseResult) {
      this.validationIssues = parseResult.validationIssues || [];
      this.malformedLines = parseResult.malformedLines || [];
    }
    return this;
  }

  buildMatrix() {
    const matrix = {
      timestamp: Date.now(),
      protoCodes: [],
      sdkMappings: {},
      categories: {
        safeRetry: [],
        neverRetry: [],
        controversial: []
      },
      differences: [],
      validationIssues: this.validationIssues,
      malformedLines: this.malformedLines,
      summary: {}
    };

    for (const code of this.protoErrorCodes) {
      const protoCode = {
        code: code.code,
        name: code.name,
        enumName: code.enumName,
        package: code.package
      };
      matrix.protoCodes.push(protoCode);

      for (const [lang, langData] of Object.entries(this.sdkDefinitions)) {
        if (!matrix.sdkMappings[lang]) {
          matrix.sdkMappings[lang] = {
            name: langData.name,
            codes: {}
          };
        }

        const sdkCodeData = langData.codes[code.name];
        if (sdkCodeData) {
          matrix.sdkMappings[lang].codes[code.name] = {
            ...sdkCodeData,
            exists: true
          };
        } else {
          matrix.sdkMappings[lang].codes[code.name] = {
            exists: false,
            grpcCode: code.code,
            retry: 'unknown'
          };
        }
      }
    }

    this.classifyRetriable(matrix);
    this.detectDifferences(matrix);
    this.calculateSummary(matrix);

    return matrix;
  }

  classifyRetriable(matrix) {
    for (const protoCode of matrix.protoCodes) {
      const codeName = protoCode.name;
      const retryValues = [];

      for (const [lang, langData] of Object.entries(matrix.sdkMappings)) {
        const codeData = langData.codes[codeName];
        if (codeData && codeData.exists) {
          retryValues.push({
            lang,
            retry: codeData.retry
          });
        }
      }

      const category = this.determineCategory(retryValues);
      const codeInfo = {
        code: protoCode.code,
        name: codeName,
        retryValues: retryValues
      };

      if (category === 'safeRetry') {
        matrix.categories.safeRetry.push(codeInfo);
      } else if (category === 'neverRetry') {
        matrix.categories.neverRetry.push(codeInfo);
      } else {
        matrix.categories.controversial.push(codeInfo);
      }
    }
  }

  determineCategory(retryValues) {
    if (retryValues.length === 0) {
      return 'controversial';
    }

    const allRetriable = retryValues.every(v => v.retry === 'retriable');
    const allNonRetriable = retryValues.every(v => v.retry === 'nonRetriable');

    if (allRetriable) {
      return 'safeRetry';
    } else if (allNonRetriable) {
      return 'neverRetry';
    } else {
      return 'controversial';
    }
  }

  detectDifferences(matrix) {
    const languages = Object.keys(matrix.sdkMappings);

    for (const protoCode of matrix.protoCodes) {
      const codeName = protoCode.name;
      const codeMappings = [];

      for (const lang of languages) {
        const codeData = matrix.sdkMappings[lang].codes[codeName];
        if (codeData && codeData.exists) {
          codeMappings.push({
            lang,
            grpcCode: codeData.grpcCode,
            retry: codeData.retry
          });
        }
      }

      if (codeMappings.length > 1) {
        const baseGrpcCode = codeMappings[0].grpcCode;
        const baseRetry = codeMappings[0].retry;

        for (let i = 1; i < codeMappings.length; i++) {
          const mapping = codeMappings[i];
          if (mapping.grpcCode !== baseGrpcCode || mapping.retry !== baseRetry) {
            matrix.differences.push({
              code: protoCode.code,
              name: codeName,
              type: mapping.grpcCode !== baseGrpcCode ? 'code_mismatch' : 'retry_mismatch',
              mappings: codeMappings
            });
            break;
          }
        }
      }
    }
  }

  calculateSummary(matrix) {
    const totalCodes = matrix.protoCodes.length;
    const langCount = Object.keys(matrix.sdkMappings).length;

    matrix.summary = {
      totalCodes,
      languages: langCount,
      safeRetryCount: matrix.categories.safeRetry.length,
      neverRetryCount: matrix.categories.neverRetry.length,
      controversialCount: matrix.categories.controversial.length,
      differencesCount: matrix.differences.length
    };
  }
}

module.exports = MatrixBuilder;
