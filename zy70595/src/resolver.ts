import * as fs from 'fs';
import * as path from 'path';
import { TsConfig, TsConfigPaths, ResolutionResult } from './types';
import JSON5 from 'json5';

export class PathResolver {
  private baseUrl: string;
  private paths: TsConfigPaths;
  private projectRoot: string;

  constructor(tsconfigPath: string) {
    const tsconfig = this.loadTsConfig(tsconfigPath);
    this.projectRoot = path.dirname(tsconfigPath);
    this.baseUrl = tsconfig.compilerOptions?.baseUrl || '.';
    this.paths = tsconfig.compilerOptions?.paths || {};
  }

  private loadTsConfig(tsconfigPath: string): TsConfig {
    if (!fs.existsSync(tsconfigPath)) {
      throw new Error(`tsconfig.json not found at: ${tsconfigPath}`);
    }
    const content = fs.readFileSync(tsconfigPath, 'utf-8');
    return JSON5.parse(content);
  }

  resolve(importPath: string, sourceFile?: string): ResolutionResult {
    const result: ResolutionResult = {
      originalPath: importPath,
      resolvedPath: importPath,
      fileExists: false,
    };

    if (importPath.startsWith('.') || importPath.startsWith('/')) {
      result.resolvedPath = this.resolveRelativePath(importPath, sourceFile);
      result.fileExists = this.checkFileExists(result.resolvedPath);
      return result;
    }

    const matchedAlias = this.findMatchingAlias(importPath);
    if (matchedAlias) {
      result.matchedAlias = matchedAlias;
      result.resolvedPath = this.applyAlias(importPath, matchedAlias);
      result.fileExists = this.checkFileExists(result.resolvedPath);
    } else {
      result.error = `No matching alias found for: ${importPath}`;
      result.fileExists = false;
    }

    return result;
  }

  private findMatchingAlias(importPath: string): string | undefined {
    const aliases = Object.keys(this.paths).sort((a, b) => b.length - a.length);
    
    for (const alias of aliases) {
      const aliasPattern = alias.replace('*', '');
      if (alias.includes('*')) {
        if (importPath.startsWith(aliasPattern)) {
          return alias;
        }
      } else {
        if (importPath === alias || importPath.startsWith(alias + '/')) {
          return alias;
        }
      }
    }
    
    return undefined;
  }

  private applyAlias(importPath: string, alias: string): string {
    const aliasPaths = this.paths[alias];
    if (!aliasPaths || aliasPaths.length === 0) {
      return importPath;
    }

    const targetPath = aliasPaths[0];
    let resolvedPath: string;

    if (alias.includes('*')) {
      const aliasPrefix = alias.replace('*', '');
      const wildcardPart = importPath.slice(aliasPrefix.length);
      resolvedPath = targetPath.replace('*', wildcardPart);
    } else {
      const aliasPrefix = alias + '/';
      if (importPath.startsWith(aliasPrefix)) {
        const rest = importPath.slice(aliasPrefix.length);
        resolvedPath = targetPath.endsWith('/') 
          ? targetPath + rest 
          : targetPath + '/' + rest;
      } else {
        resolvedPath = targetPath;
      }
    }

    return path.resolve(this.projectRoot, this.baseUrl, resolvedPath);
  }

  private resolveRelativePath(importPath: string, sourceFile?: string): string {
    if (sourceFile) {
      return path.resolve(path.dirname(sourceFile), importPath);
    }
    return path.resolve(this.projectRoot, this.baseUrl, importPath);
  }

  private checkFileExists(filePath: string): boolean {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.d.ts', ''];
    const indexFiles = ['/index.ts', '/index.tsx', '/index.js', '/index.jsx'];

    for (const ext of extensions) {
      if (fs.existsSync(filePath + ext)) {
        return true;
      }
    }

    for (const indexFile of indexFiles) {
      if (fs.existsSync(filePath + indexFile)) {
        return true;
      }
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      return indexFiles.some(indexFile => fs.existsSync(filePath + indexFile));
    }

    return false;
  }

  getPaths(): TsConfigPaths {
    return { ...this.paths };
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}