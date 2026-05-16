const fs = require('fs');

const content = `class MatrixBuilder {
  constructor() {
    this.protoErrorCodes = [];
    this.sdkDefinitions = {};
    this.validationErrors = [];
    this.anomalies = [];
    this.warnings = [];
  }

  loadSdkDefinitions(sdkData) {
    if (!sdkData) {
      this.validationErrors.push({
        type: 'missing_sdk_data',
        message: 'SDK definitions data is null or undefined',
        severity: 'error'
      });
      return this;
    }

    if (!sdkData.languages) {
      this.validationErrors.push({
        type: 'missing_languages',
        message: 'SDK definitions missing "languages" field',
        severity: 'warning'
      });
      return this;
    }

    for (const [langId, langData] of Object.entries(sdkData.languages)) {
      if (!langData.name) {
        this.warnings.push({
          type: 'missing_language_name',
          language: langId,
          message: 'Language "' + langId + '" is missing a name field'
        });
      }

      if (!langData.codes) {
        this.warnings.push({
          type: 'missing_error_codes',
          language: langId,
          message: 'Language "' + langId + '" has no error code definitions'
        });
        continue;
      }

      for (const [codeName, codeData] of Object.entries(langData.codes)) {
        if (codeData.grpcCode === undefined) {
          this.anomalies.push({
            type: 'missing_grpc_code',
            language: langId,
            codeName,
            message: 'Error code "' + codeName + '" in "' + langId + '" missing grpcCode field',
            severity: 'warning'
          });
        }

        if (!codeData.retry) {
          this.anomalies.push({
            type: 'missing_retry_policy',
            language: langId,
            codeName,
            message: 'Error code "' + codeName + '" in "' + langId + '" missing retry policy',
            severity: 'warning'
          });
        } else if (!['retriable', 'nonRetriable', 'conditional', 'unknown'].includes(codeData.retry)) {
          this.anomalies.push({
            type: 'invalid_retry_policy',
            language: langId,
            codeName,
            retryValue: codeData.retry,
            message: 'Invalid retry policy "' + codeData.retry + '" for code "' + codeName + '" in "' + langId + '"',
            severity: 'error'
          });
        }
      }
    }

    this.sdkDefinitions = sdkData.languages;
    return this;
  }

  loadProtoErrorCodes(codes) {
    if (!codes || !Array.isArray(codes)) {
      this.validationErrors.push({
        type: 'invalid_proto_codes',
        message: 'Proto error codes must be an array',
        severity: 'error'
      });
      this.protoErrorCodes = [];
      return this;
    }

    const seenCodes = new Map();
    const seenNames = new Map();

    for (const code of codes) {
      if (code.code === undefined) {
        this.anomalies.push({
          type: 'missing_code_value',
          name: code.name,
          message: 'Error code "' + code.name + '" is missing numeric code value',
          lineNumber: code.lineNumber,
          severity: 'error'
        });
      } else {
        if (seenCodes.has(code.code)) {
          this.anomalies.push({
            type: 'duplicate_code_value',
            code: code.code,
            names: [seenCodes.get(code.code), code.name],
            message: 'Duplicate code value ' + code.code + ' used by "' + seenCodes.get(code.code) + '" and "' + code.name + '"',
            lineNumber: code.lineNumber,
            severity: 'error'
          });
        } else {
          seenCodes.set(code.code, code.name);
        }
      }

      if (!code.name) {
        this.anomalies.push({
          type: 'missing_code_name',
          message: 'Error code missing name field',
          lineNumber: code.lineNumber,
          severity: 'error'
        });
      } else {
        if (seenNames.has(code.name)) {
          this.anomalies.push({
            type: 'duplicate_code_name',
            name: code.name,
            message: 'Duplicate code name "' + code.name + '"',
            lineNumber: code.lineNumber,
            severity: 'warning'
          });
        } else {
          seenNames.set(code.name, code.code);
        }
      }
    }

    this.protoErrorCodes = codes;
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
      validationErrors: this.validationErrors,
      anomalies: this.anomalies,
      warnings: this.warnings,
      summary: {}
    };

    for (const code of this.protoErrorCodes) {
      const protoCode = {
        code: code.code,
        name: code.name,
        enumName: code.enumName,
        package: code.package,
        lineNumber: code.lineNumber
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
            retry: 'unknown',
            note: 'Missing from SDK definition'
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
      differencesCount: matrix.differences.length,
      validationErrorsCount: matrix.validationErrors.length,
      anomaliesCount: matrix.anomalies.length,
      warningsCount: matrix.warnings.length
    };
  }
}

module.exports = MatrixBuilder;
`;

fs.writeFileSync('src/matrix-builder.js', content);
console.log('Matrix builder updated successfully');
