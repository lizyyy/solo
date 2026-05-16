import { LabelExtraction } from '../types';

export class PromQLParser {
  private expr: string;

  constructor(expr: string) {
    this.expr = expr;
  }

  parse(): LabelExtraction {
    const result: LabelExtraction = {
      metricName: '',
      labels: [],
      aggregationLabels: [],
      byLabels: [],
      withoutLabels: []
    };

    const aggregationMatch = this.expr.match(/^(sum|avg|count|min|max|stddev|stdvar|topk|bottomk|quantile)\s*(by|without)?\s*(\([^)]+\))?\s*/i);
    if (aggregationMatch) {
      const aggType = aggregationMatch[1];
      const byWithout = aggregationMatch[2];
      const labelsStr = aggregationMatch[3];
      
      result.aggregationLabels = [aggType];
      
      if (labelsStr) {
        const labels = this.extractLabelNames(labelsStr);
        if (byWithout?.toLowerCase() === 'by') {
          result.byLabels = labels;
        } else if (byWithout?.toLowerCase() === 'without') {
          result.withoutLabels = labels;
        }
      }
    }

    const metricMatch = this.expr.match(/([a-zA-Z_:][a-zA-Z0-9_:]*)\s*\{/);
    if (metricMatch) {
      result.metricName = metricMatch[1];
    } else {
      const simpleMetricMatch = this.expr.match(/([a-zA-Z_:][a-zA-Z0-9_:]*)(\s*$|\s*[=!<>]|\s*\+|\s*\-|\s*\*|\s*\/)/);
      if (simpleMetricMatch) {
        result.metricName = simpleMetricMatch[1];
      }
    }

    const labelMatches = this.expr.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*(=~|=|!=|!~)\s*["']/g);
    for (const match of labelMatches) {
      const labelName = match[1];
      if (!result.labels.includes(labelName) && 
          labelName !== result.metricName &&
          !['sum', 'avg', 'count', 'min', 'max', 'stddev', 'stdvar', 'topk', 'bottomk', 'quantile'].includes(labelName)) {
        result.labels.push(labelName);
      }
    }

    result.labels = [...new Set(result.labels)];
    result.byLabels = [...new Set(result.byLabels)];
    result.withoutLabels = [...new Set(result.withoutLabels)];

    return result;
  }

  private extractLabelNames(labelsStr: string): string[] {
    const matches = labelsStr.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)/g);
    return [...matches].map(m => m[1]).filter(n => n);
  }

  validateSyntax(): { valid: boolean; error?: string } {
    try {
      let depth = 0;
      let inString = false;
      let stringChar = '';
      
      for (let i = 0; i < this.expr.length; i++) {
        const char = this.expr[i];
        
        if ((char === '"' || char === "'") && (i === 0 || this.expr[i - 1] !== '\\')) {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
          }
        }
        
        if (!inString) {
          if (char === '(' || char === '{') depth++;
          if (char === ')' || char === '}') depth--;
        }
      }
      
      if (depth !== 0) {
        return { valid: false, error: 'Unbalanced parentheses or braces' };
      }
      
      if (inString) {
        return { valid: false, error: 'Unclosed string' };
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  getAvailableLabels(): string[] {
    const parsed = this.parse();
    const allLabels = [...parsed.labels, ...(parsed.byLabels || [])];
    const result = allLabels.filter(l => !(parsed.withoutLabels || []).includes(l));
    return [...new Set(result)];
  }
}
