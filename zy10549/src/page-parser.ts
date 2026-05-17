import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { PageFile } from './types';

export class PageParser {
  private sourceDir: string;

  constructor(sourceDir: string) {
    this.sourceDir = path.resolve(sourceDir);
  }

  async parsePageFile(filePath: string): Promise<PageFile> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath);
    const relativePath = path.relative(this.sourceDir, filePath);

    const pageFile: PageFile = {
      filePath,
      fileName: path.basename(filePath),
      relativePath,
      exportNames: [],
      isComponent: false,
      isPage: this.isPageFile(relativePath),
      imports: []
    };

    if (ext === '.vue') {
      Object.assign(pageFile, this.parseVuePage(content, filePath));
    } else {
      Object.assign(pageFile, this.parseJSPage(content, filePath));
    }

    return pageFile;
  }

  private isPageFile(relativePath: string): boolean {
    const pageDirs = ['pages', 'views', 'page', 'view'];
    return pageDirs.some(dir => 
      relativePath.includes(`/${dir}/`) || 
      relativePath.includes(`\\${dir}\\`) ||
      relativePath.startsWith(`${dir}/`) ||
      relativePath.startsWith(`${dir}\\`)
    );
  }

  private parseVuePage(content: string, filePath: string): Partial<PageFile> {
    const result: Partial<PageFile> = {
      exportNames: [],
      imports: []
    };

    const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    if (scriptMatch) {
      const jsContent = scriptMatch[1];
      const jsResult = this.parseJSPage(jsContent, filePath);
      result.exportNames = jsResult.exportNames;
      result.imports = jsResult.imports;
    }

    result.isComponent = content.includes('<template') || (!!result.exportNames && result.exportNames.length > 0);
    
    return result;
  }

  private parseJSPage(content: string, filePath: string): Partial<PageFile> {
    const result: Partial<PageFile> = {
      exportNames: [],
      imports: []
    };

    try {
      const ast = parse(content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx']
      });

      traverse(ast, {
        ExportDefaultDeclaration: (pathNode) => {
          result.exportNames?.push('default');
        },
        ExportNamedDeclaration: (pathNode) => {
          const decl = pathNode.node.declaration;
          if (decl && decl.type === 'VariableDeclaration') {
            decl.declarations.forEach((d: any) => {
              if (d.id.type === 'Identifier') {
                result.exportNames?.push(d.id.name);
              }
            });
          } else if (decl && decl.type === 'FunctionDeclaration') {
            if (decl.id) {
              result.exportNames?.push(decl.id.name);
            }
          }
        },
        ImportDeclaration: (pathNode) => {
          result.imports?.push(pathNode.node.source.value);
        }
      });
    } catch (error) {
    }

    result.isComponent = !!result.exportNames && result.exportNames.length > 0;

    return result;
  }
}