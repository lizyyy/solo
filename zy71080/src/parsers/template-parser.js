const path = require('path');
const fs = require('fs');

const VARIABLE_PATTERN = /\{\{\s*([^{}|]+?)(?:\s*\|\s*default:\s*["']([^"']+)["'])?\s*\}\}/g;
const IF_BLOCK_PATTERN = /\{%\s*if\s+([^%]+?)\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g;
const ELSE_PATTERN = /\{%\s*else\s*%\}/;

class TemplateParser {
  constructor(options = {}) {
    this.caseSensitive = options.caseSensitive !== false;
    this.includeConditionals = options.includeConditionals !== false;
    this.variables = new Map();
    this.conditionalVariables = new Set();
    this.blocks = [];
  }

  parse(templateContent, templatePath = '') {
    this.templatePath = templatePath;
    this.templateContent = templateContent;
    this.variables.clear();
    this.conditionalVariables.clear();
    this.blocks = [];

    this._parseConditionals(templateContent);
    this._parseVariables(templateContent);

    return {
      variables: Array.from(this.variables.values()),
      conditionalVariables: Array.from(this.conditionalVariables),
      blocks: this.blocks
    };
  }

  _parseConditionals(content) {
    let match;
    let blockIndex = 0;

    const ifPattern = new RegExp(IF_BLOCK_PATTERN.source, 'g');

    while ((match = ifPattern.exec(content)) !== null) {
      const condition = match[1].trim();
      const blockContent = match[2];
      const startPos = match.index;
      const endPos = startPos + match[0].length;

      const hasElse = ELSE_PATTERN.test(blockContent);
      const [ifContent, elseContent] = hasElse
        ? blockContent.split(ELSE_PATTERN)
        : [blockContent, ''];

      const block = {
        id: `block_${blockIndex++}`,
        condition,
        hasElse,
        ifContent,
        elseContent,
        startPos,
        endPos,
        variablesInCondition: this._extractVariablesFromCondition(condition),
        variablesInIf: this._extractVariableNames(ifContent),
        variablesInElse: this._extractVariableNames(elseContent)
      };

      this.blocks.push(block);

      block.variablesInCondition.forEach(v => this.conditionalVariables.add(v));
    }
  }

  _extractVariablesFromCondition(condition) {
    const varPattern = /\b([a-zA-Z_][a-zA-Z0-9_.]*)\b/g;
    const operators = new Set(['and', 'or', 'not', 'true', 'false', 'null', 'defined']);
    const variables = [];
    let match;

    while ((match = varPattern.exec(condition)) !== null) {
      const name = match[1];
      if (!operators.has(name) && !/^\d+$/.test(name)) {
        variables.push(this._normalizeName(name));
      }
    }

    return [...new Set(variables)];
  }

  _extractVariableNames(content) {
    const variables = [];
    let match;
    const pattern = new RegExp(VARIABLE_PATTERN.source, 'g');

    while ((match = pattern.exec(content)) !== null) {
      variables.push(this._normalizeName(match[1].trim()));
    }

    return [...new Set(variables)];
  }

  _parseVariables(content) {
    let match;
    const pattern = new RegExp(VARIABLE_PATTERN.source, 'g');

    while ((match = pattern.exec(content)) !== null) {
      const rawName = match[1].trim();
      const name = this._normalizeName(rawName);
      const defaultValue = match[2] || null;
      const lineNumber = this._getLineNumber(content, match.index);

      if (!this.variables.has(name)) {
        this.variables.set(name, {
          name,
          rawName,
          defaultValue,
          hasDefault: defaultValue !== null,
          occurrences: [],
          caseVariations: new Set([rawName])
        });
      } else {
        const existing = this.variables.get(name);
        existing.caseVariations.add(rawName);
        if (defaultValue && !existing.defaultValue) {
          existing.defaultValue = defaultValue;
          existing.hasDefault = true;
        }
      }

      this.variables.get(name).occurrences.push({
        position: match.index,
        line: lineNumber,
        rawName,
        defaultValue,
        context: this._getContext(content, match.index)
      });
    }

    this.variables.forEach((variable) => {
      variable.caseVariations = Array.from(variable.caseVariations);
      variable.hasCaseInconsistency = variable.caseVariations.length > 1;
    });
  }

  _normalizeName(name) {
    return this.caseSensitive ? name : name.toLowerCase();
  }

  _getLineNumber(content, position) {
    return content.substring(0, position).split('\n').length;
  }

  _getContext(content, position) {
    const start = Math.max(0, position - 50);
    const end = Math.min(content.length, position + 50);
    return content.substring(start, end).replace(/\n/g, ' ').trim();
  }

  static parseFile(filePath, options = {}) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parser = new TemplateParser(options);
    return parser.parse(content, filePath);
  }
}

module.exports = { TemplateParser };
