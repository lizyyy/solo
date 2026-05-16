const path = require('path');
const DotenvParser = require('../parsers/dotenv-parser');
const ShellParser = require('../parsers/shell-parser');
const ComposeParser = require('../parsers/compose-parser');

class VariableEngine {
  constructor() {
    this.parsers = [
      new DotenvParser(),
      new ShellParser(),
      new ComposeParser()
    ];
    this.results = [];
    this.errors = [];
  }

  scanDirectory(dirPath) {
    const fs = require('fs');
    const files = [];

    const scan = (currentPath) => {
      const items = fs.readdirSync(currentPath);
      items.forEach(item => {
        const fullPath = path.join(currentPath, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scan(fullPath);
        } else if (stat.isFile()) {
          files.push(fullPath);
        }
      });
    };

    try {
      scan(dirPath);
    } catch (error) {
      throw new Error(`目录扫描失败: ${error.message}`);
    }

    return files;
  }

  parseFiles(filePaths) {
    this.results = [];
    this.errors = [];

    filePaths.forEach(filePath => {
      const parser = this.parsers.find(p => p.canParse(filePath));
      if (parser) {
        const result = parser.parse(filePath);
        this.results.push(result);
        this.errors.push(...result.errors);
      }
    });

    return this.results;
  }

  calculatePriority() {
    const allVariables = [];

    this.results.forEach(result => {
      result.variables.forEach(variable => {
        allVariables.push({
          ...variable,
          basePriority: variable.priority
        });
      });
    });

    const sourceOrder = {};
    allVariables.forEach((v, index) => {
      if (!sourceOrder[v.source]) {
        sourceOrder[v.source] = index;
      }
    });

    allVariables.forEach(v => {
      v.effectivePriority = v.basePriority * 1000 + sourceOrder[v.source];
    });

    return allVariables;
  }

  buildOverrideChain() {
    const allVariables = this.calculatePriority();
    const variableMap = new Map();

    allVariables.forEach(variable => {
      if (!variableMap.has(variable.name)) {
        variableMap.set(variable.name, []);
      }
      variableMap.get(variable.name).push(variable);
    });

    const result = [];
    variableMap.forEach((definitions, name) => {
      definitions.sort((a, b) => b.effectivePriority - a.effectivePriority);

      const winner = definitions[0];
      const chain = definitions.slice(1).map((def, index) => ({
        order: index + 1,
        overriddenBy: definitions[index],
        definition: def
      }));

      result.push({
        name,
        finalValue: winner.value,
        winner: {
          ...winner,
          isWinner: true
        },
        definitions,
        overrideChain: chain,
        isOverridden: definitions.length > 1,
        overrideCount: definitions.length - 1
      });
    });

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  getStatistics() {
    const variables = this.buildOverrideChain();
    const totalDefinitions = variables.reduce((sum, v) => sum + v.definitions.length, 0);
    const overriddenCount = variables.filter(v => v.isOverridden).length;
    const sourceFiles = new Set();

    this.results.forEach(r => {
      sourceFiles.add(r.source);
    });

    return {
      totalVariables: variables.length,
      totalDefinitions,
      overriddenCount,
      uniqueSources: sourceFiles.size,
      errorCount: this.errors.length,
      noOverrides: variables.length - overriddenCount
    };
  }

  getFullReport() {
    return {
      generatedAt: new Date().toISOString(),
      inputDirectory: this.inputDirectory || null,
      statistics: this.getStatistics(),
      sources: this.results.map(r => ({
        path: r.source,
        type: r.type,
        variableCount: r.variables.length
      })),
      variables: this.buildOverrideChain(),
      errors: this.errors
    };
  }

  processDirectory(dirPath) {
    this.inputDirectory = path.resolve(dirPath);
    const files = this.scanDirectory(dirPath);
    this.parseFiles(files);
    return this.getFullReport();
  }
}

module.exports = VariableEngine;
