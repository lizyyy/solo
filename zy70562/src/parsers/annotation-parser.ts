import { AnnotationPlaceholder } from '../types';

export class AnnotationParser {
  private content: string;

  constructor(content: string) {
    this.content = content;
  }

  extractPlaceholders(): AnnotationPlaceholder[] {
    const placeholders: AnnotationPlaceholder[] = [];
    const regex = /\{\{\s*\.([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g;
    
    let match;
    while ((match = regex.exec(this.content)) !== null) {
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
}
