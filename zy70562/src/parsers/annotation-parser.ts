import { AnnotationPlaceholder } from '../types';

export class AnnotationParser {
  private content: string;

  constructor(content: string) {
    this.content = content;
  }

  extractPlaceholders(): AnnotationPlaceholder[] {
    const placeholders: AnnotationPlaceholder[] = [];
    
    const dotSyntaxRegex = /\{\{\s*\.([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g;
    let match;
    while ((match = dotSyntaxRegex.exec(this.content)) !== null) {
      placeholders.push({
        name: match[1],
        fullMatch: match[0]
      });
    }
    
    const dollarSyntaxRegex = /\{\{\s*\$([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g;
    while ((match = dollarSyntaxRegex.exec(this.content)) !== null) {
      placeholders.push({
        name: match[1],
        fullMatch: match[0]
      });
    }

    return placeholders;
  }

  getAllPlaceholders(): string[] {
    const templatePlaceholders = this.extractPlaceholders().map(p => p.name);
    return [...new Set(templatePlaceholders)];
  }

  extractLabelNames(): string[] {
    const placeholders = this.extractPlaceholders();
    const labelNames: string[] = [];
    
    for (const placeholder of placeholders) {
      if (placeholder.name.startsWith('labels.')) {
        labelNames.push(placeholder.name.replace('labels.', ''));
      }
    }
    
    return [...new Set(labelNames)];
  }

  hasValuePlaceholder(): boolean {
    const placeholders = this.extractPlaceholders();
    return placeholders.some(p => p.name === 'value');
  }
}
