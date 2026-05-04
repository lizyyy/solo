import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as vueCompiler from 'vue-template-compiler';
import { ScanConfig } from '../types';
import { defaultConfig } from '../utils';

export interface HardcodedString {
  value: string;
  filePath: string;
  line: number;
  column: number;
  context: string;
}

export interface UsedKey {
  key: string;
  filePath: string;
  line: number;
}

export class SourceScanner {
  private config: ScanConfig;

  constructor(config?: Partial<ScanConfig>) {
    this.config = { ...defaultConfig, ...config };
  }

  async scan(): Promise<{
    hardcodedStrings: HardcodedString[];
    usedKeys: UsedKey[];
    sourceFiles: string[];
  }> {
    const allFiles: string[] = [];
    const hardcodedStrings: HardcodedString[] = [];
    const usedKeys: UsedKey[] = [];

    for (const pattern of this.config.sourcePatterns) {
      const fullPattern = path.join(this.config.projectPath, pattern);
      const files = await glob(fullPattern, {
        ignore: this.config.ignorePatterns.map(p => 
          path.join(this.config.projectPath, p)
        ),
      });
      allFiles.push(...files);
    }

    const uniqueFiles = [...new Set(allFiles)];

    for (const filePath of uniqueFiles) {
      if (filePath.endsWith('.vue')) {
        const result = this.scanVueFile(filePath);
        hardcodedStrings.push(...result.hardcodedStrings);
        usedKeys.push(...result.usedKeys);
      } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || 
                 filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
        const result = this.scanJsTsFile(filePath);
        hardcodedStrings.push(...result.hardcodedStrings);
        usedKeys.push(...result.usedKeys);
      }
    }

    return {
      hardcodedStrings,
      usedKeys,
      sourceFiles: uniqueFiles,
    };
  }

  private scanJsTsFile(filePath: string): {
    hardcodedStrings: HardcodedString[];
    usedKeys: UsedKey[];
  } {
    const hardcodedStrings: HardcodedString[] = [];
    const usedKeys: UsedKey[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      const ast = parser.parse(content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      });

      traverse(ast, {
        StringLiteral: (path) => {
          const value = path.node.value;
          const hasChinese = /[\u4e00-\u9fa5]/.test(value);
          
          if (hasChinese) {
            const line = path.node.loc?.start.line || 1;
            const column = path.node.loc?.start.column || 0;
            const context = this.getContext(lines, line - 1, column);
            
            hardcodedStrings.push({
              value,
              filePath,
              line,
              column,
              context,
            });
          }
        },
        TemplateLiteral: (path) => {
          for (const quasi of path.node.quasis) {
            const value = quasi.value.raw;
            const hasChinese = /[\u4e00-\u9fa5]/.test(value);
            
            if (hasChinese) {
              const line = quasi.loc?.start.line || 1;
              const column = quasi.loc?.start.column || 0;
              const context = this.getContext(lines, line - 1, column);
              
              hardcodedStrings.push({
                value,
                filePath,
                line,
                column,
                context,
              });
            }
          }
        },
        JSXText: (path) => {
          const value = path.node.value.trim();
          const hasChinese = /[\u4e00-\u9fa5]/.test(value);
          
          if (hasChinese && value.length > 0) {
            const line = path.node.loc?.start.line || 1;
            const column = path.node.loc?.start.column || 0;
            const context = this.getContext(lines, line - 1, column);
            
            hardcodedStrings.push({
              value,
              filePath,
              line,
              column,
              context,
            });
          }
        },
        CallExpression: (path) => {
          const callee = path.node.callee;
          const isI18nCall = this.isI18nCall(callee);
          
          if (isI18nCall && path.node.arguments.length > 0) {
            const firstArg = path.node.arguments[0];
            if (firstArg.type === 'StringLiteral') {
              const line = firstArg.loc?.start.line || 1;
              usedKeys.push({
                key: firstArg.value,
                filePath,
                line,
              });
            }
          }
        },
      });
    } catch (error) {
      console.error(`Failed to parse file: ${filePath}`, error);
    }

    return { hardcodedStrings, usedKeys };
  }

  private scanVueFile(filePath: string): {
    hardcodedStrings: HardcodedString[];
    usedKeys: UsedKey[];
  } {
    const hardcodedStrings: HardcodedString[] = [];
    const usedKeys: UsedKey[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      const parsed = vueCompiler.parseComponent(content);
      
      if (parsed.template) {
        const templateContent = parsed.template.content;
        const templateOffset = parsed.template.start;
        const templateStartLine = this.getLineNumber(content, templateOffset);
        
        const stringMatches = templateContent.match(/['"]([^'"]*[\u4e00-\u9fa5][^'"]*)['"]/g);
        if (stringMatches) {
          for (const match of stringMatches) {
            const value = match.slice(1, -1);
            const index = templateContent.indexOf(match);
            const line = templateStartLine + this.getLineNumber(templateContent, index) - 1;
            const column = this.getColumn(templateContent, index);
            const context = this.getContext(lines, line - 1, column);
            
            hardcodedStrings.push({
              value,
              filePath,
              line,
              column,
              context,
            });
          }
        }

        const templateTextRegex = />([^<]*[\u4e00-\u9fa5][^<]*)</g;
        let textMatch;
        while ((textMatch = templateTextRegex.exec(templateContent)) !== null) {
          const value = textMatch[1].trim();
          if (value) {
            const index = textMatch.index + 1;
            const line = templateStartLine + this.getLineNumber(templateContent, index) - 1;
            const column = this.getColumn(templateContent, index);
            const context = this.getContext(lines, line - 1, column);
            
            hardcodedStrings.push({
              value,
              filePath,
              line,
              column,
              context,
            });
          }
        }

        const i18nKeyRegex = /\$t\(['"]([^'"]+)['"]/g;
        let keyMatch;
        while ((keyMatch = i18nKeyRegex.exec(templateContent)) !== null) {
          const index = keyMatch.index;
          const line = templateStartLine + this.getLineNumber(templateContent, index) - 1;
          usedKeys.push({
            key: keyMatch[1],
            filePath,
            line,
          });
        }
      }
      
      if (parsed.script) {
        const scriptContent = parsed.script.content;
        const scriptOffset = parsed.script.start;
        const scriptStartLine = this.getLineNumber(content, scriptOffset);
        
        const tempFilePath = filePath + '.temp.ts';
        fs.writeFileSync(tempFilePath, scriptContent);
        
        const result = this.scanJsTsFile(tempFilePath);
        
        for (const hs of result.hardcodedStrings) {
          hardcodedStrings.push({
            ...hs,
            filePath,
            line: hs.line + scriptStartLine - 1,
          });
        }
        
        for (const uk of result.usedKeys) {
          usedKeys.push({
            ...uk,
            filePath,
            line: uk.line + scriptStartLine - 1,
          });
        }
        
        fs.unlinkSync(tempFilePath);
      }
    } catch (error) {
      console.error(`Failed to parse Vue file: ${filePath}`, error);
    }

    return { hardcodedStrings, usedKeys };
  }

  private isI18nCall(callee: any): boolean {
    const funcNames = this.config.i18nFunctionNames;
    
    if (callee.type === 'Identifier') {
      return funcNames.includes(callee.name);
    }
    
    if (callee.type === 'MemberExpression') {
      let fullName = '';
      let current: any = callee;
      
      while (current) {
        if (current.property?.name) {
          fullName = fullName ? `${current.property.name}.${fullName}` : current.property.name;
        }
        if (current.object?.name) {
          fullName = fullName ? `${current.object.name}.${fullName}` : current.object.name;
          break;
        }
        current = current.object;
      }
      
      return funcNames.some(name => fullName.includes(name));
    }
    
    return false;
  }

  private getContext(lines: string[], lineIndex: number, column: number): string {
    const start = Math.max(0, lineIndex - 2);
    const end = Math.min(lines.length, lineIndex + 3);
    return lines.slice(start, end).join('\n');
  }

  private getLineNumber(content: string, offset: number): number {
    return content.substring(0, offset).split('\n').length;
  }

  private getColumn(content: string, offset: number): number {
    const lines = content.substring(0, offset).split('\n');
    return lines[lines.length - 1].length;
  }
}
