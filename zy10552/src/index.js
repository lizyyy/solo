const fs = require('fs');
const path = require('path');
const { OpenAPIParser } = require('./parser');
const { RoleExtractor } = require('./roles');
const { MatrixGenerator } = require('./matrix');
const { ReportGenerator } = require('./report');
const { MissingDetector } = require('./detector');
const { Deduplicator } = require('./deduplicator');
const { ErrorCollector } = require('./errors');

class PermissionMatrixGenerator {
  constructor(options = {}) {
    this.options = {
      inputDir: options.inputDir || './openapi',
      outputDir: options.outputDir || './output',
      roles: options.roles || [],
      strict: options.strict || false,
      clean: options.clean !== false
    };
    
    this.parser = new OpenAPIParser();
    this.roleExtractor = new RoleExtractor();
    this.matrixGenerator = new MatrixGenerator();
    this.reportGenerator = new ReportGenerator();
    this.missingDetector = new MissingDetector();
    this.deduplicator = new Deduplicator();
    this.errorCollector = new ErrorCollector();
  }

  async generate() {
    this._prepareOutputDir();
    
    const files = this._findOpenAPIFiles();
    const allEndpoints = [];
    
    for (const file of files) {
      try {
        const spec = await this.parser.parse(file);
        const endpoints = this.parser.extractEndpoints(spec, file);
        allEndpoints.push(...endpoints);
      } catch (error) {
        this.errorCollector.add({
          type: 'file_parse_error',
          file: file,
          message: error.message,
          location: file
        });
      }
    }
    
    const { endpoints: deduplicatedEndpoints, duplicates } = 
      this.deduplicator.deduplicate(allEndpoints);
    
    const roles = this.roleExtractor.extractRoles(deduplicatedEndpoints, this.options.roles);
    
    const matrix = this.matrixGenerator.generate(deduplicatedEndpoints, roles);
    
    const missing = this.missingDetector.detect(deduplicatedEndpoints, roles);
    
    const errors = this.errorCollector.getErrors();
    
    await this._writeOutputs({
      endpoints: deduplicatedEndpoints,
      roles,
      matrix,
      missing,
      duplicates,
      errors
    });
    
    const exitCode = this._calculateExitCode(missing, errors);
    
    return { exitCode, matrix, missing, errors };
  }

  _prepareOutputDir() {
    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    } else if (this.options.clean) {
      const files = fs.readdirSync(this.options.outputDir);
      for (const file of files) {
        const filePath = path.join(this.options.outputDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      }
    }
  }

  _findOpenAPIFiles() {
    const files = [];
    const scanDir = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && /\.(yaml|yml|json)$/i.test(entry.name)) {
          files.push(fullPath);
        }
      }
    };
    scanDir(this.options.inputDir);
    return files;
  }

  async _writeOutputs(data) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    const jsonResult = {
      generatedAt: new Date().toISOString(),
      inputDir: this.options.inputDir,
      summary: {
        totalEndpoints: data.endpoints.length,
        totalRoles: data.roles.length,
        missingCount: data.missing.length,
        errorCount: data.errors.length,
        duplicateCount: data.duplicates.length
      },
      endpoints: data.endpoints,
      roles: data.roles,
      matrix: data.matrix,
      missing: data.missing,
      duplicates: data.duplicates,
      errors: data.errors,
      deduplicationNote: '去重口径: 按[method + path]组合去重，保留首次出现的定义'
    };
    
    const jsonPath = path.join(this.options.outputDir, `permission-matrix-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonResult, null, 2));
    
    const latestJsonPath = path.join(this.options.outputDir, 'permission-matrix-latest.json');
    fs.writeFileSync(latestJsonPath, JSON.stringify(jsonResult, null, 2));
    
    const markdownReport = this.reportGenerator.generateMarkdown(jsonResult);
    const mdPath = path.join(this.options.outputDir, `permission-matrix-${timestamp}.md`);
    fs.writeFileSync(mdPath, markdownReport);
    
    const latestMdPath = path.join(this.options.outputDir, 'permission-matrix-latest.md');
    fs.writeFileSync(latestMdPath, markdownReport);
    
    this.reportGenerator.printSummary(jsonResult);
  }

  _calculateExitCode(missing, errors) {
    if (errors.length > 0) {
      return 2;
    }
    if (this.options.strict && missing.length > 0) {
      return 1;
    }
    return 0;
  }
}

module.exports = {
  PermissionMatrixGenerator
};
