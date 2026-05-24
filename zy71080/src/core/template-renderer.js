class TemplateRenderer {
  constructor(options = {}) {
    this.caseSensitive = options.caseSensitive !== false;
    this.strictMode = options.strictMode || false;
  }

  render(templateContent, data = {}) {
    const errors = [];
    const warnings = [];

    let result = this._renderConditionals(templateContent, data, errors, warnings);
    result = this._renderVariables(result, data, errors, warnings);

    return {
      content: result,
      errors,
      warnings,
      hasErrors: errors.length > 0,
      hasWarnings: warnings.length > 0
    };
  }

  _renderConditionals(content, data, errors, warnings) {
    const IF_BLOCK_PATTERN = /\{%\s*if\s+([^%]+?)\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g;
    const ELSE_PATTERN = /\{%\s*else\s*%\}/;

    return content.replace(IF_BLOCK_PATTERN, (match, condition, blockContent) => {
      const conditionResult = this._evaluateCondition(condition, data, errors, warnings);

      const hasElse = ELSE_PATTERN.test(blockContent);
      const [ifContent, elseContent] = hasElse
        ? blockContent.split(ELSE_PATTERN)
        : [blockContent, ''];

      return conditionResult ? ifContent : elseContent;
    });
  }

  _evaluateCondition(condition, data, errors, warnings) {
    const tokens = condition
      .replace(/\b(and)\b/g, '&&')
      .replace(/\b(or)\b/g, '||')
      .replace(/\b(not)\b/g, '!')
      .trim();

    try {
      const vars = this._extractVariablesFromExpression(tokens);
      const context = {};

      vars.forEach(varName => {
        const value = this._getNestedValue(data, varName);
        context[varName.replace(/\./g, '_')] = value !== undefined;
      });

      const evalExpr = tokens.replace(/\b([a-zA-Z_][a-zA-Z0-9_.]*)\b/g, (match) => {
        if (['&&', '||', '!', 'true', 'false', 'defined'].includes(match)) {
          return match;
        }
        const value = this._getNestedValue(data, match);
        return value !== undefined ? JSON.stringify(Boolean(value)) : 'false';
      });

      return new Function(`return ${evalExpr}`)();
    } catch (e) {
      warnings.push({
        type: 'condition_eval_error',
        message: `条件表达式求值失败: ${condition}`,
        error: e.message
      });
      return false;
    }
  }

  _extractVariablesFromExpression(expr) {
    const varPattern = /\b([a-zA-Z_][a-zA-Z0-9_.]*)\b/g;
    const operators = new Set(['&&', '||', '!', 'true', 'false', 'defined', 'and', 'or', 'not']);
    const variables = [];
    let match;

    while ((match = varPattern.exec(expr)) !== null) {
      if (!operators.has(match[1])) {
        variables.push(match[1]);
      }
    }

    return [...new Set(variables)];
  }

  _renderVariables(content, data, errors, warnings) {
    const VARIABLE_PATTERN = /\{\{\s*([^{}|]+?)(?:\s*\|\s*default:\s*["']([^"']+)["'])?\s*\}\}/g;

    return content.replace(VARIABLE_PATTERN, (match, varName, defaultValue) => {
      varName = varName.trim();
      const value = this._getNestedValue(data, varName);

      if (value === undefined) {
        if (defaultValue !== undefined) {
          warnings.push({
            type: 'default_used',
            variable: varName,
            message: `变量 "${varName}" 未提供，使用默认值`
          });
          return defaultValue;
        } else {
          if (this.strictMode) {
            errors.push({
              type: 'missing_variable',
              variable: varName,
              message: `变量 "${varName}" 缺失且无默认值`
            });
          } else {
            warnings.push({
              type: 'missing_variable',
              variable: varName,
              message: `变量 "${varName}" 缺失且无默认值`
            });
          }
          return match;
        }
      }

      return String(value);
    });
  }

  _getNestedValue(data, path) {
    const normalizedPath = this.caseSensitive
      ? path
      : path.toLowerCase();

    const keys = normalizedPath.split('.');
    let current = data;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (this.caseSensitive) {
        current = current[key];
      } else {
        const foundKey = Object.keys(current).find(
          k => k.toLowerCase() === key
        );
        current = foundKey ? current[foundKey] : undefined;
      }
    }

    return current;
  }
}

module.exports = { TemplateRenderer };
