import { FileScanner } from './file-scanner.js';
import { DependencyParser } from './dependency-parser.js';
import { ReportGenerator } from './report-generator.js';

export class BinaryDependencyScanner {
  constructor(options = {}) {
    this.scanner = new FileScanner(options.scanner);
    this.parser = new DependencyParser(options.parser);
    this.generator = new ReportGenerator(options.generator);
  }

  async scanDirectory(dirPath, options = {}) {
    const scanResults = await this.scanner.scanDirectory(dirPath);
    
    const parsedDeps = [];
    for (const binary of scanResults.binaries) {
      const deps = await this.parser.parseDependencies(binary);
      parsedDeps.push(deps);
    }

    const reports = this.generator.generate(scanResults, parsedDeps);
    
    if (options.writeReports) {
      await this.generator.writeReports(reports);
    }

    return {
      scanResults,
      parsedDeps,
      reports
    };
  }

  async scanFile(filePath, options = {}) {
    const fileInfo = await this.scanner.analyzeFile(filePath);
    
    if (!fileInfo.isBinary) {
      throw new Error('Not a binary file');
    }

    const parsedDeps = await this.parser.parseDependencies(fileInfo);
    
    return {
      fileInfo,
      parsedDeps
    };
  }
}

export { FileScanner, DependencyParser, ReportGenerator };
